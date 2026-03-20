import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { paciente_id, evolutions_text, evaluation_text, action, modalidade, attachments_info } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modalidadeCtx = modalidade ? `\n\n**Modalidade de atendimento:** ${modalidade}` : "";
    const attachmentsCtx = attachments_info ? `\n\n**Documentos anexados ao prontuário:**\n${attachments_info}` : "";

    let systemPrompt = "";
    let userContent = "";

    switch (action) {
      case "summarize":
        systemPrompt = `Você é um profissional de saúde especialista em ${modalidade || "fisioterapia/pilates"}. Analise o histórico de evoluções clínicas do paciente e gere:
1. **Resumo Clínico**: Síntese objetiva do quadro e progresso do paciente
2. **Principais Achados**: Pontos mais relevantes observados ao longo do tratamento
3. **Tendência**: Se o paciente está melhorando, estagnado ou piorando
4. **Atenção**: Pontos que merecem atenção especial

Responda em português brasileiro, de forma objetiva e profissional. Use markdown.`;
        userContent = `Histórico de evoluções do paciente:\n\n${evolutions_text}`;
        if (evaluation_text) userContent += `\n\nAvaliação inicial:\n${evaluation_text}`;
        userContent += modalidadeCtx + attachmentsCtx;
        break;

      case "suggest_conduct":
        systemPrompt = `Você é um profissional de saúde especialista em ${modalidade || "fisioterapia/pilates"}. Com base no histórico clínico fornecido, sugira:
1. **Conduta Recomendada**: O que fazer na próxima sessão
2. **Exercícios Sugeridos**: Protocolos e exercícios indicados para a modalidade ${modalidade || "do paciente"}
3. **Objetivos de Curto Prazo**: Metas para as próximas 2-4 sessões
4. **Orientações ao Paciente**: O que orientar para domicílio

Seja específico e baseado em evidências. Responda em português brasileiro. Use markdown.`;
        userContent = `Histórico de evoluções:\n\n${evolutions_text}`;
        if (evaluation_text) userContent += `\n\nAvaliação inicial:\n${evaluation_text}`;
        userContent += modalidadeCtx + attachmentsCtx;
        break;

      case "lesson_plan":
        systemPrompt = `Você é um profissional de saúde e instrutor especialista em ${modalidade || "pilates/fisioterapia"}. Crie um plano de aula detalhado e personalizado considerando o quadro clínico do paciente.

Estruture o plano assim:
1. **Objetivo da Aula**: O que será trabalhado e por quê
2. **Aquecimento** (5-10 min): Exercícios preparatórios
3. **Parte Principal** (30-40 min): Sequência de exercícios com:
   - Nome do exercício
   - Séries x Repetições
   - Equipamento/aparelho necessário
   - Observações de execução e cuidados
4. **Volta à Calma** (5-10 min): Alongamentos e relaxamento
5. **Progressão**: Como evoluir nas próximas sessões
6. **Contraindicações/Cuidados**: Movimentos a evitar com base no quadro

Seja muito específico para a modalidade **${modalidade || "pilates"}**. Use nomes reais de exercícios. Responda em português brasileiro. Use markdown.`;
        userContent = `Quadro clínico do paciente:\n\n`;
        if (evaluation_text) userContent += `Avaliação:\n${evaluation_text}\n\n`;
        if (evolutions_text) userContent += `Últimas evoluções:\n${evolutions_text}\n\n`;
        userContent += modalidadeCtx + attachmentsCtx;
        break;

      case "treatment_plan":
        systemPrompt = `Você é um profissional de saúde especialista em ${modalidade || "fisioterapia/pilates"}. Analise TODOS os dados disponíveis do paciente (avaliação, evoluções, documentos anexados) e elabore um plano de tratamento completo:

1. **Diagnóstico Funcional**: Síntese do quadro atual baseada em todos os dados
2. **Objetivos de Tratamento**:
   - Curto prazo (1-4 semanas)
   - Médio prazo (1-3 meses)
   - Longo prazo (3-6 meses)
3. **Plano Terapêutico**:
   - Frequência recomendada de sessões
   - Protocolos e técnicas indicadas
   - Exercícios-chave para cada fase
4. **Critérios de Progressão**: Quando avançar de fase
5. **Critérios de Alta**: Indicadores para encerramento
6. **Orientações Domiciliares**: Programa de exercícios para casa
7. **Prognóstico**: Expectativa de evolução

Baseie-se em evidências científicas. Se documentos foram anexados (exames, laudos), considere-os na análise. Responda em português brasileiro. Use markdown.`;
        userContent = "";
        if (evaluation_text) userContent += `Avaliação clínica:\n${evaluation_text}\n\n`;
        if (evolutions_text) userContent += `Histórico de evoluções:\n${evolutions_text}\n\n`;
        userContent += modalidadeCtx + attachmentsCtx;
        if (!userContent.trim()) userContent = "Sem dados clínicos registrados ainda. Sugira um plano genérico para a modalidade.";
        break;

      case "generate_report":
        systemPrompt = `Você é um profissional de saúde especialista em ${modalidade || "fisioterapia/pilates"}. Gere um relatório clínico formal e completo para o paciente, adequado para envio a convênios, médicos ou uso institucional.

Estruture o relatório assim:

# RELATÓRIO CLÍNICO

**Data:** [data atual]
**Modalidade:** ${modalidade || "Não especificada"}

## 1. IDENTIFICAÇÃO E ENCAMINHAMENTO
Breve contexto do paciente e motivo do atendimento.

## 2. AVALIAÇÃO INICIAL
Resumo dos achados da avaliação.

## 3. DIAGNÓSTICO FUNCIONAL
Quadro funcional identificado.

## 4. PLANO DE TRATAMENTO EXECUTADO
Descrição do que foi realizado ao longo das sessões.

## 5. EVOLUÇÃO CLÍNICA
Análise da progressão do paciente sessão a sessão.

## 6. RESULTADOS OBTIDOS
Ganhos mensuráveis e qualitativos.

## 7. ESTADO ATUAL
Condição atual do paciente.

## 8. CONDUTA E RECOMENDAÇÕES
Próximos passos recomendados.

Seja formal, objetivo e profissional. Responda em português brasileiro. Use markdown.`;
        userContent = "";
        if (evaluation_text) userContent += `Avaliação clínica:\n${evaluation_text}\n\n`;
        if (evolutions_text) userContent += `Histórico de evoluções:\n${evolutions_text}\n\n`;
        userContent += modalidadeCtx + attachmentsCtx;
        if (!userContent.trim()) userContent = "Sem dados clínicos registrados. Gere um modelo de relatório em branco.";
        break;

      case "suggest_evolution":
        systemPrompt = `Você é um profissional de saúde especialista em ${modalidade || "fisioterapia/pilates"}. Com base no histórico completo do paciente (avaliação, evoluções anteriores e documentos), gere uma SUGESTÃO DE EVOLUÇÃO para a sessão de hoje.

Retorne EXATAMENTE no formato JSON abaixo (sem markdown, sem blocos de código):
{
  "descricao": "Texto completo da descrição do atendimento de hoje, incluindo o que foi realizado, exercícios, observações do paciente, resposta ao tratamento, sinais vitais se relevante. Mínimo 3 parágrafos.",
  "conduta": "Conduta e plano para a próxima sessão, incluindo exercícios a progredir, cuidados, orientações domiciliares."
}

Baseie-se nas evoluções anteriores para dar continuidade ao tratamento. Se houve conduta planejada na última sessão, siga essa linha. Seja específico para a modalidade ${modalidade || "do paciente"}.`;
        userContent = "";
        if (evaluation_text) userContent += `Avaliação clínica:\n${evaluation_text}\n\n`;
        if (evolutions_text) userContent += `Evoluções anteriores (mais recente primeiro):\n${evolutions_text}\n\n`;
        userContent += modalidadeCtx + attachmentsCtx;
        if (!userContent.trim()) userContent = "Sem dados anteriores. Sugira uma evolução genérica de primeira sessão para a modalidade.";
        break;

      case "analyze_all":
        systemPrompt = `Você é um profissional de saúde especialista em ${modalidade || "fisioterapia/pilates"}. Faça uma ANÁLISE COMPLETA E ABRANGENTE de todo o prontuário do paciente, incluindo avaliação, todas as evoluções e documentos anexados.

Estruture assim:

# 📋 ANÁLISE COMPLETA DO PRONTUÁRIO

## 1. Resumo Executivo
Síntese em 3-5 linhas do caso clínico completo.

## 2. Análise da Avaliação Inicial
Pontos-chave da avaliação, diagnóstico funcional inferido.

## 3. Análise Cronológica das Evoluções
Analise CADA evolução registrada, identificando:
- Progressos e ganhos
- Pontos de estagnação ou piora
- Adesão do paciente
- Efetividade das condutas aplicadas

## 4. Análise de Documentos
Considerações sobre exames, laudos ou documentos anexados.

## 5. Indicadores de Evolução
- Taxa de melhora estimada (%)
- Áreas com maior ganho
- Áreas que precisam mais atenção
- Número de sessões realizadas vs. esperadas

## 6. Sugestão de Evolução para Próxima Sessão
Texto pronto para usar como evolução, baseado na continuidade do tratamento.

## 7. Plano de Ação Recomendado
- Próximos passos imediatos
- Ajustes de protocolo sugeridos
- Previsão de alta ou reavaliação

## 8. Alertas Clínicos
⚠️ Pontos de atenção, riscos identificados ou bandeiras vermelhas.

Seja extremamente detalhado e analítico. Responda em português brasileiro. Use markdown com emojis para facilitar a leitura.`;
        userContent = "";
        if (evaluation_text) userContent += `Avaliação clínica:\n${evaluation_text}\n\n`;
        if (evolutions_text) userContent += `Todas as evoluções (mais recente primeiro):\n${evolutions_text}\n\n`;
        userContent += modalidadeCtx + attachmentsCtx;
        if (!userContent.trim()) userContent = "Prontuário vazio. Informe que não há dados suficientes para análise.";
        break;

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
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
            { role: "user", content: userContent },
          ],
          temperature: 0.5,
          max_tokens: 4000,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "Não foi possível gerar análise.";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-clinical error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
