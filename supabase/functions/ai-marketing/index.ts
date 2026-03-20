import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "clinic_ads") {
      systemPrompt = `Você é um especialista em marketing digital para clínicas de saúde.
Crie anúncios criativos, persuasivos e profissionais para atrair novos pacientes.
Os anúncios devem ser adequados para Instagram, Facebook e Google Ads.
Considere a especialidade da clínica, público-alvo e diferenciais.`;

      userPrompt = `Crie 3 anúncios diferentes para a clínica com os seguintes dados:
- Nome da clínica: ${context.clinicName || "Clínica"}
- Especialidades: ${context.specialties || "Saúde e bem-estar"}
- Público-alvo: ${context.targetAudience || "Adultos 25-55 anos"}
- Diferencial: ${context.differentials || "Atendimento humanizado"}
- Objetivo: ${context.objective || "Atrair novos pacientes"}
- Plataforma: ${context.platform || "Instagram"}
- Tom de voz: ${context.tone || "Profissional e acolhedor"}

Para cada anúncio, inclua:
1. Título chamativo (máx 60 caracteres)
2. Texto do anúncio (máx 200 caracteres)
3. Call-to-action
4. Hashtags relevantes (5-7)
5. Sugestão de imagem

Responda APENAS em JSON:
{"ads": [{"titulo": "...", "texto": "...", "cta": "...", "hashtags": ["..."], "sugestao_imagem": "...", "plataforma": "..."}]}`;
    } else if (type === "app_plans") {
      systemPrompt = `Você é um especialista em marketing de SaaS para o setor de saúde.
Crie anúncios que destaquem os benefícios de um sistema de gestão para clínicas.
Foque em ROI, economia de tempo, organização e profissionalismo.`;

      userPrompt = `Crie 3 anúncios diferentes para vender planos do sistema de gestão de clínicas:
- Planos disponíveis: Starter (R$97/mês), Professional (R$197/mês), Enterprise (R$397/mês)
- Público-alvo: ${context.targetAudience || "Donos e gestores de clínicas de saúde"}
- Plataforma: ${context.platform || "Instagram"}
- Destaque o plano: ${context.highlightPlan || "Professional"}

Para cada anúncio, inclua:
1. Título chamativo
2. Texto do anúncio
3. Call-to-action
4. Hashtags relevantes
5. Sugestão de imagem

Responda APENAS em JSON:
{"ads": [{"titulo": "...", "texto": "...", "cta": "...", "hashtags": ["..."], "sugestao_imagem": "...", "plano_destaque": "..."}]}`;
    } else if (type === "social_post") {
      systemPrompt = `Você é um social media manager especializado em clínicas de saúde.
Crie posts engajantes para redes sociais que eduquem e atraiam seguidores.
Use linguagem acessível e persuasiva.`;

      userPrompt = `Crie 3 posts para redes sociais:
- Clínica: ${context.clinicName || "Clínica"}
- Tema: ${context.theme || "Saúde e bem-estar"}
- Plataforma: ${context.platform || "Instagram"}
- Tipo: ${context.postType || "Educativo"}

Para cada post:
1. Legenda completa com emojis
2. Hashtags (8-12)
3. Sugestão de visual/carrossel
4. Melhor horário para postar

Responda APENAS em JSON:
{"posts": [{"legenda": "...", "hashtags": ["..."], "sugestao_visual": "...", "melhor_horario": "..."}]}`;
    } else if (type === "landing_section") {
      const section = context.section || "hero";
      systemPrompt = `Você é um copywriter especialista em landing pages de SaaS para o setor de saúde.
Gere conteúdo persuasivo e profissional para a seção "${section}" de uma landing page do sistema "Essencial Clínicas".
O sistema é uma plataforma completa de gestão de clínicas de saúde com IA integrada.
Mantenha o tom profissional, persuasivo e moderno. Retorne APENAS JSON válido.`;

      const sectionInstructions: Record<string, string> = {
        hero: `Gere conteúdo para a seção Hero. ${context.prompt || ""}
Retorne JSON: {"badge":"...","titulo":"...","subtitulo":"...","cta_primario":"...","cta_secundario":"...","destaques":["...","...","..."]}`,
        planos: `Gere conteúdo para a seção de Planos/Preços. ${context.prompt || ""}
Retorne JSON: {"titulo":"...","subtitulo":"...","planos":[{"name":"...","price":"...","description":"...","highlighted":false,"features":["..."]}]}`,
        depoimentos: `Gere depoimentos realistas de profissionais de saúde. ${context.prompt || ""}
Retorne JSON: {"titulo":"...","depoimentos":[{"name":"...","role":"...","rating":5,"text":"..."}]}`,
        contato: `Gere textos para a seção de contato. ${context.prompt || ""}
Retorne JSON: {"whatsapp":"...","email":"...","instagram":"...","titulo":"...","subtitulo":"..."}`,
      };

      userPrompt = sectionInstructions[section] || context.prompt || "Gere conteúdo para a landing page.";
      userPrompt += `\n\nConteúdo atual para referência: ${JSON.stringify(context.currentContent)}`;
    } else {
      throw new Error("Tipo de conteúdo inválido");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Falha ao gerar conteúdo de marketing");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let result: any = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      result = { error: "Não foi possível processar a resposta da IA" };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
