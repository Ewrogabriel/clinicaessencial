import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CalendarCheck, DollarSign, XCircle, TrendingUp, Clock, CheckCircle2, AlertTriangle, UserPlus, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { DailyTipsCard } from "@/components/dashboard/DailyTipsCard";
import { RequestsCard } from "@/components/dashboard/RequestsCard";
import { ConvenioCard } from "@/components/dashboard/ConvenioCard";

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"];

const ProfessionalDashboard = () => {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const hoje = new Date();
  const mesInicio = format(startOfMonth(hoje), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(hoje), "yyyy-MM-dd");

  // Active patients count (patients with active enrollments for this professional)
  const { data: activePatients = 0 } = useQuery({
    queryKey: ["prof-kpi-patients", userId],
    queryFn: async () => {
      const { count } = await (supabase.from("matriculas") as any)
        .select("paciente_id", { count: "exact", head: true })
        .eq("profissional_id", userId)
        .eq("status", "ativa");
      return count ?? 0;
    },
    enabled: !!userId,
  });

  // This month sessions
  const { data: monthSessions } = useQuery({
    queryKey: ["prof-kpi-sessions", userId, mesInicio],
    queryFn: async () => {
      const { data } = await (supabase.from("agendamentos") as any)
        .select("id, status")
        .eq("profissional_id", userId)
        .gte("data_horario", `${mesInicio}T00:00:00`)
        .lte("data_horario", `${mesFim}T23:59:59`);
      const all = data || [];
      return {
        total: all.length,
        realizadas: all.filter((a: any) => a.status === "realizado").length,
        faltas: all.filter((a: any) => a.status === "falta").length,
        canceladas: all.filter((a: any) => a.status === "cancelado").length,
        agendadas: all.filter((a: any) => a.status === "agendado" || a.status === "confirmado").length,
      };
    },
    enabled: !!userId,
  });

  // Revenue (commissions)
  const { data: revenue = 0 } = useQuery({
    queryKey: ["prof-kpi-revenue", userId, mesInicio],
    queryFn: async () => {
      const { data } = await (supabase.from("commissions") as any)
        .select("valor")
        .eq("professional_id", userId)
        .gte("created_at", `${mesInicio}T00:00:00`)
        .lte("created_at", `${mesFim}T23:59:59`);
      return (data || []).reduce((sum: number, c: any) => sum + Number(c.valor), 0);
    },
    enabled: !!userId,
  });

  // Today's agenda
  const { data: todayAgenda = [] } = useQuery({
    queryKey: ["prof-today-agenda", userId],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const { data } = await (supabase.from("agendamentos") as any)
        .select("*, pacientes(nome)")
        .eq("profissional_id", userId)
        .gte("data_horario", todayStart)
        .lte("data_horario", todayEnd)
        .order("data_horario", { ascending: true });
      return data || [];
    },
    enabled: !!userId,
  });

  // Monthly chart (last 6 months)
  const { data: monthlyChart = [] } = useQuery({
    queryKey: ["prof-monthly-chart", userId],
    queryFn: async () => {
      const results = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const start = format(d, "yyyy-MM-dd");
        const endStr = format(end, "yyyy-MM-dd");
        const { data } = await (supabase.from("agendamentos") as any)
          .select("status")
          .eq("profissional_id", userId)
          .gte("data_horario", `${start}T00:00:00`)
          .lte("data_horario", `${endStr}T23:59:59`);
        const all = data || [];
        results.push({
          mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          realizadas: all.filter((a: any) => a.status === "realizado").length,
          faltas: all.filter((a: any) => a.status === "falta").length,
          canceladas: all.filter((a: any) => a.status === "cancelado").length,
        });
      }
      return results;
    },
    enabled: !!userId,
  });

  const faltaRate = monthSessions && monthSessions.total > 0
    ? Math.round((monthSessions.faltas / monthSessions.total) * 100)
    : 0;

  const statusPie = monthSessions ? [
    { name: "Realizadas", value: monthSessions.realizadas },
    { name: "Faltas", value: monthSessions.faltas },
    { name: "Canceladas", value: monthSessions.canceladas },
    { name: "Pendentes", value: monthSessions.agendadas },
  ].filter(s => s.value > 0) : [];

  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const kpis = [
    {
      title: "Pacientes Ativos",
      value: String(activePatients),
      icon: Users,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "Sessões do Mês",
      value: String(monthSessions?.total || 0),
      icon: CalendarCheck,
      description: `${monthSessions?.realizadas || 0} realizadas`,
      color: "text-blue-600 bg-blue-50",
    },
    {
      title: "Comissão do Mês",
      value: `R$ ${revenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-violet-600 bg-violet-50",
    },
    {
      title: "Taxa de Faltas",
      value: `${faltaRate}%`,
      icon: faltaRate > 15 ? AlertTriangle : CheckCircle2,
      description: `${monthSessions?.faltas || 0} faltas`,
      color: faltaRate > 15 ? "text-red-600 bg-red-50" : "text-emerald-600 bg-emerald-50",
    },
  ];

  const statusColors: Record<string, string> = {
    agendado: "bg-blue-100 text-blue-700",
    confirmado: "bg-emerald-100 text-emerald-700",
    realizado: "bg-gray-100 text-gray-600",
    cancelado: "bg-red-100 text-red-700",
    falta: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          {saudacao}{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground">
          {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            const link = `${window.location.origin}/pre-cadastro`;
            const msg = `Olá! 👋\n\nPara agilizar seu cadastro em nossa clínica, preencha o formulário abaixo:\n\n📋 ${link}\n\nÉ rápido e fácil! Qualquer dúvida, estamos à disposição. 😊`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
          }}
        >
          <UserPlus className="h-4 w-4" /> Enviar Pré-Cadastro
        </Button>
      </div>

      <DailyTipsCard tipo="profissional" />

      <ConvenioCard />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`rounded-lg p-2 ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              {kpi.description && <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* All Requests Card */}
      <RequestsCard />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Chart */}
        {monthlyChart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Desempenho Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="realizadas" fill="#10b981" name="Realizadas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="faltas" fill="#ef4444" name="Faltas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="canceladas" fill="#f59e0b" name="Canceladas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Status Pie */}
        {statusPie.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição do Mês</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Today's Agenda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Agenda de Hoje ({todayAgenda.length} sessões)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayAgenda.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Nenhuma sessão agendada para hoje.</p>
          ) : (
            <div className="divide-y">
              {todayAgenda.map((ag: any) => (
                <div key={ag.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">{ag.pacientes?.nome || "Paciente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ag.data_horario), "HH:mm")} • {ag.tipo_atendimento} • {ag.duracao_minutos}min
                    </p>
                  </div>
                  <Badge className={statusColors[ag.status] || ""}>
                    {ag.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfessionalDashboard;
