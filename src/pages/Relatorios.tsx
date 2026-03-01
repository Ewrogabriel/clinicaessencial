import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, Users, DollarSign, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(168, 65%, 38%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(142, 71%, 45%)"];

const Relatorios = () => {
  const { clinicId } = useAuth();

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["relatorio-agendamentos", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await (supabase.from("agendamentos") as any)
        .select("id, data_horario, tipo_atendimento, tipo_sessao, status, profissional_id")
        .eq("clinic_id", clinicId)
        .gte("data_horario", subMonths(new Date(), 6).toISOString())
        .order("data_horario", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["relatorio-pagamentos", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data } = await (supabase.from("pagamentos") as any)
        .select("id, valor, data_pagamento, status, forma_pagamento")
        .eq("clinic_id", clinicId)
        .gte("data_pagamento", format(subMonths(new Date(), 6), "yyyy-MM-dd"))
        .order("data_pagamento", { ascending: true });
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: pacientesCount = 0 } = useQuery({
    queryKey: ["relatorio-pacientes", clinicId],
    queryFn: async () => {
      if (!clinicId) return 0;
      const { count } = await (supabase.from("pacientes") as any).select("id", { count: "exact", head: true }).eq("status", "ativo").eq("clinic_id", clinicId);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  // Monthly revenue chart
  const monthlyRevenue = () => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(new Date(), i);
      const key = format(m, "MMM/yy", { locale: ptBR });
      months[key] = 0;
    }
    (pagamentos as any[]).filter((p) => p.status === "pago").forEach((p) => {
      const key = format(new Date(p.data_pagamento), "MMM/yy", { locale: ptBR });
      if (key in months) months[key] += Number(p.valor);
    });
    return Object.entries(months).map(([name, valor]) => ({ name, valor }));
  };

  // Appointments by type — dynamic (works with any modality)
  const byType = () => {
    const counts: Record<string, number> = {};
    (agendamentos as any[]).forEach((a) => {
      const tipo = a.tipo_atendimento || "Outros";
      counts[tipo] = (counts[tipo] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  };

  // Appointments by status
  const byStatus = () => {
    const counts: Record<string, number> = {};
    (agendamentos as any[]).forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    const labels: Record<string, string> = { agendado: "Agendado", confirmado: "Confirmado", realizado: "Realizado", cancelado: "Cancelado", falta: "Falta" };
    return Object.entries(counts).map(([key, value]) => ({ name: labels[key] || key, value }));
  };

  const totalRecebido = (pagamentos as any[]).filter((p) => p.status === "pago").reduce((s: number, p) => s + Number(p.valor), 0);
  const totalAtendimentos = (agendamentos as any[]).filter((a) => a.status === "realizado").length;

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
