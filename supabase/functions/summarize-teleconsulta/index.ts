import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcription, paciente_nome, profissional_nome, data_consulta, duration_minutes } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!transcription || transcription.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Transcrição muito curta para gerar resumo." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente clínico especializado em fisioterapia e pilates.
Sua tarefa é gerar um resumo clínico estruturado a partir da transcrição de uma teleconsulta.

O resumo deve conter as seguintes seções (quando aplicável):
1. **Dados da Consulta** - Paciente, profissional, data, duração
2. **Queixa Principal** - Motivo da consulta
3. **Anamnese / Relato** - O que foi discutido sobre sintomas, histórico
4. **Avaliação / Observações Clínicas** - Observações do profissional
5. **Conduta / Orientações** - Exercícios prescritos, orientações, recomendações
6. **Próximos Passos** - Retorno, exames, encaminhamentos
7. **Observações Adicionais** - Qualquer informação relevante

Seja objetivo, use linguagem clínica profissional e organize em tópicos claros.
Se alguma seção não tiver informação na transcrição, omita-a.`;

    const userPrompt = `Dados da teleconsulta:
- Paciente: ${paciente_nome || "Não informado"}
- Profissional: ${profissional_nome || "Não informado"}
- Data: ${data_consulta || "Não informada"}
- Duração: ${duration_minutes ? duration_minutes + " minutos" : "Não informada"}

Transcrição completa:
"""
${transcription}
"""

Gere o resumo clínico estruturado.`;

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
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-teleconsulta error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
