import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createValidationError, handleAiGatewayError, validateApiKey, AI_GATEWAY_URL } from "../_shared/ai-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, context } = await req.json();

    if (!action) {
      return new Response(JSON.stringify(createValidationError("O campo 'action' é obrigatório.")), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = validateApiKey();

    let systemPrompt = "";
    let userPrompt = "";
    let tools: any[] = [];
    let toolChoice: any = undefined;

    switch (action) {
      case "churn_reengagement":
        systemPrompt = `Você é especialista em retenção de pacientes para clínicas de saúde (fisioterapia, pilates, psicologia, nutrição, estética, etc).
Analise os dados do paciente em risco de churn e sugira 3 ações personalizadas de reengajamento.
Seja criativo, empático e específico. Considere promoções, mensagens personalizadas, ofertas especiais.`;
        userPrompt = `Paciente: ${context.nome}
Motivos do risco: ${context.reasons?.join(", ")}
Score de risco: ${context.riskScore}%
Última sessão: ${context.lastSession || "Nunca"}
Pagamentos atrasados: ${context.pagamentosAtrasados || 0}

Sugira 3 ações de reengajamento personalizadas.`;
        tools = [{
          type: "function",
          function: {
            name: "suggest_reengagement",
            description: "Suggest reengagement actions for at-risk patient",
            parameters: {
              type: "object",
              properties: {
                actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tipo: { type: "string", enum: ["mensagem", "promocao", "ligacao", "email"] },
                      titulo: { type: "string" },
                      descricao: { type: "string" },
                      mensagem_sugerida: { type: "string" },
                      prioridade: { type: "string", enum: ["alta", "media", "baixa"] }
                    },
                    required: ["tipo", "titulo", "descricao", "mensagem_sugerida", "prioridade"]
                  }
                }
              },
              required: ["actions"]
            }
          }
        }];
        toolChoice = { type: "function", function: { name: "suggest_reengagement" } };
        break;

      case "waiting_list_priority":
        systemPrompt = `Você é especialista em gestão de agenda para clínicas.
Analise a lista de espera e as vagas disponíveis, e sugira quais pacientes devem ser priorizados.
Considere: tempo de espera, compatibilidade de horário, histórico do paciente, tipo de atendimento.`;
        userPrompt = `Vagas disponíveis: ${JSON.stringify(context.slots || [])}
Lista de espera: ${JSON.stringify(context.waitingList || [])}

Sugira os pacientes prioritários para cada vaga, explicando o motivo.`;
        tools = [{
          type: "function",
          function: {
            name: "prioritize_patients",
            description: "Prioritize patients for available slots",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      slot: { type: "string" },
                      paciente_id: { type: "string" },
                      paciente_nome: { type: "string" },
                      motivo: { type: "string" },
                      compatibilidade: { type: "number" }
                    },
                    required: ["slot", "paciente_nome", "motivo", "compatibilidade"]
                  }
                }
              },
              required: ["suggestions"]
            }
          }
        }];
        toolChoice = { type: "function", function: { name: "prioritize_patients" } };
        break;

      case "kpi_insights":
        systemPrompt = `Você é um analista de dados para clínicas de saúde multiespecialidade.
Analise os KPIs fornecidos e gere insights em linguagem natural, fácil de entender.
Destaque pontos positivos, alertas e oportunidades de melhoria.
Seja conciso mas informativo. Use emojis para tornar mais visual.`;
        userPrompt = `KPIs do período:
- Pacientes ativos: ${context.pacientesAtivos || 0}
- Sessões realizadas: ${context.sessoesRealizadas || 0}
- Taxa de faltas: ${context.taxaFaltas || 0}%
- Faturamento: R$ ${context.faturamento || 0}
- Despesas: R$ ${context.despesas || 0}
- Novos pacientes: ${context.novosPacientes || 0}
- Pacientes em risco de churn: ${context.churnRisk || 0}
- Ocupação média: ${context.ocupacao || 0}%

Gere 3-4 insights sobre esses dados.`;
        tools = [{
          type: "function",
          function: {
            name: "generate_insights",
            description: "Generate KPI insights",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tipo: { type: "string", enum: ["positivo", "alerta", "oportunidade", "neutro"] },
                      titulo: { type: "string" },
                      descricao: { type: "string" },
                      icone: { type: "string" }
                    },
                    required: ["tipo", "titulo", "descricao", "icone"]
                  }
                },
                resumo: { type: "string" }
              },
              required: ["insights", "resumo"]
            }
          }
        }];
        toolChoice = { type: "function", function: { name: "generate_insights" } };
        break;

      case "contract_draft":
        systemPrompt = `Você é um assistente jurídico especializado em contratos para clínicas de saúde.
Gere cláusulas personalizadas para contratos baseadas nas informações do paciente e serviço.
Mantenha linguagem formal mas acessível.`;
        userPrompt = `Gere cláusulas personalizadas para:
Paciente: ${context.pacienteNome}
Serviço: ${context.servico}
Frequência: ${context.frequencia}x por semana
Valor: R$ ${context.valor}
Observações: ${context.observacoes || "Nenhuma"}

Sugira 2-3 cláusulas adicionais personalizadas.`;
        tools = [{
          type: "function",
          function: {
            name: "generate_clauses",
            description: "Generate personalized contract clauses",
            parameters: {
              type: "object",
              properties: {
                clausulas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      texto: { type: "string" },
                      motivo: { type: "string" }
                    },
                    required: ["titulo", "texto", "motivo"]
                  }
                }
              },
              required: ["clausulas"]
            }
          }
        }];
        toolChoice = { type: "function", function: { name: "generate_clauses" } };
        break;

      case "smart_scheduling":
        systemPrompt = `Você é especialista em otimização de agenda para clínicas.
Analise o histórico do paciente e a disponibilidade para sugerir os melhores horários.
Considere: horários preferidos anteriores, taxa de comparecimento, proximidade de horários já agendados.`;
        userPrompt = `Histórico do paciente: ${JSON.stringify(context.historico || [])}
Horários disponíveis: ${JSON.stringify(context.slotsDisponiveis || [])}
Preferências informadas: ${context.preferencias || "Nenhuma"}

Sugira os 3 melhores horários para este paciente.`;
        tools = [{
          type: "function",
          function: {
            name: "suggest_slots",
            description: "Suggest best scheduling slots",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      horario: { type: "string" },
                      motivo: { type: "string" },
                      score: { type: "number" }
                    },
                    required: ["horario", "motivo", "score"]
                  }
                }
              },
              required: ["suggestions"]
            }
          }
        }];
        toolChoice = { type: "function", function: { name: "suggest_slots" } };
        break;

      case "patient_chatbot":
        systemPrompt = `Você é um assistente virtual de uma clínica de saúde multiespecialidade.
Ajude pacientes com dúvidas sobre agendamentos, pagamentos, horários e serviços.
Seja cordial, prestativo e objetivo. Use linguagem simples e amigável.
IMPORTANTE: Você NÃO pode marcar ou cancelar consultas - apenas informar e orientar.
Se o paciente precisar de ações específicas, oriente-o a entrar em contato com a recepção.`;
        userPrompt = `Mensagem do paciente: ${context.mensagem}
Nome do paciente: ${context.pacienteNome || "Paciente"}
Contexto:
- Próxima consulta: ${context.proximaConsulta || "Nenhuma agendada"}
- Pendências financeiras: ${context.pendencias || 0}
- Sessões restantes no plano: ${context.sessoesRestantes || "N/A"}`;
        break;

      case "document_suggest":
        systemPrompt = `Você é um profissional de saúde experiente que auxilia na redação de documentos clínicos.
Sua tarefa é melhorar o texto do documento mantendo a essência do que o profissional escreveu.
Use linguagem técnica apropriada, seja claro e objetivo.
Considere o histórico clínico do paciente (evoluções e avaliações) para enriquecer o documento.
Retorne APENAS o texto melhorado, sem explicações adicionais.`;
        userPrompt = `Tipo de documento: ${context.tipo_documento}
Texto atual do profissional:
${context.conteudo_atual}

Dados clínicos do paciente:
Avaliação: ${context.avaliacao}
Evoluções recentes:
${context.evolucoes_recentes}

Melhore o texto acima mantendo o sentido original, enriquecendo com dados clínicos relevantes e usando linguagem técnica apropriada.`;
        break;

      case "document_generate": {
        // Generate initial document text based on type
        const templates: Record<string, string> = {
          comparecimento: `Gere um Comprovante de Comparecimento para uso clínico. Deve conter:
- Declaração formal de que o paciente compareceu à clínica
- Data e horário do atendimento
- Nome do profissional responsável
- Finalidade genérica (consulta/atendimento clínico)
Use linguagem formal e objetiva. O texto deve servir para apresentar a empregadores ou instituições.`,
          atestado: `Gere um Atestado clínico. Deve conter:
- Declaração de atendimento
- Período de afastamento se aplicável
- CID se informado no contexto
- Recomendações gerais
Use linguagem formal e técnica.`,
          receituario: `Gere um modelo de Receituário/Prescrição clínica. Pode incluir:
- Orientações terapêuticas
- Exercícios ou cuidados domiciliares
- Recomendações de frequência
- Cuidados específicos
Use linguagem clara e didática para o paciente.`,
          relatorio: `Gere um modelo de Relatório Clínico. Deve conter:
- Identificação do paciente
- Diagnóstico clínico/funcional
- Objetivos do tratamento
- Evolução observada
- Condutas realizadas
- Prognóstico
Use linguagem técnica apropriada.`,
          encaminhamento: `Gere um modelo de Encaminhamento médico. Deve conter:
- Dados do paciente
- Motivo do encaminhamento
- Histórico relevante resumido
- Avaliação funcional atual
- Solicitação específica ao colega
Use linguagem formal e técnica.`
        };

        systemPrompt = `Você é um fisioterapeuta experiente que gera documentos clínicos profissionais.
Gere um documento completo e profissional baseado no tipo solicitado.
Use os dados do paciente fornecidos para personalizar o documento.
Retorne APENAS o texto do documento, pronto para uso, sem explicações.`;

        userPrompt = `${templates[context.tipo_documento] || "Gere um documento clínico apropriado."}

Dados do paciente:
- Nome: ${context.paciente_nome || "Paciente"}
- Data do atendimento: ${context.data || new Date().toLocaleDateString("pt-BR")}
- Profissional: ${context.profissional_nome || "Profissional"}
- Registro: ${context.profissional_registro || ""}

Dados clínicos (se disponíveis):
Avaliação: ${context.avaliacao || "Não informada"}
Última evolução: ${context.ultima_evolucao || "Não informada"}

Gere o documento completo e profissional.`;
        break;
      }

      case "analyze_import":
        systemPrompt = `Você é um assistente de validação e extração de dados para clínicas de saúde.
Analise as linhas fornecidas extraídas de uma planilha e identifique/corrija os principais erros de formatação usando as regras abaixo:
- Nome: capitalizar adequadamente (Primeira Letra Maiúscula).
- Telefone/WhatsApp: remover caracteres não numéricos e formatar se for BR (ex: 32999999999).
- CPF: formatar para o padrão XXX.XXX.XXX-XX, se houver.
- E-mail: remover espaços adicionais, garantir lower case.
- CEP: procure por CEP em QUALQUER campo de texto, extraia o padrão numerado (8 dígitos) e coloque no campo 'cep'.
- Endereço: separe em componentes - rua (logradouro), número, bairro, cidade, estado, complemento.
- Se encontrar endereço completo em um único campo, divida-o:
  * "Rua das Flores, 123, Apto 45, Centro, Belo Horizonte, MG, 30140-010" →
    { rua: "Rua das Flores", numero: "123", complemento: "Apto 45", bairro: "Centro", cidade: "Belo Horizonte", estado: "MG", cep: "30140010" }
Mapeie a saída para o formato exato esperado.`;
        userPrompt = `Campos esperados: ${JSON.stringify(context.expectedFields)}
Linhas fornecidas (JSON original bruto da planilha não estruturado): ${JSON.stringify(context.rows)}

Por favor, para as ${context.rows?.length || 0} linhas fornecidas, tente mapear os valores corretamente para os campos esperados, adivinhando a intenção das colunas mal nomeadas da planilha original, e aplique as correções de formato.
${context.extractAddressData ? `
IMPORTANTE: As instruções especiais fornecidas são:
${context.instructions || 'Extraia dados de endereço com prioridade alta.'}
` : ''}
Retorne um array JSON com os objetos limpos, seguindo as chaves descritas em Campos Esperados.`;
        tools = [{
          type: "function",
          function: {
            name: "return_analyzed_rows",
            description: "Return the AI corrected and mapped dataset",
            parameters: {
              type: "object",
              properties: {
                corrected_rows: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: true
                  }
                }
              },
              required: ["corrected_rows"]
            }
          }
        }];
        toolChoice = { type: "function", function: { name: "return_analyzed_rows" } };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = toolChoice;
    }

    console.log(`AI Assistant request for action: ${action}`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      const errorData = handleAiGatewayError(status, errorText);
      return new Response(JSON.stringify(errorData), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // For tool calls, extract the function arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // For chatbot/document_suggest/document_generate (no tools), return the message content
    const content = data.choices?.[0]?.message?.content || "";
    
    // For document actions, return as "suggestion" key
    if (action === "document_suggest" || action === "document_generate") {
      return new Response(JSON.stringify({ suggestion: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
