import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { clinicId } = await req.json();

    // Gather all clinic data
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    // Parallel data fetching
    const [
      patientsRes,
      appointmentsRes,
      lastMonthAppRes,
      paymentsRes,
      lastMonthPayRes,
      expensesRes,
      commissionsRes,
      enrollmentsRes,
      waitingRes,
    ] = await Promise.all([
      supabase.from("pacientes").select("id, status, created_at, data_nascimento, tipo_atendimento"),
      supabase.from("agendamentos").select("id, status, data_horario, tipo_atendimento, duracao_minutos")
        .gte("data_horario", startOfMonth).lte("data_horario", endOfMonth + "T23:59:59"),
      supabase.from("agendamentos").select("id, status")
        .gte("data_horario", startOfLastMonth).lte("data_horario", endOfLastMonth + "T23:59:59"),
      supabase.from("pagamentos").select("id, valor, status, forma_pagamento, data_pagamento")
        .gte("data_pagamento", startOfMonth.split("T")[0]).lte("data_pagamento", endOfMonth.split("T")[0]),
      supabase.from("pagamentos").select("id, valor, status")
        .gte("data_pagamento", startOfLastMonth.split("T")[0]).lte("data_pagamento", endOfLastMonth.split("T")[0]),
      supabase.from("expenses").select("id, valor, status, categoria"),
      supabase.from("commissions").select("id, valor, status"),
      supabase.from("matriculas").select("id, status, valor_mensal, tipo_atendimento"),
      supabase.from("lista_espera").select("id, status"),
    ]);

    const patients = patientsRes.data || [];
    const appointments = appointmentsRes.data || [];
    const lastMonthApp = lastMonthAppRes.data || [];
    const payments = paymentsRes.data || [];
    const lastMonthPay = lastMonthPayRes.data || [];
    const expenses = expensesRes.data || [];
    const commissions = commissionsRes.data || [];
    const enrollments = enrollmentsRes.data || [];
    const waiting = waitingRes.data || [];

    // Calculate metrics
    const activePatients = patients.filter((p: any) => p.status === "ativo").length;
    const totalPatients = patients.length;
    const newPatientsThisMonth = patients.filter((p: any) => p.created_at >= startOfMonth).length;

    const completedSessions = appointments.filter((a: any) => a.status === "realizado").length;
    const scheduledSessions = appointments.filter((a: any) => ["agendado", "confirmado"].includes(a.status)).length;
    const missedSessions = appointments.filter((a: any) => a.status === "falta").length;
    const cancelledSessions = appointments.filter((a: any) => a.status === "cancelado").length;
    const totalSessions = appointments.length;

    const lastMonthCompleted = lastMonthApp.filter((a: any) => a.status === "realizado").length;
    const lastMonthTotal = lastMonthApp.length;

    const revenue = payments.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
    const pendingPayments = payments.filter((p: any) => p.status === "pendente").reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
    const lastMonthRevenue = lastMonthPay.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

    const totalExpenses = expenses.filter((e: any) => e.status === "pago").reduce((s: number, e: any) => s + Number(e.valor || 0), 0);
    const totalCommissions = commissions.reduce((s: number, c: any) => s + Number(c.valor || 0), 0);

    const activeEnrollments = enrollments.filter((e: any) => e.status === "ativa").length;
    const cancelledEnrollments = enrollments.filter((e: any) => e.status === "cancelada").length;
    const mrrFromEnrollments = enrollments.filter((e: any) => e.status === "ativa").reduce((s: number, e: any) => s + Number(e.valor_mensal || 0), 0);

    const profit = revenue - totalExpenses - totalCommissions;
    const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";
    const missRate = totalSessions > 0 ? ((missedSessions / totalSessions) * 100).toFixed(1) : "0";
    const cancelRate = totalSessions > 0 ? ((cancelledSessions / totalSessions) * 100).toFixed(1) : "0";
    const churnRate = (activeEnrollments + cancelledEnrollments) > 0 ? ((cancelledEnrollments / (activeEnrollments + cancelledEnrollments)) * 100).toFixed(1) : "0";
    const revenueGrowth = lastMonthRevenue > 0 ? (((revenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1) : "N/A";
    const sessionGrowth = lastMonthTotal > 0 ? (((totalSessions - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) : "N/A";
    const ticketMedio = payments.filter((p: any) => p.status === "pago").length > 0
      ? (revenue / payments.filter((p: any) => p.status === "pago").length).toFixed(2)
      : "0";

    // Payment method breakdown
    const paymentMethods: Record<string, number> = {};
    payments.filter((p: any) => p.status === "pago").forEach((p: any) => {
      const method = p.forma_pagamento || "outros";
      paymentMethods[method] = (paymentMethods[method] || 0) + Number(p.valor || 0);
    });

    // Expense categories
    const expenseCategories: Record<string, number> = {};
    expenses.filter((e: any) => e.status === "pago").forEach((e: any) => {
      const cat = e.categoria || "outros";
      expenseCategories[cat] = (expenseCategories[cat] || 0) + Number(e.valor || 0);
    });

    // Service type breakdown
    const serviceTypes: Record<string, number> = {};
    appointments.forEach((a: any) => {
      const tipo = a.tipo_atendimento || "outros";
      serviceTypes[tipo] = (serviceTypes[tipo] || 0) + 1;
    });

    const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const dataContext = `
RELATÓRIO GERENCIAL DA CLÍNICA - ${monthName.toUpperCase()}

=== PACIENTES ===
- Total cadastrados: ${totalPatients}
- Ativos: ${activePatients}
- Novos este mês: ${newPatientsThisMonth}
- Na lista de espera: ${waiting.filter((w: any) => w.status === "aguardando").length}

=== AGENDAMENTOS (MÊS ATUAL) ===
- Total: ${totalSessions}
- Realizados: ${completedSessions}
- Agendados/Confirmados: ${scheduledSessions}
- Faltas: ${missedSessions} (taxa: ${missRate}%)
- Cancelamentos: ${cancelledSessions} (taxa: ${cancelRate}%)
- Variação vs mês anterior: ${sessionGrowth}%

=== FINANCEIRO ===
- Receita total (pagos): R$ ${revenue.toFixed(2)}
- Receita pendente: R$ ${pendingPayments.toFixed(2)}
- Despesas pagas: R$ ${totalExpenses.toFixed(2)}
- Comissões: R$ ${totalCommissions.toFixed(2)}
- Lucro líquido: R$ ${profit.toFixed(2)}
- Margem de lucro: ${profitMargin}%
- Ticket médio: R$ ${ticketMedio}
- Crescimento da receita vs mês anterior: ${revenueGrowth}%
- MRR (matrículas ativas): R$ ${mrrFromEnrollments.toFixed(2)}

=== FORMAS DE PAGAMENTO ===
${Object.entries(paymentMethods).map(([k, v]) => `- ${k}: R$ ${v.toFixed(2)}`).join("\n") || "Sem dados"}

=== CATEGORIAS DE DESPESA ===
${Object.entries(expenseCategories).map(([k, v]) => `- ${k}: R$ ${v.toFixed(2)}`).join("\n") || "Sem dados"}

=== MODALIDADES ===
${Object.entries(serviceTypes).map(([k, v]) => `- ${k}: ${v} sessões`).join("\n") || "Sem dados"}

=== MATRÍCULAS ===
- Ativas: ${activeEnrollments}
- Canceladas: ${cancelledEnrollments}
- Taxa de churn: ${churnRate}%
`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um consultor de gestão de clínicas de fisioterapia e pilates. 
Gere um relatório executivo detalhado em formato estruturado JSON para ser convertido em PDF profissional.

RETORNE APENAS JSON VÁLIDO, sem markdown, sem backticks.

O JSON deve ter esta estrutura:
{
  "resumoExecutivo": "Parágrafo de 3-4 frases com visão geral do estado da clínica",
  "destaques": ["destaque positivo 1", "destaque positivo 2", "destaque positivo 3"],
  "alertas": ["alerta/risco 1", "alerta/risco 2"],
  "analiseFinanceira": "Parágrafo detalhado sobre saúde financeira, margem, ticket médio e recomendações",
  "analiseOperacional": "Parágrafo sobre eficiência operacional, taxa de ocupação, faltas e otimização",
  "analisePacientes": "Parágrafo sobre captação, retenção, churn e estratégias de fidelização",
  "recomendacoes": [
    {"prioridade": "alta", "acao": "descrição da ação", "impacto": "impacto esperado"},
    {"prioridade": "media", "acao": "descrição da ação", "impacto": "impacto esperado"},
    {"prioridade": "baixa", "acao": "descrição da ação", "impacto": "impacto esperado"}
  ],
  "projecaoProximoMes": "Parágrafo com projeção e metas sugeridas para o próximo mês",
  "notaGeral": 8.5
}

A notaGeral deve ser de 0 a 10, representando a saúde geral da clínica.
Seja específico com números e porcentagens. Use linguagem profissional mas acessível.`;

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
            { role: "user", content: `Analise os dados e gere o relatório executivo:\n\n${dataContext}` },
          ],
          temperature: 0.5,
          max_tokens: 3000,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos AI insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar relatório" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    let aiContent = result.choices?.[0]?.message?.content || "";

    // Clean potential markdown wrapping
    aiContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let reportData;
    try {
      reportData = JSON.parse(aiContent);
    } catch {
      reportData = {
        resumoExecutivo: aiContent,
        destaques: [],
        alertas: [],
        analiseFinanceira: "",
        analiseOperacional: "",
        analisePacientes: "",
        recomendacoes: [],
        projecaoProximoMes: "",
        notaGeral: 0,
      };
    }

    return new Response(JSON.stringify({
      report: reportData,
      metrics: {
        totalPatients,
        activePatients,
        newPatientsThisMonth,
        totalSessions,
        completedSessions,
        missedSessions,
        cancelledSessions,
        missRate,
        cancelRate,
        revenue,
        pendingPayments,
        totalExpenses,
        totalCommissions,
        profit,
        profitMargin,
        ticketMedio,
        revenueGrowth,
        sessionGrowth,
        activeEnrollments,
        cancelledEnrollments,
        churnRate,
        mrrFromEnrollments,
        paymentMethods,
        expenseCategories,
        serviceTypes,
        monthName,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
