import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, DollarSign, Target } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export const FinanceDashboard = () => {
  const { activeClinicId } = useClinic();

  const { data: monthlyData = [] } = useQuery({
    queryKey: ["finance-dashboard-monthly", activeClinicId],
    queryFn: async () => {
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), 5 - i);
        return {
          start: startOfMonth(d).toISOString(),
          end: endOfMonth(d).toISOString(),
          label: format(d, "MMM", { locale: ptBR }),
          month: format(d, "yyyy-MM"),
        };
      });

      const results = [];
      for (const m of months) {
        let pQuery = supabase.from("pagamentos").select("valor, status").gte("data_pagamento", m.start).lte("data_pagamento", m.end);
        if (activeClinicId) pQuery = pQuery.eq("clinic_id", activeClinicId);
        const { data: pagamentos } = await pQuery;

        let eQuery = supabase.from("expenses").select("valor, status").gte("created_at", m.start).lte("created_at", m.end);
        if (activeClinicId) eQuery = eQuery.eq("clinic_id", activeClinicId);
        const { data: despesas } = await eQuery;

        const receita = (pagamentos || []).filter(p => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0);
        const despesa = (despesas || []).filter(d => d.status === "pago").reduce((s, d) => s + Number(d.valor), 0);
        const countPagos = (pagamentos || []).filter(p => p.status === "pago").length;

        results.push({
          mes: m.label,
          receita: Math.round(receita),
          despesa: Math.round(despesa),
          lucro: Math.round(receita - despesa),
          ticketMedio: countPagos > 0 ? Math.round(receita / countPagos) : 0,
        });
      }
      return results;
    },
  });

  const { data: formaDistribution = [] } = useQuery({
    queryKey: ["finance-dashboard-formas", activeClinicId],
    queryFn: async () => {
      let q = supabase.from("pagamentos").select("forma_pagamento, valor").eq("status", "pago");
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;

      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        const key = p.forma_pagamento || "outros";
        map[key] = (map[key] || 0) + Number(p.valor);
      });

      const labels: Record<string, string> = {
        pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito",
        cartao_debito: "Cartão Débito", boleto: "Boleto", transferencia: "Transferência", outros: "Outros",
      };

      return Object.entries(map).map(([key, value]) => ({
        name: labels[key] || key,
        value: Math.round(value),
      }));
    },
  });

  const lastMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];
  const growthRate = prevMonth?.receita && lastMonth?.receita
    ? (((lastMonth.receita - prevMonth.receita) / prevMonth.receita) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      {/* KPI row */}
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

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expenses */}
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

        {/* Payment Methods Pie */}
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

      {/* Profit trend */}
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
