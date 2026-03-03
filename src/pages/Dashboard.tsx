import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Activity, AlertTriangle, ArrowRight, Trophy, CalendarCheck, Clock, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInYears, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts';

const tipoLabels: Record<string, string> = {
  fisioterapia: "Fisioterapia",
  pilates: "Pilates",
  rpg: "RPG",
};

const AGE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#4f46e5'];

const getAgeDistribution = (pacientes: any[]) => {
  const ranges = [
    { label: '0-17', min: 0, max: 17 },
    { label: '18-30', min: 18, max: 30 },
    { label: '31-45', min: 31, max: 45 },
    { label: '46-60', min: 46, max: 60 },
    { label: '61-75', min: 61, max: 75 },
    { label: '76+', min: 76, max: 200 },
  ];

  const today = new Date();
  const counts = ranges.map(r => ({ name: r.label, value: 0 }));
  let semData = 0;

  pacientes.forEach((p: any) => {
    if (!p.data_nascimento) { semData++; return; }
    const age = differenceInYears(today, new Date(p.data_nascimento));
    const idx = ranges.findIndex(r => age >= r.min && age <= r.max);
    if (idx >= 0) counts[idx].value++;
  });

  if (semData > 0) counts.push({ name: 'Sem data', value: semData });
  return counts.filter(c => c.value > 0);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("pacientes") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: financeData } = useQuery({
    queryKey: ["dashboard-finance", inicioMes],
    queryFn: async () => {
      const { data: pagamentos } = await (supabase.from("pagamentos") as any).select("valor, status").gte("data_pagamento", inicioMes).lte("data_pagamento", fimMes);
      const { data: despesas } = await (supabase.from("expenses") as any).select("valor, status");
      const { data: comissoes } = await (supabase.from("commissions") as any).select("valor");

      const receita = (pagamentos || [])?.filter((p: any) => p.status === 'pago').reduce((acc: number, p: any) => acc + Number(p.valor), 0) || 0;
      const custos = (despesas || [])?.filter((d: any) => d.status === 'pago').reduce((acc: number, d: any) => acc + Number(d.valor), 0) || 0;
      const repasses = (comissoes || [])?.reduce((acc: number, c: any) => acc + Number(c.valor), 0) || 0;

      return { receita, custos, repasses, lucro: receita - custos - repasses };
    },
  });

  const { data: alertCount = 0 } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { count } = await (supabase.from("pagamentos") as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
        .lte("data_vencimento", new Date().toISOString().split("T")[0]);
      return count ?? 0;
    },
  });

  // Today's agenda stats
  const { data: todayStats } = useQuery({
    queryKey: ["dashboard-today-stats"],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const { data } = await (supabase.from("agendamentos") as any)
        .select("id, status")
        .gte("data_horario", todayStart)
        .lte("data_horario", todayEnd);
      const all = data || [];
      return {
        total: all.length,
        realizados: all.filter((a: any) => a.status === "realizado").length,
        confirmados: all.filter((a: any) => a.status === "confirmado" || a.status === "agendado").length,
        faltas: all.filter((a: any) => a.status === "falta").length,
      };
    },
  });

  // Occupancy rate (this month)
  const { data: occupancyRate = 0 } = useQuery({
    queryKey: ["dashboard-occupancy", inicioMes],
    queryFn: async () => {
      const { data: disp } = await (supabase.from("disponibilidade_profissional") as any)
        .select("hora_inicio, hora_fim, max_pacientes, dia_semana")
        .eq("ativo", true);
      const { data: agendamentosMes } = await (supabase.from("agendamentos") as any)
        .select("id")
        .gte("data_horario", `${inicioMes}T00:00:00`)
        .lte("data_horario", `${fimMes}T23:59:59`)
        .in("status", ["agendado", "confirmado", "realizado"]);
      
      // Estimate total slots per month (availability * ~4 weeks)
      const totalSlots = (disp || []).reduce((sum: number, d: any) => sum + (d.max_pacientes || 1), 0) * 4;
      if (totalSlots === 0) return 0;
      return Math.min(100, Math.round(((agendamentosMes || []).length / totalSlots) * 100));
    },
  });
  // Ranking de frequência - pacientes que menos cancelam
  const { data: frequencyRanking = [] } = useQuery({
    queryKey: ["dashboard-frequency-ranking"],
    queryFn: async () => {
      const { data: agendamentos } = await (supabase.from("agendamentos") as any)
        .select("paciente_id, status, pacientes(nome)");
      if (!agendamentos) return [];

      const stats: Record<string, { nome: string; total: number; cancelados: number; realizados: number; checkins: number }> = {};
      agendamentos.forEach((ag: any) => {
        const pid = ag.paciente_id;
        if (!stats[pid]) {
          stats[pid] = { nome: ag.pacientes?.nome || "?", total: 0, cancelados: 0, realizados: 0, checkins: 0 };
        }
        stats[pid].total++;
        if (ag.status === "cancelado" || ag.status === "falta") stats[pid].cancelados++;
        if (ag.status === "realizado") stats[pid].realizados++;
      });

      return Object.entries(stats)
        .map(([id, s]) => ({
          id,
          nome: s.nome,
          total: s.total,
          cancelados: s.cancelados,
          realizados: s.realizados,
          taxa: s.total > 0 ? Math.round(((s.total - s.cancelados) / s.total) * 100) : 0,
        }))
        .sort((a, b) => b.taxa - a.taxa || b.realizados - a.realizados)
        .slice(0, 10);
    },
  });

  const ativos = (pacientes || []).filter((p: any) => p.status === "ativo");
  const recentes = (pacientes || []).slice(0, 5);
  const ageData = getAgeDistribution(pacientes);

  const saudacao =
    hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const stats = [
    {
      title: "Pacientes Ativos",
      value: String(ativos.length),
      icon: Users,
      description: ativos.length === 0 ? "Nenhum paciente ativo" : `de ${pacientes.length} cadastrados`,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "Agenda Hoje",
      value: String(todayStats?.total || 0),
      icon: CalendarCheck,
      description: todayStats?.confirmados ? `${todayStats.confirmados} pendentes · ${todayStats.realizados} realizados` : "Nenhum agendamento",
      color: "text-blue-600 bg-blue-50",
    },
    {
      title: "Ocupação (Mês)",
      value: `${occupancyRate}%`,
      icon: TrendingUp,
      description: occupancyRate >= 80 ? "Alta demanda" : occupancyRate >= 50 ? "Demanda moderada" : "Baixa ocupação",
      color: occupancyRate >= 80 ? "text-emerald-600 bg-emerald-50" : occupancyRate >= 50 ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50",
    },
    {
      title: "Receita do Mês",
      value: `R$ ${((financeData?.receita || 0) / 1000).toFixed(1)}k`,
      icon: Activity,
      description: `Lucro: R$ ${((financeData?.lucro || 0) / 1000).toFixed(1)}k`,
      color: "text-violet-600 bg-violet-50",
    },
    {
      title: "Alertas",
      value: String(alertCount),
      icon: AlertTriangle,
      description: alertCount === 0 ? "Nenhum atraso" : `${alertCount} pagamento(s) em atraso`,
      color: alertCount > 0 ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50",
    },
  ];

  const chartData = [
    { name: 'Receita', valor: financeData?.receita || 0, color: '#10b981' },
    { name: 'Despesas', valor: financeData?.custos || 0, color: '#ef4444' },
    { name: 'Comissões', valor: financeData?.repasses || 0, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          {saudacao}{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground flex items-center gap-2">
          {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          <span className="inline-flex items-center gap-1 text-foreground font-medium">
            <Clock className="h-4 w-4" />
            {format(currentTime, "HH:mm:ss")}
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pacientes por Faixa Etária</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              {ageData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nenhum paciente cadastrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {ageData.map((_, index) => (
                        <Cell key={`age-${index}`} fill={AGE_COLORS[index % AGE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
      </div>

      {/* Ranking de Frequência */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking de Frequência
          </CardTitle>
          <Badge variant="secondary" className="text-xs">Top 10</Badge>
        </CardHeader>
        <CardContent>
          {frequencyRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados de agendamentos ainda</p>
          ) : (
            <div className="space-y-2">
              {frequencyRanking.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}º
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.realizados} realizados · {p.cancelados} cancelados</p>
                  </div>
                  <Badge variant={p.taxa >= 80 ? "default" : p.taxa >= 50 ? "secondary" : "destructive"} className="text-xs">
                    {p.taxa}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Pacientes Recentes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/pacientes")}>
            Ver todos <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhum paciente cadastrado ainda</p>
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => navigate("/pacientes/novo")}
              >
                Cadastrar primeiro paciente <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentes.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {(p.nome || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.telefone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px]">
                      {tipoLabels[p.tipo_atendimento] || p.tipo_atendimento}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
