import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DailyTipsCard } from "@/components/dashboard/DailyTipsCard";
import { RequestsCard } from "@/components/dashboard/RequestsCard";
import { ConvenioCard } from "@/components/dashboard/ConvenioCard";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { useDashboardLayout, DashboardCard } from "@/hooks/useDashboardLayout";
import { AdvancedKPIs } from "@/components/professional/AdvancedKPIs";
import { PerformanceCharts } from "@/components/professional/PerformanceCharts";
import { AIInsightsPanel } from "@/components/professional/AIInsightsPanel";
import { useProfessionalAnalytics } from "@/hooks/useProfessionalAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

const PROF_DEFAULT_CARDS: DashboardCard[] = [
  { id: "tips", label: "Dicas do Dia", visible: true },
  { id: "convenios", label: "Convênios & Parceiros", visible: true },
  { id: "kpis", label: "Indicadores (KPIs)", visible: true },
  { id: "requests", label: "Solicitações", visible: true },
  { id: "ai-insights", label: "Insights IA", visible: true },
  { id: "charts", label: "Gráficos de Performance", visible: true },
  { id: "today-agenda", label: "Agenda de Hoje", visible: true },
];

const ProfessionalDashboard = () => {
  const { profile } = useAuth();
  const hoje = new Date();
  const { kpis, kpisLoading, trends, heatmap, todayAgenda } = useProfessionalAnalytics();
  const { visibleCards, cards, reorderCards, toggleCard, resetToDefault } = useDashboardLayout("professional", PROF_DEFAULT_CARDS);

  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

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

  const renderSection = (cardId: string) => {
    switch (cardId) {
      case "tips": return <DailyTipsCard key="tips" tipo="profissional" />;
      case "convenios": return <ConvenioCard key="convenios" />;
      case "kpis": return kpisLoading ? (
        <div key="kpis" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : kpis ? <AdvancedKPIs key="kpis" kpis={kpis} /> : null;
      case "requests": return <RequestsCard key="requests" />;
      case "ai-insights": return kpis ? <AIInsightsPanel key="ai-insights" kpis={kpis} trends={trends} /> : null;
      case "charts": return <PerformanceCharts key="charts" trends={trends} heatmap={heatmap} statusPie={statusPie} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {saudacao}{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground">
            {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <DashboardCustomizer cards={cards} onReorder={reorderCards} onToggle={toggleCard} onReset={resetToDefault} />
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={() => {
          const link = `${window.location.origin}/pre-cadastro`;
          const msg = `Olá! 👋\n\nPara agilizar seu cadastro em nossa clínica, preencha o formulário abaixo:\n\n📋 ${link}\n\nÉ rápido e fácil! Qualquer dúvida, estamos à disposição. 😊`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
        }}>
          <UserPlus className="h-4 w-4" /> Enviar Pré-Cadastro
        </Button>
      </div>

      {/* Dynamic card rendering */}
      {visibleCards.map(card => renderSection(card.id))}

      {/* Today's agenda (always at bottom if visible) */}
      {isCardVisible("today-agenda") && (
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
                {todayAgenda.map((ag) => (
                  <div key={ag.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-sm">
                        {(ag as Record<string, unknown>).pacientes
                          ? ((ag as Record<string, unknown>).pacientes as Record<string, string>)?.nome
                          : "Paciente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ag.data_horario), "HH:mm")} • {ag.tipo_atendimento} • {ag.duracao_minutos}min
                      </p>
                    </div>
                    <Badge className={statusColors[ag.status] || ""}>{ag.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfessionalDashboard;
