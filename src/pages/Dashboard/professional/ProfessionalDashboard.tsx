import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UserPlus, Clock, Calendar, Users, ClipboardList, DollarSign,
  Calculator, MessageSquare, FileText, Handshake, Video, Tag,
  Stethoscope, Dumbbell, Gift, ChevronRight, Phone,
  CheckCircle2, XCircle, AlertCircle, Play, Pause, RotateCcw
} from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { format, isSameDay, isAfter, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DailyTipsCard } from "@/components/dashboard/DailyTipsCard";
import { RequestsCard } from "@/components/dashboard/RequestsCard";
import { ConvenioCard } from "@/components/dashboard/ConvenioCard";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { DashboardAgenda } from "@/components/dashboard/DashboardAgenda";
import { useDashboardLayout, DashboardCard } from "@/modules/shared/hooks/useDashboardLayout";
import { AdvancedKPIs } from "@/components/profissionais/AdvancedKPIs";
import { PerformanceCharts } from "@/components/profissionais/PerformanceCharts";
import { AIInsightsPanel } from "@/components/profissionais/AIInsightsPanel";
import { useProfessionalAnalytics } from "@/modules/professionals/hooks/useProfessionalAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { toast } from "sonner";

const PROF_DEFAULT_CARDS: DashboardCard[] = [
  { id: "today-agenda", label: "Agenda de Hoje", visible: true },
  { id: "birthdays", label: "Aniversariantes", visible: true },
  { id: "kpis", label: "Indicadores (KPIs)", visible: true },
  { id: "commissions", label: "Prévia de Comissões", visible: true },
  { id: "tips", label: "Dicas do Dia", visible: true },
  { id: "convenios", label: "Convênios & Parceiros", visible: true },
  { id: "requests", label: "Solicitações", visible: true },
  { id: "ai-insights", label: "Insights IA", visible: true },
  { id: "charts", label: "Gráficos de Performance", visible: true },
];

const ProfessionalDashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { activeClinic: clinicaAtual } = useClinic();
  const hoje = new Date();
  const { kpis, kpisLoading, trends, heatmap, todayAgenda } = useProfessionalAnalytics();
  const { visibleCards, cards, reorderCards, toggleCard, resetToDefault } = useDashboardLayout("professional", PROF_DEFAULT_CARDS);

  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  // Buscar aniversariantes do mês
  const { data: aniversariantes } = useQuery({
    queryKey: ["aniversariantes-prof", user?.id],
    queryFn: async () => {
      const mesAtual = hoje.getMonth() + 1;
      // Pacientes don't have clinic_id directly; fetch all active patients
      const { data } = await (supabase
        .from("pacientes") as any)
        .select("id, nome, data_nascimento, telefone")
        .eq("status", "ativo")
        .not("data_nascimento", "is", null);

      // Filtrar aniversariantes do mês
      return (data || []).filter(p => {
        if (!p.data_nascimento) return false;
        const dataNasc = new Date(p.data_nascimento);
        return dataNasc.getMonth() + 1 === mesAtual;
      }).sort((a, b) => {
        const dayA = new Date(a.data_nascimento!).getDate();
        const dayB = new Date(b.data_nascimento!).getDate();
        return dayA - dayB;
      });
    },
    enabled: !!user?.id,
  });

  // Buscar prévia de comissões do mês
  const { data: comissoesMes } = useQuery({
    queryKey: ["comissoes-previa", user?.id],
    queryFn: async () => {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

      // Fetch sessions and commission rate in parallel
      const [sessResult, profileResult] = await Promise.all([
        (supabase.from("agendamentos") as any)
          .select("valor_sessao, status")
          .eq("profissional_id", user?.id)
          .gte("data_horario", inicioMes.toISOString())
          .lte("data_horario", fimMes.toISOString())
          .eq("status", "realizado"),
        (supabase.from("profiles") as any)
          .select("commission_rate, commission_fixed")
          .eq("user_id", user?.id)
          .maybeSingle(),
      ]);

      const data = sessResult.data as any[] || [];
      const profProfile = profileResult.data;

      const totalSessoes = data.length;
      const valorTotal = data.reduce((acc: number, s: any) => acc + (Number(s.valor_sessao) || 0), 0);
      
      // Use commission_rate from profiles table, fallback to 40%
      const commissionRate = profProfile?.commission_rate ? Number(profProfile.commission_rate) : 40;
      const commissionFixed = profProfile?.commission_fixed ? Number(profProfile.commission_fixed) : 0;
      const comissaoEstimada = commissionFixed > 0
        ? commissionFixed * totalSessoes
        : valorTotal * (commissionRate / 100);

      return { totalSessoes, valorTotal, comissaoEstimada, commissionRate };
    },
    enabled: !!user?.id,
  });

  const statusPie = kpis ? [
    { name: "Realizadas", value: kpis.realizadas },
    { name: "Faltas", value: kpis.faltas },
    { name: "Canceladas", value: kpis.canceladas },
    { name: "Pendentes", value: kpis.sessoesTotal - kpis.realizadas - kpis.faltas - kpis.canceladas },
  ].filter(s => s.value > 0) : [];

  const statusColors: Record<string, string> = {
    agendado: "bg-blue-100 text-blue-700",
    confirmado: "bg-emerald-100 text-emerald-700",
    realizado: "bg-gray-100 text-gray-600",
    cancelado: "bg-red-100 text-red-700",
    falta: "bg-amber-100 text-amber-700",
  };

  const isCardVisible = (id: string) => visibleCards.some(c => c.id === id);

  // Ações rápidas de sessão
  const handleSessionAction = async (sessionId: string, action: "check-in" | "realizado" | "falta" | "cancelado") => {
    try {
      const newStatus = action === "check-in" ? "confirmado" : action;
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: newStatus as any })
        .eq("id", sessionId);

      if (error) throw error;

      const messages: Record<string, string> = {
        "check-in": "Check-in realizado!",
        "realizado": "Sessão marcada como realizada!",
        "falta": "Falta registrada!",
        "cancelado": "Sessão cancelada!",
      };

      toast.success(messages[action]);
    } catch {
      toast.error("Erro ao atualizar sessão");
    }
  };

  // Quick actions menu items
  const quickActions = [
    { label: "Agendar Sessão", icon: Calendar, route: "/agenda", color: "text-primary", bg: "bg-primary/10" },
    { label: "Nova Matrícula", icon: UserPlus, route: "/matriculas", color: "text-emerald-600", bg: "bg-emerald-600/10" },
    { label: "Pacientes", icon: Users, route: "/pacientes", color: "text-purple-600", bg: "bg-purple-600/10" },
    { label: "Prontuários", icon: ClipboardList, route: "/prontuarios", color: "text-amber-600", bg: "bg-amber-600/10" },
    { label: "Documentos", icon: Stethoscope, route: "/documentos-clinicos", color: "text-teal-600", bg: "bg-teal-600/10" },
    { label: "Exercícios", icon: Dumbbell, route: "/planos-exercicios", color: "text-rose-600", bg: "bg-rose-600/10" },
    { label: "Teleconsulta", icon: Video, route: "/teleconsulta-hub", color: "text-indigo-600", bg: "bg-indigo-600/10" },
    { label: "Financeiro", icon: DollarSign, route: "/financeiro", color: "text-green-600", bg: "bg-green-600/10" },
    { label: "Comissões", icon: Calculator, route: "/comissoes", color: "text-orange-600", bg: "bg-orange-600/10" },
    { label: "Mensagens", icon: MessageSquare, route: "/mensagens", color: "text-sky-600", bg: "bg-sky-600/10" },
    { label: "Contratos", icon: FileText, route: "/contratos", color: "text-gray-600", bg: "bg-gray-600/10" },
    { label: "Convênios", icon: Handshake, route: "/convenios", color: "text-pink-600", bg: "bg-pink-600/10" },
    { label: "Produtos", icon: Tag, route: "/inventario", color: "text-cyan-600", bg: "bg-cyan-600/10" },
  ];

  const renderSection = (cardId: string) => {
    switch (cardId) {

      case "today-agenda":
        return <DashboardAgenda key="today-agenda" isAdmin={false} defaultProfissionalId={user?.id} />;

      case "birthdays":
        return (
          <Card key="birthdays">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                Aniversariantes do Mês ({aniversariantes?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!aniversariantes || aniversariantes.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Nenhum aniversariante este mês.</p>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {aniversariantes.slice(0, 10).map((p) => {
                    const dataNasc = new Date(p.data_nascimento!);
                    const diaAniversario = dataNasc.getDate();
                    const isToday = isSameDay(
                      new Date(hoje.getFullYear(), hoje.getMonth(), diaAniversario),
                      hoje
                    );

                    return (
                      <div key={p.id} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isToday ? "bg-pink-500 text-white" : "bg-pink-100 text-pink-600"}`}>
                            {diaAniversario}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.nome}</p>
                            {isToday && <Badge className="bg-pink-500 text-white text-xs">Hoje!</Badge>}
                          </div>
                        </div>
                        {p.telefone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            onClick={() => window.open(`https://wa.me/55${p.telefone?.replace(/\D/g, "")}?text=${encodeURIComponent(`Feliz aniversário, ${p.nome?.split(" ")[0]}! 🎉🎂`)}`, "_blank")}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "commissions":
        return (
          <Card key="commissions">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-orange-500" />
                Prévia de Comissões - {format(hoje, "MMMM", { locale: ptBR })}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate("/comissoes")}>
                Ver Detalhes <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{comissoesMes?.totalSessoes || 0}</p>
                  <p className="text-xs text-muted-foreground">Sessões Realizadas</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(comissoesMes?.valorTotal || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(comissoesMes?.comissaoEstimada || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Comissão Estimada</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "tips":
        return <DailyTipsCard key="tips" tipo="profissional" />;

      case "convenios":
        return <ConvenioCard key="convenios" />;

      case "kpis":
        return kpisLoading ? (
          <div key="kpis" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : kpis ? <AdvancedKPIs key="kpis" kpis={kpis} /> : null;

      case "requests":
        return <RequestsCard key="requests" />;

      case "ai-insights":
        return kpis ? <AIInsightsPanel key="ai-insights" kpis={kpis} trends={trends} /> : null;

      case "charts":
        return <PerformanceCharts key="charts" trends={trends} heatmap={heatmap} statusPie={statusPie} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {saudacao}{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-muted-foreground">
            {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-2" onClick={() => navigate("/agenda")}>
            <Calendar className="h-4 w-4" /> Novo Agendamento
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate("/matriculas")}>
            <UserPlus className="h-4 w-4" /> Nova Matrícula
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => {
            const link = `${window.location.origin}/pre-cadastro`;
            const msg = `Olá! Para agilizar seu cadastro em nossa clínica, preencha o formulário abaixo:\n\n${link}\n\nÉ rápido e fácil! Qualquer dúvida, estamos à disposição.`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
          }}>
            <UserPlus className="h-4 w-4" /> Enviar Pré-Cadastro
          </Button>
          <DashboardCustomizer cards={cards} onReorder={reorderCards} onToggle={toggleCard} onReset={resetToDefault} />
        </div>
      </div>

      {/* Dynamic card rendering */}
      {visibleCards.map(card => renderSection(card.id))}
    </div>
  );
};

export { ProfessionalDashboard };
export default ProfessionalDashboard;
