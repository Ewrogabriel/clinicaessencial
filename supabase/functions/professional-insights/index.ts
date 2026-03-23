import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleAiGatewayError, validateApiKey } from "../_shared/ai-utils.ts";

const LOVABLE_API_URL = "https://api.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { kpis, trends } = await req.json();

    const prompt = `Você é um consultor de performance para profissionais de saúde.
Analise os dados abaixo e gere exatamente 4 insights acionáveis em JSON.

DADOS DO PROFISSIONAL:
- Pacientes ativos: ${kpis.pacientesAtivos}
- Pacientes únicos no mês: ${kpis.pacientesUnicos}
- Sessões do mês: ${kpis.sessoesTotal} (${kpis.realizadas} realizadas, ${kpis.faltas} faltas, ${kpis.canceladas} canceladas)
- Taxa de presença: ${kpis.taxaPresenca}%
- Taxa de faltas: ${kpis.taxaFalta}% (mês anterior: ${kpis.taxaFaltaAnt}%)
- Receita atual: R$ ${kpis.receitaAtual.toFixed(2)}
- Receita anterior: R$ ${kpis.receitaAnterior.toFixed(2)}
- Crescimento: ${kpis.crescimentoReceita}%
- Horas trabalhadas: ${kpis.horasTrabalhadas}h
- Ticket médio: R$ ${kpis.ticketMedio.toFixed(2)}

TENDÊNCIA 6 MESES:
${JSON.stringify(trends)}

Responda APENAS com um array JSON no formato:
[{"tipo": "positivo|atencao|oportunidade|estrategia", "titulo": "título curto", "descricao": "insight acionável em 1-2 frases", "metrica": "dado relevante"}]`;

    const LOVABLE_API_KEY = validateApiKey();

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorData = handleAiGatewayError(response.status, errorText);
      return new Response(JSON.stringify({ ...errorData, insights: [] }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "[]";

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("professional-insights error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg, insights: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
