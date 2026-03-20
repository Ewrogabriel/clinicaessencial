import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIPO_PLANO_DESCRIPTIONS: Record<string, string> = {
  fisioterapia: "fisioterapia e reabilitação",
  pilates_aparelho: "Pilates em aparelhos (Reformer, Cadillac, Chair, Barrel). Inclua o aparelho utilizado em cada exercício.",
  pilates_solo: "Pilates solo/Mat, exercícios no colchonete com acessórios como bola, faixa elástica, magic circle",
  pilates_misto: "Pilates misto combinando exercícios de solo (Mat) e aparelhos (Reformer, Cadillac, Chair)",
  fortalecimento: "fortalecimento muscular com pesos livres e equipamentos",
  alongamento: "alongamento e flexibilidade",
  funcional: "treinamento funcional com exercícios compostos e multiarticulares",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { objetivo, condicao, nivel, semanas, observacoes, tipo_plano } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const tipoDesc = TIPO_PLANO_DESCRIPTIONS[tipo_plano || "fisioterapia"] || "exercícios terapêuticos";

    const systemPrompt = `Você é um fisioterapeuta e instrutor de Pilates altamente qualificado, com vasta experiência em ${tipoDesc}.

Sua tarefa é criar um plano de exercícios detalhado e estruturado para um paciente/aluno.

REGRAS IMPORTANTES:
- Adapte completamente os exercícios ao tipo de plano solicitado
- Para Pilates Aparelho: especifique o aparelho (Reformer, Cadillac, Chair, Barrel) e a resistência das molas
- Para Pilates Solo: especifique os acessórios necessários (bola, faixa, magic circle, etc.)
- Considere o nível do paciente/aluno ao definir complexidade, carga e número de repetições
- Para nível "adaptado": inclua modificações e alternativas seguras
- Inclua sempre instruções claras de respiração quando aplicável

Retorne SOMENTE um JSON válido com a seguinte estrutura, sem texto adicional:
{
  "titulo": "Nome do plano",
  "descricao": "Descrição geral do plano incluindo equipamentos necessários",
  "objetivo": "Objetivo principal",
  "exercicios": [
    {
      "nome": "Nome do exercício (incluir aparelho se aplicável)",
      "descricao": "Descrição detalhada de como executar, posicionamento, respiração",
      "series": 3,
      "repeticoes": "8-10",
      "carga": "Mola leve/média/pesada ou peso corporal",
      "tempo_execucao": "30 segundos",
      "frequencia": "3x por semana",
      "observacoes": "Cuidados, variações e progressões"
    }
  ]
}

Crie entre 6 e 10 exercícios adequados ao perfil informado, em ordem progressiva de dificuldade.`;

    const userPrompt = `Crie um plano de ${tipoDesc} com as seguintes especificações:
- Tipo de plano: ${tipo_plano || "fisioterapia"}
- Objetivo: ${objetivo || "Condicionamento geral e bem-estar"}
- Condição do paciente/aluno: ${condicao || "Sem restrições especiais"}
- Nível: ${nivel || "Iniciante"}
- Duração do plano: ${semanas || 4} semanas
- Observações do profissional: ${observacoes || "Nenhuma"}`;

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
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    let plan;
    try {
      plan = JSON.parse(content);
    } catch {
      plan = { titulo: "Plano Personalizado", descricao: content, exercicios: [] };
    }

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-exercise-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
