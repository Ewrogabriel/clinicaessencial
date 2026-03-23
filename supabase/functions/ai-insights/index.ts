import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createValidationError, handleAiGatewayError, validateApiKey, AI_GATEWAY_URL } from "../_shared/ai-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const { context } = await req.json();

    if (!context) {
      return new Response(JSON.stringify(createValidationError("O campo 'context' é obrigatório.")), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = validateApiKey();

    const systemPrompt = `Você é um consultor especialista em gestão de clínicas de saúde multiespecialidade. 
Analise os dados fornecidos e gere insights acionáveis em português brasileiro.
Seja direto, objetivo e forneça recomendações práticas.
Formate a resposta em markdown com seções claras:
## 📊 Análise Geral
## ⚠️ Pontos de Atenção
## 💡 Recomendações
## 🎯 Ações Prioritárias

Considere métricas como: taxa de ocupação, inadimplência, evasão de pacientes, produtividade por profissional, ticket médio, e sazonalidade.`;

    const response = await fetch(
      AI_GATEWAY_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analise os seguintes dados da clínica e gere insights detalhados para o gestor:\n\n${context}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      const errorData = handleAiGatewayError(response.status, errText);
      return new Response(JSON.stringify(errorData), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const aiContent =
      result.choices?.[0]?.message?.content || "Sem insights disponíveis.";

    return new Response(JSON.stringify({ insights: aiContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-insights error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
