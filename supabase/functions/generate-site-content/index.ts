// Edge function: gera rascunho de seção do site da clínica usando Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  section: "hero" | "sobre" | "servicos" | "diferenciais" | "faq" | "depoimentos" | "contato";
  clinic: {
    nome: string;
    cidade?: string;
    estado?: string;
    especialidades?: string[];
  };
  hint?: string;
}

const PROMPTS: Record<Body["section"], string> = {
  hero: "Gere um JSON com {titulo, subtitulo, cta_label}. Título curto e impactante (máx 8 palavras), subtítulo com 1 frase de proposta de valor, cta_label com chamada para ação (ex: 'Agendar avaliação').",
  sobre: "Gere um JSON com {titulo, texto}. Texto institucional acolhedor com 2 parágrafos curtos sobre a clínica.",
  servicos: "Gere um JSON com {titulo, itens: [{nome, descricao, icone}]}. 4 a 6 serviços comuns para a clínica. icone deve ser um nome de ícone do lucide-react (ex: 'heart', 'activity', 'stethoscope').",
  diferenciais: "Gere um JSON com {titulo, itens: [{titulo, descricao, icone}]}. 3 a 5 diferenciais competitivos. icone do lucide-react.",
  faq: "Gere um JSON com {titulo, itens: [{pergunta, resposta}]}. 5 perguntas frequentes claras e objetivas.",
  depoimentos: "Gere um JSON com {titulo, itens: [{nome, texto, cargo}]}. 3 depoimentos fictícios e plausíveis (marque cargo como 'Paciente').",
  contato: "Gere um JSON com {titulo, mensagem}. Mensagem curta convidando ao contato.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body: Body = await req.json();
    if (!body?.section || !body?.clinic?.nome) {
      return new Response(JSON.stringify({ error: "section e clinic.nome são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = `Clínica: ${body.clinic.nome}${body.clinic.cidade ? `, ${body.clinic.cidade}/${body.clinic.estado || ""}` : ""}.${body.clinic.especialidades?.length ? ` Especialidades: ${body.clinic.especialidades.join(", ")}.` : ""}${body.hint ? ` Direção extra: ${body.hint}.` : ""}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um copywriter especializado em sites de clínicas de saúde no Brasil. Responda SEMPRE em português brasileiro e SOMENTE com JSON válido, sem markdown." },
          { role: "user", content: `${PROMPTS[body.section]}\n\nContexto: ${ctx}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "Falha na IA", detail: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

    return new Response(JSON.stringify({ section: body.section, content: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
