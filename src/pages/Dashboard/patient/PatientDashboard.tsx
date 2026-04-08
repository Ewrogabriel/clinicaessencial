import { useState } from "react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyTipsCard } from "@/components/dashboard/DailyTipsCard";
import { ConvenioCard } from "@/components/dashboard/ConvenioCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GamificationDashboard } from "@/components/gamification/GamificationDashboard";
import {
  AlertCircle, Calendar, CreditCard, Trophy, Dumbbell,
  ClipboardList, FileText, MessageSquare, User,
  ChevronRight, Megaphone, CalendarDays, Gift, Star,
  Phone, MapPin, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useDashboardLayout, DashboardCard } from "@/modules/shared/hooks/useDashboardLayout";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { usePatientDashboardData } from "./usePatientDashboardData";
import { DashboardListCard } from "./DashboardListCard";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const DEFAULT_CARDS: DashboardCard[] = [
  { id: "tips", label: "Dica do Dia", visible: true },
  { id: "sessoes", label: "Próximas Sessões", visible: true },
  { id: "historico", label: "Histórico de Sessões", visible: true },
  { id: "matriculas", label: "Matrículas", visible: true },
  { id: "exercicios", label: "Exercícios", visible: true },
  { id: "planos", label: "Meus Planos", visible: true },
  { id: "pagamentos", label: "Pagamentos", visible: true },
  { id: "mensagens", label: "Mensagens", visible: true },
  { id: "contratos", label: "Contratos", visible: true },
  { id: "parceiros", label: "Parceiros", visible: true },
  { id: "feriados", label: "Feriados", visible: true },
  { id: "conquistas", label: "Conquistas", visible: true },
  { id: "recompensas", label: "Recompensas", visible: true },
];

export default function PatientDashboard() {
  const { user, profile } = useAuth();
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();
  const { cards, visibleCards, reorderCards, toggleCard, resetToDefault } = useDashboardLayout("patient", DEFAULT_CARDS);
  const [feriadosDialogOpen, setFeriadosDialogOpen] = useState(false);

  const data = usePatientDashboardData(user?.id, undefined, activeClinicId);
  // Re-query paciente to get ID for dependent queries
  const pacienteId = data.paciente?.id;
  const allData = usePatientDashboardData(user?.id, pacienteId, activeClinicId);
  // Use allData only after paciente is resolved
  const d = pacienteId ? allData : data;

  const hoje = new Date();
  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const { data: todosOsFeriados = [] } = useQuery({
    queryKey: ["feriados-todos"],
    queryFn: async () => {
      const { data } = await supabase.from("feriados").select("*").order("data");
      return data || [];
    },
    enabled: feriadosDialogOpen,
  });

  const redeemReward = async (reward: any) => {
    if (!d.paciente?.id) return;
    if (d.totalPoints < reward.pontos_necessarios) { toast.error("Pontos insuficientes para este resgate."); return; }
    try {
      const expiresAt = reward.validade_dias ? new Date(Date.now() + reward.validade_dias * 86400000).toISOString() : null;
      const { error } = await supabase.from("rewards_redemptions").insert({
        reward_id: reward.id, paciente_id: d.paciente.id, pontos_gastos: reward.pontos_necessarios,
        status: "pendente", codigo_desconto: `DESC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, expira_em: expiresAt,
      });
      if (error) throw error;
      toast.success("Resgate solicitado! Aguarde aprovação da clínica.");
    } catch (e: any) { toast.error(e.message); }
  };

  const openWhatsApp = () => {
    if (d.clinicSettings?.whatsapp) {
      const phone = d.clinicSettings.whatsapp.replace(/\D/g, "");
      const msg = encodeURIComponent(`Olá! Sou paciente ${d.paciente?.nome || ""} e gostaria de falar com a clínica.`);
      window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    } else { toast.error("WhatsApp da clínica não configurado."); }
  };

  const isCardVisible = (id: string) => visibleCards.some(c => c.id === id);
  const naoLidas = d.mensagens.filter((m: any) => !m.lida).length;

  if (!d.paciente) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Sua conta não está vinculada a um cadastro de paciente. Entre em contato com a clínica.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground truncate">
            {saudacao}, {profile?.nome?.split(" ")[0] || d.paciente?.nome?.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DashboardCustomizer cards={cards} onReorder={reorderCards} onToggle={toggleCard} onReset={resetToDefault} />
          <button onClick={() => navigate("/meu-perfil")} className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
            <User className="h-5 w-5 text-primary" />
          </button>
        </div>
      </div>

      {/* WhatsApp floating button */}
      {d.clinicSettings?.whatsapp && (
        <button onClick={openWhatsApp} className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-lg px-4 py-3 text-sm font-semibold transition-colors" aria-label="Fale com a clínica via WhatsApp">
          <WhatsAppIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Fale com a clínica</span>
        </button>
      )}

      {/* Pending payments alert */}
      {d.pendingPayments.length > 0 && (
        <button onClick={() => navigate("/meus-pagamentos")} className="w-full text-left">
          <Alert className="border-destructive/40 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive font-medium">
              Você tem {d.pendingPayments.length} pagamento(s) pendente(s). Clique para regularizar.
            </AlertDescription>
          </Alert>
        </button>
      )}

      {/* Clinic notices */}
      {d.avisos.length > 0 && (
        <div className="space-y-2">
          {d.avisos.map((aviso) => (
            <Alert key={aviso.id} className="border-l-4 border-l-primary bg-primary/5">
              <Megaphone className="h-4 w-4 text-primary" />
              <AlertDescription>
                <span className="font-semibold text-foreground">{aviso.titulo}</span>
                {aviso.mensagem && <span className="text-muted-foreground ml-1">— {aviso.mensagem}</span>}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sessões", value: d.nextAppointments.length, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50", to: "/minha-agenda" },
          { label: "Exercícios", value: d.planosExercicios.length, icon: Dumbbell, color: "text-purple-600", bg: "bg-purple-50", to: "/planos-exercicios" },
          { label: "Pendentes", value: d.pendingPayments.length, icon: CreditCard, color: d.pendingPayments.length > 0 ? "text-destructive" : "text-green-600", bg: d.pendingPayments.length > 0 ? "bg-destructive/10" : "bg-green-50", to: "/meus-pagamentos", border: d.pendingPayments.length > 0 ? "border-destructive/30" : "" },
          { label: "Pontos", value: d.totalPoints || 0, icon: Trophy, color: "text-amber-500", bg: "bg-amber-50", to: "/meu-perfil" },
        ].map(kpi => (
          <Card key={kpi.label} className={`hover:shadow-md transition-shadow cursor-pointer ${kpi.border || ""}`} onClick={() => navigate(kpi.to)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-lg p-2 ${kpi.bg}`}><kpi.icon className={`h-5 w-5 ${kpi.color}`} /></div>
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {isCardVisible("tips") && <DailyTipsCard tipo="paciente" />}

        {/* Next sessions */}
        {isCardVisible("sessoes") && (
          <DashboardListCard title="Próximas Sessões" icon={Calendar} iconColor="text-blue-600" onViewAll={() => navigate("/minha-agenda")} isEmpty={d.nextAppointments.length === 0} emptyMessage="Nenhuma sessão agendada" emptyAction={{ label: "Agendar sessão", onClick: () => navigate("/minha-agenda") }}>
            <div className="space-y-1">
              {d.nextAppointments.map((apt, idx) => (
                <div key={apt.id}>
                  <button onClick={() => navigate("/minha-agenda")} className="w-full text-left group">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg shrink-0"><Clock className="h-5 w-5 text-blue-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{format(new Date(apt.data_horario), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground truncate">{apt.tipo_atendimento}</p>
                      </div>
                      <Badge variant={apt.status === "confirmado" ? "default" : "secondary"} className="text-xs shrink-0">
                        {apt.status === "confirmado" && <CheckCircle2 className="h-3 w-3 mr-1" />}{apt.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                  {idx < d.nextAppointments.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </DashboardListCard>
        )}

        {/* Session history */}
        {isCardVisible("historico") && (
          <DashboardListCard title="Histórico de Sessões" icon={CalendarDays} iconColor="text-gray-600" onViewAll={() => navigate("/meu-historico")} isEmpty={d.pastSessions.length === 0} emptyMessage="Nenhuma sessão realizada ainda">
            <div className="space-y-1">
              {d.pastSessions.map((s: any, idx: number) => {
                const statusColors: Record<string, string> = { realizado: "bg-green-50 text-green-700", falta: "bg-amber-50 text-amber-700", cancelado: "bg-red-50 text-red-700" };
                return (
                  <div key={s.id}>
                    <div className="flex items-center gap-3 p-3 rounded-lg">
                      <div className="flex items-center justify-center w-10 h-10 bg-muted rounded-lg shrink-0"><CalendarDays className="h-5 w-5 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{format(new Date(s.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground">{s.tipo_atendimento} • {s.duracao_minutos}min</p>
                      </div>
                      <Badge variant="outline" className={`text-xs ${statusColors[s.status] || ""}`}>
                        {s.status === "realizado" ? "Realizada" : s.status === "falta" ? "Falta" : "Cancelada"}
                      </Badge>
                    </div>
                    {idx < d.pastSessions.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          </DashboardListCard>
        )}

        {/* Enrollments */}
        {isCardVisible("matriculas") && (
          <DashboardListCard title="Matrículas Ativas" icon={Star} iconColor="text-indigo-600" isEmpty={d.matriculasAtivas.length === 0} emptyMessage="Nenhuma matrícula ativa">
            <div className="space-y-1">
              {d.matriculasAtivas.map((m: any, idx: number) => (
                <div key={m.id}>
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <div className="flex items-center justify-center w-10 h-10 bg-indigo-50 rounded-lg shrink-0"><Star className="h-5 w-5 text-indigo-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{m.horario || "Matrícula"} {m.dias_semana?.length ? `• ${m.dias_semana.length}x/sem` : ""}</p>
                      <p className="text-xs text-muted-foreground">{m.data_inicio ? format(new Date(m.data_inicio), "dd/MM/yyyy") : ""}{m.data_fim ? ` a ${format(new Date(m.data_fim), "dd/MM/yyyy")}` : ""}</p>
                    </div>
                    <Badge variant="default" className="text-xs shrink-0">Ativa</Badge>
                  </div>
                  {idx < d.matriculasAtivas.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </DashboardListCard>
        )}

        {/* Exercises */}
        {isCardVisible("exercicios") && (
          <DashboardListCard title="Exercícios" icon={Dumbbell} iconColor="text-purple-600" onViewAll={() => navigate("/planos-exercicios")} isEmpty={d.planosExercicios.length === 0} emptyMessage="Nenhum plano de exercício ativo">
            <div className="space-y-1">
              {d.planosExercicios.map((plano: any, idx) => (
                <div key={plano.id}>
                  <button onClick={() => navigate("/planos-exercicios")} className="w-full text-left group">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center w-10 h-10 bg-purple-50 rounded-lg shrink-0"><Dumbbell className="h-5 w-5 text-purple-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{plano.nome}</p>
                        {plano.descricao && <p className="text-xs text-muted-foreground truncate">{plano.descricao}</p>}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">Ativo</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                  {idx < d.planosExercicios.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </DashboardListCard>
        )}

        {/* Plans */}
        {isCardVisible("planos") && (
          <DashboardListCard title="Meus Planos" icon={ClipboardList} iconColor="text-amber-600" onViewAll={() => navigate("/meus-planos")} isEmpty={d.meusPlanosServico.length === 0} emptyMessage="Nenhum pacote de sessões ativo">
            <div className="space-y-1">
              {d.meusPlanosServico.map((pp: any, idx) => (
                <div key={pp.id}>
                  <button onClick={() => navigate("/meus-planos")} className="w-full text-left group">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center w-10 h-10 bg-amber-50 rounded-lg shrink-0"><ClipboardList className="h-5 w-5 text-amber-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{pp.plano?.nome || "Plano"}</p>
                        <p className="text-xs text-muted-foreground">{pp.sessoes_restantes} sessões restantes</p>
                      </div>
                      <Badge variant="default" className="text-xs shrink-0 bg-amber-600">Ativo</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                  {idx < d.meusPlanosServico.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </DashboardListCard>
        )}

        {/* Payments */}
        {isCardVisible("pagamentos") && (
          <DashboardListCard title="Pagamentos" icon={CreditCard} iconColor={d.pendingPayments.length > 0 ? "text-destructive" : "text-green-600"} onViewAll={() => navigate("/meus-pagamentos")} isEmpty={d.pendingPayments.length === 0} emptyMessage="Tudo em dia! Nenhum pagamento pendente." headerExtra={d.pendingPayments.length > 0 ? <Badge variant="destructive" className="text-xs">{d.pendingPayments.length} pendente(s)</Badge> : undefined} className={d.pendingPayments.length > 0 ? "border-destructive/30" : ""}>
            <div className="space-y-1">
              {d.pendingPayments.map((p: any, idx) => (
                <div key={p.id}>
                  <button onClick={() => navigate("/meus-pagamentos")} className="w-full text-left group">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/5 transition-colors">
                      <div className="flex items-center justify-center w-10 h-10 bg-destructive/10 rounded-lg shrink-0"><CreditCard className="h-5 w-5 text-destructive" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{p.descricao || "Pagamento"}</p>
                        <p className="text-xs text-muted-foreground">Vencimento: {format(new Date(p.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}</p>
                      </div>
                      <p className="text-sm font-bold text-destructive shrink-0">R$ {Number(p.valor).toFixed(2)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                  {idx < d.pendingPayments.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </DashboardListCard>
        )}

        {/* Messages */}
        {isCardVisible("mensagens") && (
          <DashboardListCard title="Mensagens" icon={MessageSquare} iconColor="text-rose-600" onViewAll={() => navigate("/mensagens")} isEmpty={d.mensagens.length === 0} emptyMessage="Nenhuma mensagem" headerExtra={naoLidas > 0 ? <Badge variant="destructive" className="text-xs">{naoLidas} nova(s)</Badge> : undefined}>
            <div className="space-y-1">
              {d.mensagens.slice(0, 5).map((msg: any, idx) => (
                <div key={msg.id}>
                  <button onClick={() => navigate("/mensagens")} className="w-full text-left group">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={`flex items-center justify-center w-10 h-10 ${msg.lida ? "bg-rose-50" : "bg-rose-100"} rounded-lg shrink-0`}>
                        <MessageSquare className={`h-5 w-5 ${msg.lida ? "text-rose-400" : "text-rose-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${msg.lida ? "text-muted-foreground" : "font-medium text-foreground"}`}>{msg.assunto || "Sem assunto"}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(msg.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                      </div>
                      {!msg.lida && <Badge variant="secondary" className="text-xs shrink-0">Nova</Badge>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                  {idx < Math.min(d.mensagens.length, 5) - 1 && <Separator />}
                </div>
              ))}
            </div>
          </DashboardListCard>
        )}

        {/* Contracts */}
        {isCardVisible("contratos") && (
          <DashboardListCard title="Contratos" icon={FileText} iconColor="text-teal-600" onViewAll={() => navigate("/contratos")} isEmpty={d.contratos.length === 0} emptyMessage="Nenhum contrato disponível">
            <div className="space-y-1">
              {d.contratos.map((contrato: any, idx) => (
                <div key={contrato.id}>
                  <button onClick={() => navigate("/contratos")} className="w-full text-left group">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center w-10 h-10 bg-teal-50 rounded-lg shrink-0"><FileText className="h-5 w-5 text-teal-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{contrato.titulo}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(contrato.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                      </div>
                      <Badge variant={contrato.status === "assinado" ? "default" : "secondary"} className="text-xs shrink-0">{contrato.status}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                  {idx < d.contratos.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </DashboardListCard>
        )}

        {/* Partners */}
        {isCardVisible("parceiros") && <ConvenioCard />}

        {/* Holidays */}
        {isCardVisible("feriados") && d.feriados.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-5 w-5 text-orange-600" />Feriados — próximos 30 dias</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => setFeriadosDialogOpen(true)}>Ver todos →</Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {d.feriados.map((f: any, idx) => (
                  <div key={f.id}>
                    <div className="flex items-center gap-3 p-3 rounded-lg">
                      <div className="flex items-center justify-center w-10 h-10 bg-orange-50 rounded-lg shrink-0"><CalendarDays className="h-5 w-5 text-orange-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{f.descricao}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(f.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                      </div>
                    </div>
                    {idx < d.feriados.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Holidays dialog */}
        <Dialog open={feriadosDialogOpen} onOpenChange={setFeriadosDialogOpen}>
          <DialogContent className="sm:max-w-[420px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-orange-600" />Todos os Feriados</DialogTitle>
            </DialogHeader>
            {todosOsFeriados.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum feriado cadastrado.</p>
            ) : (
              <div className="space-y-1">
                {todosOsFeriados.map((f: any, idx) => (
                  <div key={f.id}>
                    <div className="flex items-center gap-3 p-3 rounded-lg">
                      <div className="flex items-center justify-center w-10 h-10 bg-orange-50 rounded-lg shrink-0"><CalendarDays className="h-5 w-5 text-orange-600" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{f.descricao}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(f.data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                      </div>
                    </div>
                    {idx < todosOsFeriados.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Achievements */}
        {isCardVisible("conquistas") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />Conquistas</CardTitle>
              <Badge variant="outline" className="gap-1 text-xs"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{d.totalPoints || 0} pts</Badge>
            </CardHeader>
            <CardContent className="pt-0"><GamificationDashboard pacienteId={d.paciente.id} /></CardContent>
          </Card>
        )}

        {/* Rewards */}
        {isCardVisible("recompensas") && d.rewardsAvailable.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Gift className="h-5 w-5 text-rose-500" />Recompensas Disponíveis</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              {d.rewardsAvailable.map((reward: any) => {
                const canRedeem = d.totalPoints >= reward.pontos_necessarios;
                return (
                  <div key={reward.id} className={`rounded-lg border p-4 ${canRedeem ? "border-primary/30 bg-primary/5" : "opacity-60"}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-foreground leading-tight">{reward.nome}</p>
                      <Badge variant="outline" className="gap-1 shrink-0 text-xs whitespace-nowrap"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{reward.pontos_necessarios} pts</Badge>
                    </div>
                    {reward.descricao && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{reward.descricao}</p>}
                    <div className="flex items-center justify-between">
                      <Badge className="bg-green-600 text-white text-xs">{reward.tipo === "desconto_percentual" ? `${reward.percentual_desconto}% OFF` : `R$ ${reward.valor_desconto?.toFixed(2)}`}</Badge>
                      <Button size="sm" variant={canRedeem ? "default" : "outline"} disabled={!canRedeem} onClick={() => redeemReward(reward)} className="h-8 text-xs gap-1"><Gift className="h-3 w-3" />Resgatar</Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Clinic contact */}
      {d.clinicSettings && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg shrink-0"><MapPin className="h-6 w-6 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{d.clinicSettings.nome}</p>
                {d.clinicSettings.endereco && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {d.clinicSettings.endereco}{d.clinicSettings.numero && `, ${d.clinicSettings.numero}`}{d.clinicSettings.bairro && ` - ${d.clinicSettings.bairro}`}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 mt-2">
                  {d.clinicSettings.telefone && <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-4 w-4" />{d.clinicSettings.telefone}</span>}
                  {d.clinicSettings.whatsapp && <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><WhatsAppIcon className="h-4 w-4" />{d.clinicSettings.whatsapp}</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
