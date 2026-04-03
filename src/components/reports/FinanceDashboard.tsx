import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, DollarSign, Target, AlertCircle, Calculator, ArrowRightLeft } from "lucide-react";
import { useMemo } from "react";

/** 1-hour cache for dashboard metrics */
const DASHBOARD_STALE_TIME = 1000 * 60 * 60;

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const formaLabels: Record<string, string> = {
  pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito", boleto: "Boleto", transferencia: "Transferência", outros: "Outros",
};

export const FinanceDashboard = () => {
  const { activeClinicId } = useClinic();

  // Fetch formas_pagamento for FK lookup
  const { data: formasPagamentoList = [] } = useQuery({
    queryKey: ["formas-pagamento-dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("formas_pagamento").select("id, nome").eq("ativo", true);
      return data ?? [];
    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  const formasMap = useMemo(() => {
    const map: Record<string, string> = {};
    formasPagamentoList.forEach((f) => { map[f.id] = f.nome; });
    return map;
  }, [formasPagamentoList]);

  const { data: monthlyData = [] } = useQuery({
    queryKey: ["finance-dashboard-monthly-unified", activeClinicId],
    queryFn: async () => {
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), 5 - i);
        return {
          start: startOfMonth(d).toISOString(),
          end: endOfMonth(d).toISOString(),
          label: format(d, "MMM", { locale: ptBR }),
        };
      });

      
      // Fetch all data in parallel for all months
      const allQueries = months.map(async (m) => {
        const [{ data: pgtos }, { data: mens }, { data: sess }, { data: despesas }] = await Promise.all([
          (() => {
            let q = supabase.from("pagamentos").select("valor, status").gte("data_pagamento", m.start).lte("data_pagamento", m.end);
            if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
            return q;
          })(),
          (() => {
            let q = supabase.from("pagamentos_mensalidade").select("valor, status").gte("data_pagamento", m.start).lte("data_pagamento", m.end);
            if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
            return q;
          })(),
          (() => {
            let q = supabase.from("pagamentos_sessoes").select("valor, status").gte("data_pagamento", m.start).lte("data_pagamento", m.end);
            if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
            return q;
          })(),
          (() => {
            let q = supabase.from("expenses").select("valor, status").gte("created_at", m.start).lte("created_at", m.end);
            if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
            return q;
          })(),
        ]);

        const allPagos = [
          ...(pgtos || []).filter(p => p.status === "pago"),
          ...(mens || []).filter(p => p.status === "pago"),
          ...(sess || []).filter(p => p.status === "pago"),
        ];
        const receita = allPagos.reduce((s, p) => s + Number(p.valor), 0);
        const despesa = (despesas || []).filter(d => d.status === "pago").reduce((s, d) => s + Number(d.valor), 0);

        return {
          mes: m.label,
          receita: Math.round(receita),
          despesa: Math.round(despesa),
          lucro: Math.round(receita - despesa),
          ticketMedio: allPagos.length > 0 ? Math.round(receita / allPagos.length) : 0,
        };
      });

      return Promise.all(allQueries);

    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  const { data: formaDistribution = [] } = useQuery({
    queryKey: ["finance-dashboard-formas-unified", activeClinicId, formasMap],
    queryFn: async () => {
      const map: Record<string, number> = {};

      // pagamentos (text field)
      let q1 = supabase.from("pagamentos").select("forma_pagamento, valor").eq("status", "pago" as any);
      if (activeClinicId) q1 = q1.eq("clinic_id", activeClinicId);
      const { data: d1 } = await q1;
      (d1 || []).forEach((p: any) => {
        const key = formaLabels[p.forma_pagamento] || p.forma_pagamento || "Outros";
        map[key] = (map[key] || 0) + Number(p.valor);
      });

      // pagamentos_mensalidade (FK)
      let q2 = supabase.from("pagamentos_mensalidade").select("forma_pagamento_id, valor").eq("status", "pago");
      if (activeClinicId) q2 = q2.eq("clinic_id", activeClinicId);
      const { data: d2 } = await q2;
      (d2 || []).forEach((p: any) => {
        const key = p.forma_pagamento_id ? (formasMap[p.forma_pagamento_id] || "Outros") : "Outros";
        map[key] = (map[key] || 0) + Number(p.valor);
      });

      // pagamentos_sessoes (FK)
      let q3 = supabase.from("pagamentos_sessoes").select("forma_pagamento_id, valor").eq("status", "pago");
      if (activeClinicId) q3 = q3.eq("clinic_id", activeClinicId);
      const { data: d3 } = await q3;
      (d3 || []).forEach((p: any) => {
        const key = p.forma_pagamento_id ? (formasMap[p.forma_pagamento_id] || "Outros") : "Outros";
        map[key] = (map[key] || 0) + Number(p.valor);
      });

      return Object.entries(map).map(([name, value]) => ({
        name,
        value: Math.round(value),
      }));
    },
    enabled: Object.keys(formasMap).length > 0 || formasPagamentoList.length === 0,
    staleTime: DASHBOARD_STALE_TIME,
  });

  // Analytics: outstanding payments (pendente + vencido)
  const { data: outstandingData } = useQuery({
    queryKey: ["finance-dashboard-outstanding", activeClinicId],
    queryFn: async () => {
      let q = supabase
        .from("pagamentos")
        .select("valor, status, data_vencimento")
        .eq("status", "pendente" as any);
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;
      const total = (data || []).reduce((s, p) => s + Number(p.valor), 0);
      const today = new Date();
      const vencido = (data || []).filter(p => {
        const dv = (p as any).data_vencimento;
        return dv && new Date(dv) < today;
      }).reduce((s, p) => s + Number(p.valor), 0);
      return { total, vencido, count: (data || []).length };
    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  // Analytics: pending commissions
  const { data: commissionsData } = useQuery({
    queryKey: ["finance-dashboard-commissions-pending", activeClinicId],
    queryFn: async () => {
      let q = (supabase.from("commissions") as any)
        .select("valor, status")
        .eq("status", "pendente");
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;
      return (data || []).reduce((s: number, c: any) => s + Number(c.valor), 0);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  // Analytics: cash flow projection (next 30 days = scheduled payments due)
  const { data: cashFlowProjection } = useQuery({
    queryKey: ["finance-dashboard-cashflow", activeClinicId],
    queryFn: async () => {
      const today = new Date();
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const todayStr = today.toISOString().split("T")[0];
      const in30DaysStr = in30Days.toISOString().split("T")[0];
      let q = supabase
        .from("pagamentos")
        .select("valor, status, data_vencimento")
        .eq("status", "pendente" as any)
        .gte("data_vencimento", todayStr)
        .lte("data_vencimento", in30DaysStr);
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;
      return (data || []).reduce((s, p) => s + Number(p.valor), 0);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  const lastMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];
  const growthRate = prevMonth?.receita && lastMonth?.receita
    ? (((lastMonth.receita - prevMonth.receita) / prevMonth.receita) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      {/* Primary KPI cards */}
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

      {/* Secondary analytics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4 text-destructive" /> A Receber (pendente)
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
              R$ {(commissionsData || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ArrowRightLeft className="h-4 w-4 text-blue-500" /> Previsão 30 dias
            </div>
            <p className="text-2xl font-bold text-blue-600">
              R$ {(cashFlowProjection || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Recebimentos agendados</p>
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
                <YAxis className="text-xs" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
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
                <Pie data={formaDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {formaDistribution.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
              <YAxis className="text-xs" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
              <Line type="monotone" dataKey="lucro" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Lucro" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
