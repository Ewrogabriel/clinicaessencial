import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPTS: Record<string, string> = {
  paciente: `Você é um especialista em saúde e bem-estar. Gere exatamente 3 dicas práticas e originais para pacientes de uma clínica de saúde multiespecialidade (fisioterapia, pilates, psicologia, nutrição, estética, etc). 
As dicas devem ser sobre: saúde, bem-estar, postura, exercícios em casa, alimentação, hidratação, saúde mental, respiração, ou recuperação.
Responda APENAS em JSON válido com este formato exato (sem markdown):
[{"titulo":"...","conteudo":"...","categoria":"Saúde|Bem-estar|Exercícios|Nutrição"}]`,
  profissional: `Você é um consultor de gestão de clínicas de saúde multiespecialidade. Gere exatamente 3 dicas práticas e originais para profissionais da área da saúde (fisioterapeutas, psicólogos, nutricionistas, etc).
As dicas devem ser sobre: comunicação com pacientes, técnicas de ensino, postura profissional, fidelização, atualização profissional, ou liderança clínica.
Responda APENAS em JSON válido com este formato exato (sem markdown):
[{"titulo":"...","conteudo":"...","categoria":"Comportamento|Técnica|Profissionalismo|Gestão"}]`,
  admin: `Você é um consultor de gestão de clínicas de saúde multiespecialidade. Gere exatamente 3 dicas práticas e originais para administradores e gestores de clínica.
As dicas devem ser sobre: gestão financeira, indicadores de desempenho, retenção de pacientes, liderança de equipe, marketing clínico, ou otimização de processos.
Responda APENAS em JSON válido com este formato exato (sem markdown):
[{"titulo":"...","conteudo":"...","categoria":"Gestão|Técnica|Profissionalismo|Comportamento"}]`,
  secretario: `Você é um consultor de gestão de clínicas de saúde multiespecialidade. Gere exatamente 3 dicas práticas e originais para secretários(as) e recepcionistas de clínica.
As dicas devem ser sobre: atendimento ao paciente, organização de agenda, comunicação telefônica, acolhimento, gestão de documentos, ou resolução de conflitos.
Responda APENAS em JSON válido com este formato exato (sem markdown):
[{"titulo":"...","conteudo":"...","categoria":"Atendimento|Organização|Comportamento|Gestão"}]`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tipo } = await req.json();
    const validTipo = PROMPTS[tipo] ? tipo : "profissional";

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const dayOfYear = Math.floor(
      (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );

    const systemPrompt = PROMPTS[validTipo] + `\nUse o número ${dayOfYear} como seed para variar as dicas a cada dia.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Gere 3 dicas para ${today}. Responda somente o JSON.` },
          ],
          temperature: 0.8,
          max_tokens: 1000,
        }),
      }
    );

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content || "[]";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let dicas;
    try {
      dicas = JSON.parse(content);
    } catch {
      dicas = [];
    }

    return new Response(JSON.stringify({ dicas, date: today }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
