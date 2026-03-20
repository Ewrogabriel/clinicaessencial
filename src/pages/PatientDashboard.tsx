import { useState } from "react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyTipsCard } from "@/components/dashboard/DailyTipsCard";
import { ConvenioCard } from "@/components/dashboard/ConvenioCard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GamificationDashboard } from "@/components/gamification/GamificationDashboard";
import {
  AlertCircle, Calendar, CreditCard, Trophy, Dumbbell,
  ClipboardList, FileText, MessageSquare, Handshake, User,
  ChevronRight, Megaphone, CalendarDays, Gift, Star, Phone,
  MapPin, AlertTriangle, CheckCircle2, ArrowRight,
  Clock, Settings2
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

// Ícone do WhatsApp
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const DEFAULT_CARDS: DashboardCard[] = [
  { id: "tips", label: "Dica do Dia", visible: true },
  { id: "sessoes", label: "Próximas Sessões", visible: true },
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

  const hoje = new Date();
  const saudacao =
    hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const [feriadosDialogOpen, setFeriadosDialogOpen] = useState(false);

  const { data: paciente } = useQuery({
    queryKey: ["paciente-by-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome, cpf")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: nextAppointments = [] } = useQuery({
    queryKey: ["patient-next-appointments", paciente?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("agendamentos")
        .select("id, data_horario, tipo_atendimento, status")
        .eq("paciente_id", paciente!.id)
        .gte("data_horario", now)
        .in("status", ["agendado", "confirmado"])
        .order("data_horario")
        .limit(5);
      return data || [];
    },
    enabled: !!paciente?.id,
  });

  const { data: planosExercicios = [] } = useQuery({
    queryKey: ["planos-exercicios", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return [];
      const { data } = await supabase
        .from("planos_exercicios" as never)
        .select("id, nome, descricao, ativo")
        .eq("paciente_id", paciente.id)
        .eq("ativo", true)
        .limit(5);
      return (data as Record<string, unknown>[]) || [];
    },
    enabled: !!paciente?.id,
  });

  const { data: meusPlanosServico = [] } = useQuery({
    queryKey: ["meus-planos-servico", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return [];
      const { data } = await supabase
        .from("planos" as never)
        .select("id, nome, sessoes_contratadas, sessoes_utilizadas, status")
        .eq("paciente_id", paciente.id)
        .eq("status", "ativo")
        .limit(5);
      return (data as Record<string, unknown>[]) || [];
    },
    enabled: !!paciente?.id,
  });

  const { data: pendingPayments = [] } = useQuery({
    queryKey: ["patient-pending-payments", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return [];
      const { data } = await supabase
        .from("pagamentos")
        .select("id, valor, data_vencimento, descricao")
        .eq("paciente_id", paciente.id)
        .eq("status", "pendente")
        .order("data_vencimento")
        .limit(5);
      return data || [];
    },
    enabled: !!paciente?.id,
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ["mensagens-recentes", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return [];
      const { data } = await supabase
        .from("mensagens" as never)
        .select("id, assunto, created_at, lida")
        .eq("destinatario_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as Record<string, unknown>[]) || [];
    },
    enabled: !!paciente?.id && !!user?.id,
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos-paciente", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return [];
      const { data } = await supabase
        .from("contratos_digitais")
        .select("id, titulo, created_at")
        .eq("paciente_id", paciente.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!paciente?.id,
  });

  const { data: convenios = [] } = useQuery({
    queryKey: ["convenios-ativos", activeClinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("convenios")
        .select("id, nome")
        .eq("ativo", true)
        .limit(5);
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: rewardsAvailable = [] } = useQuery({
    queryKey: ["rewards-catalog-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rewards_catalog")
        .select("*")
        .eq("ativo", true)
        .order("pontos_necessarios");
      return data || [];
    },
  });

  const { data: avisos = [] } = useQuery({
    queryKey: ["avisos-ativos", activeClinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("avisos")
        .select("*")
        .eq("ativo", true)
        .eq("clinic_id", activeClinicId!)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ["clinic-settings", activeClinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinicas")
        .select("*")
        .eq("id", activeClinicId!)
        .maybeSingle();
      return data;
    },
    enabled: !!activeClinicId,
  });

  const { data: feriados = [] } = useQuery({
    queryKey: ["feriados-proximos"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      const in30DaysStr = in30Days.toISOString().split("T")[0];
      const { data } = await supabase
        .from("feriados")
        .select("*")
        .gte("data", today)
        .lte("data", in30DaysStr)
        .order("data");
      return data || [];
    },
  });

  const { data: todosOsFeriados = [] } = useQuery({
    queryKey: ["feriados-todos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("feriados")
        .select("*")
        .order("data");
      return data || [];
    },
    enabled: feriadosDialogOpen,
  });

  const { data: totalPoints } = useQuery({
    queryKey: ["patient-total-points", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return 0;
      const { data } = await supabase
        .from("patient_points")
        .select("pontos")
        .eq("paciente_id", paciente.id);
      return (data || []).reduce((sum, p) => sum + (p.pontos || 0), 0);
    },
    enabled: !!paciente?.id,
  });

  const redeemReward = async (reward: any) => {
    if (!paciente?.id) return;
    if ((totalPoints || 0) < reward.pontos_necessarios) {
      toast.error("Pontos insuficientes para este resgate.");
      return;
    }
    try {
      const expiresAt = reward.validade_dias
        ? new Date(Date.now() + reward.validade_dias * 86400000).toISOString()
        : null;
      const { error } = await supabase.from("rewards_redemptions").insert({
        reward_id: reward.id,
        paciente_id: paciente.id,
        pontos_gastos: reward.pontos_necessarios,
        status: "pendente",
        codigo_desconto: `DESC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        expira_em: expiresAt,
      });
      if (error) throw error;
      toast.success("Resgate solicitado! Aguarde aprovação da clínica.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openWhatsApp = () => {
    if (clinicSettings?.whatsapp) {
      const phone = clinicSettings.whatsapp.replace(/\D/g, "");
      const msg = encodeURIComponent(`Olá! Sou paciente ${paciente?.nome || ""} e gostaria de falar com a clínica.`);
      window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    } else {
      toast.error("WhatsApp da clínica não configurado.");
    }
  };

  const isCardVisible = (id: string) => visibleCards.some(c => c.id === id);

  if (!paciente) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sua conta não está vinculada a um cadastro de paciente. Entre em contato com a clínica.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const naoLidas = mensagens.filter((m: any) => !m.lida).length;

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground truncate">
            {saudacao}, {profile?.nome?.split(" ")[0] || paciente?.nome?.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DashboardCustomizer
            cards={cards}
            onReorder={reorderCards}
            onToggle={toggleCard}
            onReset={resetToDefault}
          />
          <button
            onClick={() => navigate("/meu-perfil")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <User className="h-5 w-5 text-primary" />
          </button>
        </div>
      </div>

      {/* Botão flutuante Fale com a Clínica */}
      {clinicSettings?.whatsapp && (
        <button
          onClick={openWhatsApp}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-lg px-4 py-3 text-sm font-semibold transition-colors"
          aria-label="Fale com a clínica via WhatsApp"
        >
          <WhatsAppIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Fale com a clínica</span>
        </button>
      )}

      {/* Alerta de pagamentos pendentes */}
      {pendingPayments.length > 0 && (
        <button onClick={() => navigate("/meus-pagamentos")} className="w-full text-left">
          <Alert className="border-destructive/40 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive font-medium">
              Você tem {pendingPayments.length} pagamento(s) pendente(s). Clique para regularizar.
            </AlertDescription>
          </Alert>
        </button>
      )}

      {/* Avisos da clínica */}
      {avisos.length > 0 && (
        <div className="space-y-2">
          {avisos.map((aviso) => (
            <Alert key={aviso.id} className="border-l-4 border-l-primary bg-primary/5">
              <Megaphone className="h-4 w-4 text-primary" />
              <AlertDescription>
                <span className="font-semibold text-foreground">{aviso.titulo}</span>
                {aviso.mensagem && (
                  <span className="text-muted-foreground ml-1">— {aviso.mensagem}</span>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* KPIs pequenos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/minha-agenda")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2 bg-blue-50"><Calendar className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{nextAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Sessões</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/planos-exercicios")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2 bg-purple-50"><Dumbbell className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold">{planosExercicios.length}</p>
              <p className="text-xs text-muted-foreground">Exercícios</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-md transition-shadow cursor-pointer ${pendingPayments.length > 0 ? "border-destructive/30" : ""}`} onClick={() => navigate("/meus-pagamentos")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2 ${pendingPayments.length > 0 ? "bg-destructive/10" : "bg-green-50"}`}>
              <CreditCard className={`h-5 w-5 ${pendingPayments.length > 0 ? "text-destructive" : "text-green-600"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingPayments.length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/meu-perfil")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2 bg-amber-50"><Trophy className="h-5 w-5 text-amber-500" /></div>
            <div>
              <p className="text-2xl font-bold">{totalPoints || 0}</p>
              <p className="text-xs text-muted-foreground">Pontos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards Grandes - Coluna única */}
      <div className="space-y-4">

        {/* Dica do Dia */}
        {isCardVisible("tips") && <DailyTipsCard tipo="paciente" />}

        {/* Próximas Sessões */}
        {isCardVisible("sessoes") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Próximas Sessões
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/minha-agenda")} className="text-xs text-primary gap-1 h-7">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {nextAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma sessão agendada</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/minha-agenda")}>
                    Agendar sessão
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {nextAppointments.map((apt, idx) => (
                    <div key={apt.id}>
                      <button onClick={() => navigate("/minha-agenda")} className="w-full text-left group">
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg shrink-0">
                            <Clock className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {format(new Date(apt.data_horario), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{apt.tipo_atendimento}</p>
                          </div>
                          <Badge variant={apt.status === "confirmado" ? "default" : "secondary"} className="text-xs shrink-0">
                            {apt.status === "confirmado" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {apt.status}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                      {idx < nextAppointments.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Exercícios */}
        {isCardVisible("exercicios") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-purple-600" />
                Exercícios
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/planos-exercicios")} className="text-xs text-primary gap-1 h-7">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {planosExercicios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Dumbbell className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum plano de exercício ativo</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {planosExercicios.map((plano: any, idx) => (
                    <div key={plano.id}>
                      <button onClick={() => navigate("/planos-exercicios")} className="w-full text-left group">
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-center w-10 h-10 bg-purple-50 rounded-lg shrink-0">
                            <Dumbbell className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{plano.nome}</p>
                            {plano.descricao && <p className="text-xs text-muted-foreground truncate">{plano.descricao}</p>}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">Ativo</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                      {idx < planosExercicios.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Meus Planos */}
        {isCardVisible("planos") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-amber-600" />
                Meus Planos
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/meus-planos")} className="text-xs text-primary gap-1 h-7">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {meusPlanosServico.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum pacote de sessões ativo</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {meusPlanosServico.map((pp: any, idx) => (
                    <div key={pp.id}>
                      <button onClick={() => navigate("/meus-planos")} className="w-full text-left group">
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-center w-10 h-10 bg-amber-50 rounded-lg shrink-0">
                            <ClipboardList className="h-5 w-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{pp.plano?.nome || "Plano"}</p>
                            <p className="text-xs text-muted-foreground">{pp.sessoes_restantes} sessões restantes</p>
                          </div>
                          <Badge variant="default" className="text-xs shrink-0 bg-amber-600">Ativo</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                      {idx < meusPlanosServico.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagamentos */}
        {isCardVisible("pagamentos") && (
          <Card className={pendingPayments.length > 0 ? "border-destructive/30" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className={`h-5 w-5 ${pendingPayments.length > 0 ? "text-destructive" : "text-green-600"}`} />
                Pagamentos
                {pendingPayments.length > 0 && <Badge variant="destructive" className="text-xs">{pendingPayments.length} pendente(s)</Badge>}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/meus-pagamentos")} className="text-xs text-primary gap-1 h-7">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {pendingPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                  <p className="text-sm text-muted-foreground">Tudo em dia! Nenhum pagamento pendente.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {pendingPayments.map((p: any, idx) => (
                    <div key={p.id}>
                      <button onClick={() => navigate("/meus-pagamentos")} className="w-full text-left group">
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/5 transition-colors">
                          <div className="flex items-center justify-center w-10 h-10 bg-destructive/10 rounded-lg shrink-0">
                            <CreditCard className="h-5 w-5 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{p.descricao || "Pagamento"}</p>
                            <p className="text-xs text-muted-foreground">
                              Vencimento: {format(new Date(p.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-destructive shrink-0">R$ {Number(p.valor).toFixed(2)}</p>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                      {idx < pendingPayments.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mensagens */}
        {isCardVisible("mensagens") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-rose-600" />
                Mensagens
                {naoLidas > 0 && <Badge variant="destructive" className="text-xs">{naoLidas} nova(s)</Badge>}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/mensagens")} className="text-xs text-primary gap-1 h-7">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {mensagens.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {mensagens.slice(0, 5).map((msg: any, idx) => (
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
                      {idx < Math.min(mensagens.length, 5) - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contratos */}
        {isCardVisible("contratos") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                Contratos
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/contratos")} className="text-xs text-primary gap-1 h-7">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {contratos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum contrato disponível</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {contratos.map((contrato: any, idx) => (
                    <div key={contrato.id}>
                      <button onClick={() => navigate("/contratos")} className="w-full text-left group">
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-center w-10 h-10 bg-teal-50 rounded-lg shrink-0">
                            <FileText className="h-5 w-5 text-teal-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{contrato.titulo}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(contrato.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                          </div>
                          <Badge variant={contrato.status === "assinado" ? "default" : "secondary"} className="text-xs shrink-0">{contrato.status}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                      {idx < contratos.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Parceiros/Convênios - rotating */}
        {isCardVisible("parceiros") && <ConvenioCard />}

        {/* Feriados */}
        {isCardVisible("feriados") && feriados.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-orange-600" />
                  Feriados — próximos 30 dias
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 text-muted-foreground"
                  onClick={() => setFeriadosDialogOpen(true)}
                >
                  Ver todos →
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {feriados.map((f: any, idx) => (
                  <div key={f.id}>
                    <div className="flex items-center gap-3 p-3 rounded-lg">
                      <div className="flex items-center justify-center w-10 h-10 bg-orange-50 rounded-lg shrink-0">
                        <CalendarDays className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{f.descricao}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(f.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                      </div>
                    </div>
                    {idx < feriados.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feriados list dialog */}
        <Dialog open={feriadosDialogOpen} onOpenChange={setFeriadosDialogOpen}>
          <DialogContent className="sm:max-w-[420px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                Todos os Feriados
              </DialogTitle>
            </DialogHeader>
            {todosOsFeriados.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum feriado cadastrado.</p>
            ) : (
              <div className="space-y-1">
                {todosOsFeriados.map((f: any, idx) => (
                  <div key={f.id}>
                    <div className="flex items-center gap-3 p-3 rounded-lg">
                      <div className="flex items-center justify-center w-10 h-10 bg-orange-50 rounded-lg shrink-0">
                        <CalendarDays className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{f.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(f.data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {idx < todosOsFeriados.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Conquistas */}
        {isCardVisible("conquistas") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Conquistas
              </CardTitle>
              <Badge variant="outline" className="gap-1 text-xs">
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                {totalPoints || 0} pts
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <GamificationDashboard pacienteId={paciente.id} />
            </CardContent>
          </Card>
        )}

        {/* Recompensas */}
        {isCardVisible("recompensas") && rewardsAvailable.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-5 w-5 text-rose-500" />
                Recompensas Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {rewardsAvailable.map((reward: any) => {
                const canRedeem = (totalPoints || 0) >= reward.pontos_necessarios;
                return (
                  <div key={reward.id} className={`rounded-lg border p-4 ${canRedeem ? "border-primary/30 bg-primary/5" : "opacity-60"}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-foreground leading-tight">{reward.nome}</p>
                      <Badge variant="outline" className="gap-1 shrink-0 text-xs whitespace-nowrap">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        {reward.pontos_necessarios} pts
                      </Badge>
                    </div>
                    {reward.descricao && (
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{reward.descricao}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge className="bg-green-600 text-white text-xs">
                        {reward.tipo === "desconto_percentual"
                          ? `${reward.percentual_desconto}% OFF`
                          : `R$ ${reward.valor_desconto?.toFixed(2)}`}
                      </Badge>
                      <Button
                        size="sm"
                        variant={canRedeem ? "default" : "outline"}
                        disabled={!canRedeem}
                        onClick={() => redeemReward(reward)}
                        className="h-8 text-xs gap-1"
                      >
                        <Gift className="h-3 w-3" />
                        Resgatar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Contato da Clínica */}
      {clinicSettings && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg shrink-0">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{clinicSettings.nome}</p>
                {clinicSettings.endereco && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {clinicSettings.endereco}
                    {clinicSettings.numero && `, ${clinicSettings.numero}`}
                    {clinicSettings.bairro && ` - ${clinicSettings.bairro}`}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 mt-2">
                  {clinicSettings.telefone && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" /> {clinicSettings.telefone}
                    </span>
                  )}
                  {clinicSettings.whatsapp && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <WhatsAppIcon className="h-4 w-4" /> {clinicSettings.whatsapp}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
