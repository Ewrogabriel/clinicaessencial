import { useState, useEffect } from "react";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { AdminOnboardingWizard } from "@/components/onboarding/AdminOnboardingWizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Activity, AlertTriangle, ArrowRight, Trophy,
  CalendarCheck, Clock, TrendingUp, Lightbulb, PartyPopper,
  CheckCircle2, XCircle, RefreshCw, MessageCircle, UserPlus
} from "lucide-react";
import { DailyTipsCard } from "@/components/dashboard/DailyTipsCard";
import { RequestsCard } from "@/components/dashboard/RequestsCard";
import { ConvenioCard } from "@/components/dashboard/ConvenioCard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const tipoLabels: Record<string, string> = {
  fisioterapia: "Fisioterapia",
  pilates: "Pilates",
  rpg: "RPG",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, isAdmin, isGestor, isProfissional, isSecretario, loading } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Loading check moved after all hooks (below)

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
    queryKey: ["dashboard-finance", inicioMes, activeClinicId],
    queryFn: async () => {
      let pQ = (supabase.from("pagamentos") as any).select("valor, status").gte("data_pagamento", inicioMes).lte("data_pagamento", fimMes);
      let dQ = (supabase.from("expenses") as any).select("valor, status");
      let cQ = (supabase.from("commissions") as any).select("valor");
      if (activeClinicId) {
        pQ = pQ.eq("clinic_id", activeClinicId);
        dQ = dQ.eq("clinic_id", activeClinicId);
        cQ = cQ.eq("clinic_id", activeClinicId);
      }
      const { data: pagamentos } = await pQ;
      const { data: despesas } = await dQ;
      const { data: comissoes } = await cQ;

      const receita = (pagamentos || [])?.filter((p: any) => p.status === 'pago').reduce((acc: number, p: any) => acc + Number(p.valor), 0) || 0;
      const custos = (despesas || [])?.filter((d: any) => d.status === 'pago').reduce((acc: number, d: any) => acc + Number(d.valor), 0) || 0;
      const repasses = (comissoes || [])?.reduce((acc: number, c: any) => acc + Number(c.valor), 0) || 0;

      return { receita, custos, repasses, lucro: receita - custos - repasses };
    },
  });

  const { data: alertCount = 0 } = useQuery({
    queryKey: ["dashboard-alerts", activeClinicId],
    queryFn: async () => {
      let q = (supabase.from("pagamentos") as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
        .lte("data_vencimento", new Date().toISOString().split("T")[0]);
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  // Today's agenda stats
  const { data: todayStats } = useQuery({
    queryKey: ["dashboard-today-stats", activeClinicId],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      let q = (supabase.from("agendamentos") as any)
        .select("id, status")
        .gte("data_horario", todayStart)
        .lte("data_horario", todayEnd);
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;
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

  // Monthly sessions chart data (last 6 months)
  const { data: monthlyChart = [] } = useQuery({
    queryKey: ["dashboard-monthly-chart"],
    queryFn: async () => {
      const months: { label: string; start: string; end: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        months.push({
          label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          start: d.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
        });
      }
      const results = [];
      for (const m of months) {
        const { data } = await (supabase.from("agendamentos") as any)
          .select("status")
          .gte("data_horario", `${m.start}T00:00:00`)
          .lte("data_horario", `${m.end}T23:59:59`);
        const all = data || [];
        results.push({
          mes: m.label,
          realizadas: all.filter((a: any) => a.status === "realizado").length,
          faltas: all.filter((a: any) => a.status === "falta").length,
          canceladas: all.filter((a: any) => a.status === "cancelado").length,
        });
      }
      return results;
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

  // Role-based tip type
  const tipRole = isAdmin ? "admin" : isGestor ? "admin" : isSecretario ? "secretario" : "profissional";

  // Upcoming Birthdays
  const birthdays: any[] = []; // get_upcoming_birthdays RPC not yet created

  // Pending plan sessions (pendente status)
  const { data: pendingSessions = [] } = useQuery({
    queryKey: ["dashboard-pending-sessions", activeClinicId],
    queryFn: async () => {
      let q = (supabase.from("agendamentos") as any)
        .select("id, data_horario, status, tipo_atendimento, pacientes(nome), observacoes")
        .eq("status", "pendente")
        .order("data_horario", { ascending: true })
        .limit(10);
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Today's Detailed Agenda
  const { data: todayAgenda = [] } = useQuery({
    queryKey: ["dashboard-today-agenda", activeClinicId],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      let q = (supabase.from("agendamentos") as any)
        .select("*, pacientes(nome, telefone)")
        .gte("data_horario", todayStart)
        .lte("data_horario", todayEnd)
        .order("data_horario", { ascending: true });
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Past Sessions (Yesterday)
  const { data: pastAgenda = [] } = useQuery({
    queryKey: ["dashboard-past-agenda", activeClinicId],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastStart = startOfDay(yesterday).toISOString();
      const pastEnd = endOfDay(yesterday).toISOString();
      let q = (supabase.from("agendamentos") as any)
        .select("*, pacientes(nome, telefone)")
        .gte("data_horario", pastStart)
        .lte("data_horario", pastEnd)
        .order("data_horario", { ascending: false });
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Professionals for the re-assignment dialog
  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-dashboard"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["profissional", "admin", "gestor"]);

      const userIds = roles?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome, telefone")
        .in("user_id", userIds);

      if (error) throw error;
      return data || [];
    },
  });

  // Quick Action Mutations
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from("agendamentos") as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-today-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-past-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-today-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending-sessions"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const updateProfessional = useMutation({
    mutationFn: async ({ id, profissional_id }: { id: string; profissional_id: string }) => {
      const { error } = await (supabase.from("agendamentos") as any).update({ profissional_id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-today-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-past-agenda"] });
      toast({ title: "Profissional alterado com sucesso!" });
    },
  });

  const sendBirthdayWishes = (name: string, phone: string) => {
    const firstName = name.split(" ")[0];
    const senderName = profile?.nome?.split(" ")[0] || "Equipe";
    const message = `Olá ${firstName}! Feliz aniversário! 🎂🎉 O(A) profissional ${senderName} e toda a equipe da clínica desejam que seu dia seja repleto de alegrias e realizações. Parabéns!`;
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const saudacao =
    hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const ativos = (pacientes || []).filter((p: any) => p.status === "ativo");
  const recentes = (pacientes || []).slice(0, 5);

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

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <AdminOnboardingWizard />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
            {saudacao}{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-full text-sm">
            <Clock className="h-4 w-4 text-primary" />
            {format(currentTime, "HH:mm:ss")}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              const link = `${window.location.origin}/pre-cadastro`;
              const msg = `Olá! 👋\n\nPara agilizar seu cadastro em nossa clínica, preencha o formulário abaixo:\n\n📋 ${link}\n\nÉ rápido e fácil! Qualquer dúvida, estamos à disposição. 😊`;
              const encoded = encodeURIComponent(msg);
              window.open(`https://wa.me/?text=${encoded}`, "_blank");
            }}
          >
            <UserPlus className="h-4 w-4" /> Enviar Pré-Cadastro
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
            onClick={() => window.open(`https://wa.me/5581900000000`, "_blank")}
          >
            <MessageCircle className="h-4 w-4" /> Falar com a Clínica
          </Button>
        </div>
      </div>

      {/* Dicas do Dia - AI powered */}
      <DailyTipsCard tipo={tipRole} />

      <ConvenioCard />

      {/* Birthdays - compact in the top row if present */}
      {birthdays.length > 0 && (
        <Card className="border-pink-200 bg-pink-50/50">
          <CardHeader className="py-3">
            <CardTitle className="text-md flex items-center gap-2 text-pink-700">
              <PartyPopper className="h-5 w-5" />
              Aniversariantes da Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-wrap gap-2">
              {birthdays.map((b: any) => (
                <Badge key={b.id} variant="outline" className="bg-white border-pink-200 text-pink-700 py-1.5 px-3 gap-2 flex items-center cursor-pointer hover:bg-pink-100 transition-colors"
                  onClick={() => sendBirthdayWishes(b.nome, b.telefone)}>
                  <span className="font-bold">{b.nome}</span>
                  <span className="text-[10px] opacity-70">
                    {b.dia_aniversario === hoje.getDate() && b.mes_aniversario === (hoje.getMonth() + 1) ? "HOJE! 🎂" : `${b.dia_aniversario}/${b.mes_aniversario}`}
                  </span>
                  <MessageCircle className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Monthly Chart */}
      {monthlyChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Sessões por Mês (Últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="realizadas" name="Realizadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="faltas" name="Faltas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="canceladas" name="Canceladas" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* All Requests Card */}
      <RequestsCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
              Hoje na Agenda
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/agenda")}>
              Ver completa <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {todayAgenda.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento para hoje.</p>
            ) : (
              <div className="space-y-4">
                {todayAgenda.map((item: any) => (
                  <div key={item.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/30 group">
                    <div className="min-w-0">
                      <p className="font-bold text-sm cursor-pointer hover:text-primary transition-colors" onClick={() => { setSelectedSession(item); setIsDetailOpen(true); }}>
                        {format(new Date(item.data_horario), "HH:mm")} - {" "}
                        <span>{item.pacientes?.nome}</span>
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {item.tipo_atendimento} • {item.status}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.status === "agendado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Confirmar Presença"
                          className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => updateStatus.mutate({ id: item.id, status: "confirmado" })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      {(item.status === "agendado" || item.status === "confirmado") && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Check-in (Realizado)"
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => updateStatus.mutate({ id: item.id, status: "realizado" })}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Marcar Falta"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => updateStatus.mutate({ id: item.id, status: "falta" })}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        title="Falar com Profissional"
                        className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        onClick={() => {
                          const prof = profissionais.find((p: any) => p.user_id === item.profissional_id);
                          const cleanPhone = prof?.telefone?.replace(/\D/g, "");
                          if (cleanPhone) {
                            const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                            window.open(`https://wa.me/${fullPhone}`, "_blank");
                          } else {
                            toast({ title: "Profissional sem telefone cadastrado", variant: "destructive" });
                          }
                        }}
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        title="WhatsApp Paciente"
                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => {
                          const cleanPhone = item.pacientes?.telefone?.replace(/\D/g, "");
                          if (cleanPhone) {
                            const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                            window.open(`https://wa.me/${fullPhone}`, "_blank");
                          } else {
                            toast({ title: "Paciente sem telefone cadastrado", variant: "destructive" });
                          }
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Reagendar"
                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          // Ideally open ReagendamentoDialog or navigate
                          navigate(`/pacientes/${item.paciente_id}/detalhes`);
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Cancelar Sessão"
                        className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        onClick={() => updateStatus.mutate({ id: item.id, status: "cancelado" })}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessões Passadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Sessões Anteriores (Ontem)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pastAgenda.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sessão registrada ontem.</p>
            ) : (
              <div className="space-y-4">
                {pastAgenda.map((item: any) => (
                  <div key={item.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/10 group">
                    <div className="min-w-0">
                      <p className="font-medium text-sm cursor-pointer hover:text-primary transition-colors" onClick={() => { setSelectedSession(item); setIsDetailOpen(true); }}>
                        {format(new Date(item.data_horario), "HH:mm")} - {" "}
                        <span>{item.pacientes?.nome}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={
                          item.status === "realizado" ? "default" :
                            item.status === "falta" ? "destructive" :
                              item.status === "cancelado" ? "outline" : "secondary"
                        } className="text-[10px] h-4 px-1">
                          {item.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          Prof: {profissionais.find((p: any) => p.user_id === item.profissional_id)?.nome || "Não definido"}
                        </span>
                      </div>
                    </div>
                    {item.status === "falta" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => navigate(`/pacientes/${item.paciente_id}/detalhes`)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Reagendar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                      <p
                        className="text-sm font-medium truncate hover:underline cursor-pointer text-primary"
                        onClick={() => navigate(`/pacientes/${p.id}/detalhes`)}
                      >
                        {p.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.telefone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => {
                        const cleanPhone = p.telefone?.replace(/\D/g, "");
                        if (cleanPhone) {
                          const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                          window.open(`https://wa.me/${fullPhone}`, "_blank");
                        } else {
                          toast({ title: "Paciente sem telefone cadastrado", variant: "destructive" });
                        }
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
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
      {/* Session Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Detalhes da Sessão</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Paciente</p>
                  <p className="font-medium">{selectedSession.pacientes?.nome}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Horário</p>
                  <p className="font-medium">{format(new Date(selectedSession.data_horario), "HH:mm 'em' dd/MM")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Modalidade</p>
                  <p className="font-medium capitalize">{selectedSession.tipo_atendimento}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Status</p>
                  <Badge variant={
                    selectedSession.status === "realizado" ? "default" :
                      selectedSession.status === "falta" ? "destructive" :
                        selectedSession.status === "confirmado" ? "secondary" : "outline"
                  }>
                    {selectedSession.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Profissional Responsável</Label>
                <div className="flex gap-2">
                  <Select
                    defaultValue={selectedSession.profissional_id}
                    onValueChange={(val) => updateProfessional.mutate({ id: selectedSession.id, profissional_id: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {profissionais.map((p: any) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Alterar o profissional recalcula as comissões automaticamente.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => navigate(`/pacientes/${selectedSession.paciente_id}/detalhes`)}>
                  Ver Paciente
                </Button>
                <Button size="sm" onClick={() => setIsDetailOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
