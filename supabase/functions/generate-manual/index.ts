import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { section, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (action === "generate_image") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: `Create a clean, modern UI screenshot illustration for a clinic management software section called "${section}". Style: flat design, professional, blue and green tones, white background. Show a simplified mockup of the interface for this feature.` }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Image generation error:", response.status, errText);
        return new Response(JSON.stringify({ error: "Erro ao gerar imagem" }), {
          status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "Nenhuma imagem gerada" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload to storage
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `manual/${Date.now()}-${section.replace(/\s+/g, "-").toLowerCase()}.png`;

      const { error: uploadErr } = await supabase.storage
        .from("marketing-images")
        .upload(fileName, bytes, { contentType: "image/png", upsert: true });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        return new Response(JSON.stringify({ error: "Erro ao salvar imagem" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: publicUrl } = supabase.storage.from("marketing-images").getPublicUrl(fileName);

      return new Response(JSON.stringify({ imageUrl: publicUrl.publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate manual text content
    const allSections = [
      "Dashboard e Visão Geral",
      "Agenda e Agendamentos",
      "Pacientes e Cadastros",
      "Prontuários e Evoluções Clínicas",
      "Matrículas e Planos de Sessões",
      "Financeiro e Pagamentos",
      "Profissionais e Comissões",
      "Modalidades e Tipos de Atendimento",
      "Relatórios e Indicadores",
      "Automações e Notificações",
      "Marketing e Site de Vendas",
      "Contratos Digitais",
      "Inventário e Equipamentos",
      "Mensagens Internas",
      "Portal do Paciente",
      "Configurações da Clínica",
      "Gestão Multi-Clínicas",
      "Gamificação e Metas",
    ];

    const targetSection = section || "all";
    const sectionsToGenerate = targetSection === "all" ? allSections : [targetSection];

    const prompt = targetSection === "all"
      ? `Você é um redator técnico especialista. Gere um manual completo e profissional do sistema "Essencial Clínicas", um software de gestão para clínicas de saúde multiespecialidade.

O manual deve cobrir TODAS estas seções do sistema:
${allSections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Para CADA seção, forneça:
- Título claro
- Descrição do que a funcionalidade faz
- Passo a passo de como usar (numerado)
- Dicas úteis

Formato: Use Markdown. Use ## para títulos de seção, ### para subtítulos. Seja detalhado mas objetivo.
O manual deve ser em português brasileiro, profissional e completo.`
      : `Você é um redator técnico especialista. Gere a seção "${targetSection}" do manual do sistema "Essencial Clínicas".

Inclua:
- Descrição completa da funcionalidade
- Passo a passo detalhado de uso (numerado)
- Dicas e boas práticas
- Exemplos de uso comum

Formato: Markdown, português brasileiro, profissional e detalhado.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content, sections: sectionsToGenerate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-manual error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
