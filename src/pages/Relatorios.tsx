import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, Users, DollarSign, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(168, 65%, 38%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(142, 71%, 45%)"];

const Relatorios = () => {
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["relatorio-agendamentos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("agendamentos")
        .select("id, data_horario, tipo_atendimento, tipo_sessao, status, profissional_id, profiles!agendamentos_profissional_id_fkey(nome)")
        .gte("data_horario", subMonths(new Date(), 6).toISOString())
        .order("data_horario", { ascending: true });
      return data ?? [];
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["relatorio-pagamentos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pagamentos")
        .select("id, valor, data_pagamento, status, forma_pagamento")
        .gte("data_pagamento", format(subMonths(new Date(), 6), "yyyy-MM-dd"))
        .order("data_pagamento", { ascending: true });
      return data ?? [];
    },
  });

  const { data: pacientesCount = 0 } = useQuery({
    queryKey: ["relatorio-pacientes"],
    queryFn: async () => {
      const { count } = await supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("status", "ativo");
      return count ?? 0;
    },
  });

  // Monthly revenue chart
  const monthlyRevenue = () => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(new Date(), i);
      const key = format(m, "MMM/yy", { locale: ptBR });
      months[key] = 0;
    }
    pagamentos.filter((p: any) => p.status === "pago").forEach((p: any) => {
      const key = format(new Date(p.data_pagamento), "MMM/yy", { locale: ptBR });
      if (key in months) months[key] += Number(p.valor);
    });
    return Object.entries(months).map(([name, valor]) => ({ name, valor }));
  };

  // Appointments by type
  const byType = () => {
    const counts: Record<string, number> = { fisioterapia: 0, pilates: 0, rpg: 0 };
    agendamentos.forEach((a: any) => { if (a.tipo_atendimento in counts) counts[a.tipo_atendimento]++; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  };

  // Appointments by status
  const byStatus = () => {
    const counts: Record<string, number> = {};
    agendamentos.forEach((a: any) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    const labels: Record<string, string> = { agendado: "Agendado", confirmado: "Confirmado", realizado: "Realizado", cancelado: "Cancelado", falta: "Falta" };
    return Object.entries(counts).map(([key, value]) => ({ name: labels[key] || key, value }));
  };

  const totalRecebido = pagamentos.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const totalAtendimentos = agendamentos.filter((a: any) => a.status === "realizado").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">Análises de produtividade e faturamento</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Faturamento (6 meses)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">R$ {totalRecebido.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Atendimentos Realizados</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalAtendimentos}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Agendamentos</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{agendamentos.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pacientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{pacientesCount}</p></CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faturamento Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue()}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]} />
                <Bar dataKey="valor" fill="hsl(168, 65%, 38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atendimentos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byType()} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byType().map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status dos Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byStatus()} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byStatus().map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Relatorios;
