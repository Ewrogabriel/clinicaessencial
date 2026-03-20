import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tipo } = await req.json(); // "profissional" | "paciente"
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um especialista em gamificação para clínicas de fisioterapia e pilates. 
Gere sugestões criativas e realistas de metas e desafios para ${tipo === "paciente" ? "PACIENTES" : "PROFISSIONAIS"} da clínica.

MÉTRICAS DISPONÍVEIS NO SISTEMA para PROFISSIONAIS:
- sessoes_realizadas: Contagem de agendamentos com status 'realizado'
- checkins_profissional: Check-ins confirmados pelo profissional
- novos_pacientes: Pacientes distintos atendidos pela primeira vez
- presenca_consecutiva: Sequência de dias com ao menos 1 sessão realizada
- faturamento_mes: Soma do valor_sessao dos agendamentos realizados (em R$)
- avaliacoes_realizadas: Fichas de avaliação clínica criadas
- evolucoes_registradas: Prontuários de evolução preenchidos

MÉTRICAS DISPONÍVEIS para PACIENTES:
- sessoes_paciente: Sessões completadas pelo paciente
- checkins_paciente: Confirmações de presença feitas pelo paciente
- indicacoes_paciente: Novos pacientes cadastrados por indicação
- presenca_consecutiva: Dias consecutivos com sessão realizada

REGRAS IMPORTANTES:
- Use APENAS as métricas listadas acima no campo metric_type
- Valores de meta devem ser realistas (ex: 10-50 sessões, 5-20 check-ins)
- Pontos de recompensa entre 50-500
- Datas: use o mês atual ou próximo mês
- Gere exatamente 3 sugestões variadas (1 meta + 2 desafios)
- Títulos criativos e motivadores em português`;

    const userPrompt = `Gere 3 sugestões de gamificação para ${tipo === "paciente" ? "pacientes" : "profissionais"} da clínica. 
A data atual é ${new Date().toISOString().split("T")[0]}.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_gamification",
              description: "Return gamification suggestions with goals and challenges.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["meta", "desafio"] },
                        titulo: { type: "string" },
                        descricao: { type: "string" },
                        metric_type: { type: "string" },
                        target_value: { type: "number" },
                        pontos_recompensa: { type: "number" },
                        icone: { type: "string" },
                        duracao_dias: { type: "number" },
                      },
                      required: ["type", "titulo", "descricao", "metric_type", "target_value", "pontos_recompensa", "icone", "duracao_dias"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_gamification" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No suggestions returned");
    }

    const suggestions = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gamification-suggestions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
