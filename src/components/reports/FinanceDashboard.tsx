import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertCircle,
  Calculator,
  ArrowRightLeft,
} from "lucide-react";

const DASHBOARD_STALE_TIME = 1000 * 60 * 5;
const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const QUERY_LIMIT = 5000;

const formaLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
  outros: "Outros",
};

type UnifiedFinancePayment = {
  valor: number;
  status: string;
  referenceDate: string | null;
  dueDate: string | null;
  paymentMethod: string;
};

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "pendente").toLowerCase() === "aberto" ? "pendente" : (status ?? "pendente").toLowerCase();
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const FinanceDashboard = () => {
  const { activeClinicId } = useClinic();

  const { data: dashboardData } = useQuery({
    queryKey: ["finance-dashboard-aligned", activeClinicId],
    enabled: !!activeClinicId,
    staleTime: DASHBOARD_STALE_TIME,
    queryFn: async () => {
      const months = Array.from({ length: 6 }, (_, index) => {
        const date = subMonths(new Date(), 5 - index);
        return {
          key: format(date, "yyyy-MM"),
          label: format(date, "MMM", { locale: ptBR }),
        };
      });

      const today = startOfToday();
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);

      const [formasRes, pagamentosRes, mensalidadesRes, sessoesRes, despesasRes, commissionsRes] = await Promise.all([
        supabase.from("formas_pagamento").select("id, nome").eq("ativo", true).range(0, QUERY_LIMIT - 1),
        supabase
          .from("pagamentos")
          .select("valor, status, data_pagamento, data_vencimento, forma_pagamento")
          .eq("clinic_id", activeClinicId)
          .range(0, QUERY_LIMIT - 1),
        supabase
          .from("pagamentos_mensalidade")
          .select("valor, status, data_pagamento, data_vencimento, mes_referencia, forma_pagamento_id")
          .eq("clinic_id", activeClinicId)
          .range(0, QUERY_LIMIT - 1),
        supabase
          .from("pagamentos_sessoes")
          .select("valor, status, data_pagamento, forma_pagamento_id")
          .eq("clinic_id", activeClinicId)
          .range(0, QUERY_LIMIT - 1),
        supabase
          .from("expenses")
          .select("valor, status, data_pagamento, created_at")
          .eq("clinic_id", activeClinicId)
          .range(0, QUERY_LIMIT - 1),
        supabase
          .from("commissions")
          .select("valor, status")
          .eq("clinic_id", activeClinicId)
          .range(0, QUERY_LIMIT - 1),
      ]);

      if (formasRes.error) throw formasRes.error;
      if (pagamentosRes.error) throw pagamentosRes.error;
      if (mensalidadesRes.error) throw mensalidadesRes.error;
      if (sessoesRes.error) throw sessoesRes.error;
      if (despesasRes.error) throw despesasRes.error;
      if (commissionsRes.error) throw commissionsRes.error;

      const formasMap = Object.fromEntries((formasRes.data ?? []).map((item) => [item.id, item.nome]));

      const unifiedPayments: UnifiedFinancePayment[] = [
        ...((pagamentosRes.data ?? []).map((payment) => {
          const status = normalizeStatus(payment.status);
          return {
            valor: Number(payment.valor ?? 0),
            status,
            referenceDate: status === "pago"
              ? dateOnly(payment.data_pagamento) ?? dateOnly(payment.data_vencimento)
              : dateOnly(payment.data_vencimento) ?? dateOnly(payment.data_pagamento),
            dueDate: dateOnly(payment.data_vencimento) ?? dateOnly(payment.data_pagamento),
            paymentMethod: formaLabels[payment.forma_pagamento ?? ""] ?? payment.forma_pagamento ?? "Outros",
          };
        }) as UnifiedFinancePayment[]),
        ...((mensalidadesRes.data ?? []).map((payment) => {
          const status = normalizeStatus(payment.status);
          const dueDate = dateOnly(payment.data_vencimento) ?? dateOnly(payment.mes_referencia);
          return {
            valor: Number(payment.valor ?? 0),
            status,
            referenceDate: status === "pago" ? dateOnly(payment.data_pagamento) ?? dueDate : dueDate,
            dueDate,
            paymentMethod: payment.forma_pagamento_id ? formasMap[payment.forma_pagamento_id] ?? "Outros" : "Outros",
          };
        }) as UnifiedFinancePayment[]),
        ...((sessoesRes.data ?? []).map((payment) => {
          const status = normalizeStatus(payment.status);
          const paymentDate = dateOnly(payment.data_pagamento);
          return {
            valor: Number(payment.valor ?? 0),
            status,
            referenceDate: paymentDate,
            dueDate: paymentDate,
            paymentMethod: payment.forma_pagamento_id ? formasMap[payment.forma_pagamento_id] ?? "Outros" : "Outros",
          };
        }) as UnifiedFinancePayment[]),
      ];

      const monthlyMap = new Map(months.map((month) => [month.key, {
        mes: month.label,
        receita: 0,
        despesa: 0,
        lucro: 0,
        paidCount: 0,
        ticketMedio: 0,
      }]));

      unifiedPayments.forEach((payment) => {
        if (payment.status !== "pago" || !payment.referenceDate) return;
        const month = monthlyMap.get(payment.referenceDate.slice(0, 7));
        if (!month) return;
        month.receita += payment.valor;
        month.paidCount += 1;
      });

      (despesasRes.data ?? []).forEach((expense) => {
        if (normalizeStatus(expense.status) !== "pago") return;
        const referenceDate = dateOnly(expense.data_pagamento) ?? dateOnly(expense.created_at);
        if (!referenceDate) return;
        const month = monthlyMap.get(referenceDate.slice(0, 7));
        if (!month) return;
        month.despesa += Number(expense.valor ?? 0);
      });

      const monthlyData = months.map((month) => {
        const current = monthlyMap.get(month.key)!;
        const ticketMedio = current.paidCount > 0 ? current.receita / current.paidCount : 0;
        return {
          mes: current.mes,
          receita: Math.round(current.receita),
          despesa: Math.round(current.despesa),
          lucro: Math.round(current.receita - current.despesa),
          ticketMedio: Math.round(ticketMedio),
        };
      });

      const formaDistributionMap: Record<string, number> = {};
      unifiedPayments.forEach((payment) => {
        if (payment.status !== "pago") return;
        formaDistributionMap[payment.paymentMethod] = (formaDistributionMap[payment.paymentMethod] ?? 0) + payment.valor;
      });

      const outstanding = unifiedPayments
        .filter((payment) => payment.status === "pendente")
        .reduce((sum, payment) => sum + payment.valor, 0);

      const overdue = unifiedPayments
        .filter((payment) => payment.status === "pendente" && payment.dueDate && new Date(payment.dueDate) < today)
        .reduce((sum, payment) => sum + payment.valor, 0);

      const cashFlowProjection = unifiedPayments
        .filter((payment) => {
          if (payment.status !== "pendente" || !payment.dueDate) return false;
          const dueDate = new Date(payment.dueDate);
          return dueDate >= today && dueDate <= in30Days;
        })
        .reduce((sum, payment) => sum + payment.valor, 0);

      const commissionsPending = (commissionsRes.data ?? [])
        .filter((commission) => normalizeStatus(commission.status) === "pendente")
        .reduce((sum, commission) => sum + Number(commission.valor ?? 0), 0);

      return {
        monthlyData,
        formaDistribution: Object.entries(formaDistributionMap).map(([name, value]) => ({
          name,
          value: Math.round(value),
        })),
        outstandingData: {
          total: outstanding,
          vencido: overdue,
        },
        cashFlowProjection,
        commissionsPending,
      };
    },
  });

  const monthlyData = dashboardData?.monthlyData ?? [];
  const formaDistribution = dashboardData?.formaDistribution ?? [];
  const outstandingData = dashboardData?.outstandingData;
  const commissionsData = dashboardData?.commissionsPending ?? 0;
  const cashFlowProjection = dashboardData?.cashFlowProjection ?? 0;

  const lastMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];

  const growthRate = useMemo(() => {
    if (!prevMonth?.receita || !lastMonth?.receita) return null;
    return (((lastMonth.receita - prevMonth.receita) / prevMonth.receita) * 100).toFixed(1);
  }, [lastMonth, prevMonth]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" /> Receita Mensal
            </div>
            <p className="text-2xl font-bold">R$ {(lastMonth?.receita || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4" /> Despesas Mês
            </div>
            <p className="text-2xl font-bold text-destructive">R$ {(lastMonth?.despesa || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" /> Ticket Médio
            </div>
            <p className="text-2xl font-bold">R$ {(lastMonth?.ticketMedio || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /> Crescimento
            </div>
            <p className={`text-2xl font-bold ${Number(growthRate) >= 0 ? "text-green-600" : "text-destructive"}`}>
              {growthRate ? `${growthRate}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4 text-destructive" /> A Receber
            </div>
            <p className="text-2xl font-bold text-destructive">
              R$ {(outstandingData?.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            {(outstandingData?.vencido ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                R$ {(outstandingData?.vencido ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vencido
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calculator className="h-4 w-4 text-orange-500" /> Comissões Pendentes
            </div>
            <p className="text-2xl font-bold text-orange-600">
              R$ {commissionsData.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ArrowRightLeft className="h-4 w-4 text-blue-500" /> Previsão 30 dias
            </div>
            <p className="text-2xl font-bold text-blue-600">
              R$ {cashFlowProjection.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Recebimentos pendentes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Receita vs Despesas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Receita" />
                <Bar dataKey="despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Despesa" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Formas de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={formaDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {formaDistribution.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução do Lucro Líquido</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
              <Line type="monotone" dataKey="lucro" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Lucro" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};