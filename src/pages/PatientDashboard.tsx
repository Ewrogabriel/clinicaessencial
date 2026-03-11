import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GamificationDashboard } from "@/components/gamification/GamificationDashboard";
import {
  AlertCircle, Calendar, CreditCard, Trophy, Dumbbell,
  ClipboardList, FileText, MessageSquare, Handshake, User,
  ChevronRight, Megaphone, CalendarDays, Gift, Star, Phone,
  MapPin, AlertTriangle, CheckCircle2, Info, ArrowRight,
  Clock, Activity, UserCheck
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

export default function PatientDashboard() {
  const { user, profile } = useAuth();
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();

  const hoje = new Date();
  const saudacao =
    hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

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

  const { data: planosCount } = useQuery({
    queryKey: ["planos-exercicios-count", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return 0;
      const { count } = await (supabase
        .from("planos_exercicios")
        .select("*", { count: "exact", head: true })
        .eq("paciente_id", paciente.id) as any)
        .eq("ativo", true);
      return (count as number) || 0;
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
        .limit(3);
      return data || [];
    },
    enabled: !!paciente?.id,
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
        .single();
      return data;
    },
    enabled: !!activeClinicId,
  });

  const { data: feriados = [] } = useQuery({
    queryKey: ["feriados-proximos"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("feriados")
        .select("*")
        .gte("data", today)
        .order("data")
        .limit(3);
      return data || [];
    },
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

  const recursos = [
    {
      label: "Minha Agenda",
      desc: "Sessões agendadas e histórico completo",
      icon: Calendar,
      badge: nextAppointments.length > 0 ? `${nextAppointments.length} próxima(s)` : null,
      badgeVariant: "default" as const,
      route: "/minha-agenda",
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      label: "Exercícios",
      desc: "Planos e atividades prescritas",
      icon: Dumbbell,
      badge: planosCount ? `${planosCount} ativo(s)` : null,
      badgeVariant: "secondary" as const,
      route: "/planos-exercicios",
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
    },
    {
      label: "Meus Planos",
      desc: "Pacotes de sessões contratados",
      icon: ClipboardList,
      badge: null,
      badgeVariant: "secondary" as const,
      route: "/meus-planos",
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
    },
    {
      label: "Pagamentos",
      desc: "Faturas, histórico e comprovantes",
      icon: CreditCard,
      badge: pendingPayments.length > 0 ? `${pendingPayments.length} pendente(s)` : null,
      badgeVariant: "destructive" as const,
      route: "/meus-pagamentos",
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
    },
    {
      label: "Mensagens",
      desc: "Fale com a clínica e profissionais",
      icon: MessageSquare,
      badge: null,
      badgeVariant: "secondary" as const,
      route: "/mensagens",
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
    },
    {
      label: "Contratos",
      desc: "Documentos e assinaturas digitais",
      icon: FileText,
      badge: null,
      badgeVariant: "secondary" as const,
      route: "/contratos",
      iconColor: "text-teal-600",
      iconBg: "bg-teal-50",
    },
    {
      label: "Convênios",
      desc: "Parceiros e benefícios disponíveis",
      icon: Handshake,
      badge: null,
      badgeVariant: "secondary" as const,
      route: "/convenios",
      iconColor: "text-sky-600",
      iconBg: "bg-sky-50",
    },
    {
      label: "Meu Perfil",
      desc: "Dados pessoais e configurações",
      icon: User,
      badge: null,
      badgeVariant: "secondary" as const,
      route: "/meu-perfil",
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
    },
  ];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {saudacao}, {profile?.nome?.split(" ")[0] || paciente?.nome?.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <button
          onClick={() => navigate("/meu-perfil")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
        >
          <User className="h-5 w-5 text-primary" />
        </button>
      </div>

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

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer hover:border-blue-200"
          onClick={() => navigate("/minha-agenda")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Próximas Sessões</CardTitle>
            <div className="rounded-lg p-1.5 bg-blue-50"><Calendar className="h-4 w-4 text-blue-600" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{nextAppointments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">agendada(s)</p>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer hover:border-purple-200"
          onClick={() => navigate("/planos-exercicios")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Planos de Exercício</CardTitle>
            <div className="rounded-lg p-1.5 bg-purple-50"><Dumbbell className="h-4 w-4 text-purple-600" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{planosCount || 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ativo(s)</p>
          </CardContent>
        </Card>

        <Card
          className={`hover:shadow-md transition-shadow cursor-pointer ${pendingPayments.length > 0 ? "border-destructive/30 hover:border-destructive/50" : "hover:border-green-200"}`}
          onClick={() => navigate("/meus-pagamentos")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pendências</CardTitle>
            <div className={`rounded-lg p-1.5 ${pendingPayments.length > 0 ? "bg-destructive/10" : "bg-green-50"}`}>
              <CreditCard className={`h-4 w-4 ${pendingPayments.length > 0 ? "text-destructive" : "text-green-600"}`} />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{pendingPayments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingPayments.length === 0 ? "em dia" : "pagamento(s)"}
            </p>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer hover:border-amber-200"
          onClick={() => navigate("/meu-perfil")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Meus Pontos</CardTitle>
            <div className="rounded-lg p-1.5 bg-amber-50"><Trophy className="h-4 w-4 text-amber-500" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{totalPoints || 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">pontos acumulados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna Principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Próximas Sessões */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Próximas Sessões
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/minha-agenda")}
                className="text-xs text-primary gap-1 h-7"
              >
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {nextAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma sessão agendada</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs"
                    onClick={() => navigate("/minha-agenda")}
                  >
                    Agendar sessão
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {nextAppointments.map((apt, idx) => (
                    <div key={apt.id}>
                      <button
                        onClick={() => navigate("/minha-agenda")}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-center w-9 h-9 bg-blue-50 rounded-lg shrink-0">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {format(new Date(apt.data_horario), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{apt.tipo_atendimento}</p>
                          </div>
                          <Badge
                            variant={apt.status === "confirmado" ? "default" : "secondary"}
                            className="text-xs shrink-0"
                          >
                            {apt.status === "confirmado" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {apt.status}
                          </Badge>
                        </div>
                      </button>
                      {idx < nextAppointments.length - 1 && <Separator className="my-1" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagamentos Pendentes */}
          {pendingPayments.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-destructive" />
                  Pagamentos Pendentes
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/meus-pagamentos")}
                  className="text-xs text-destructive gap-1 h-7 hover:bg-destructive/10"
                >
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {pendingPayments.map((p: any, idx) => (
                  <div key={p.id}>
                    <button
                      onClick={() => navigate("/meus-pagamentos")}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-destructive/5 transition-colors gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.descricao || "Pagamento"}</p>
                          <p className="text-xs text-muted-foreground">
                            Vence em {format(new Date(p.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-destructive shrink-0">
                          R$ {Number(p.valor).toFixed(2)}
                        </p>
                      </div>
                    </button>
                    {idx < pendingPayments.length - 1 && <Separator className="my-1" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recursos / Atalhos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Meus Recursos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y">
                {recursos.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.route)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
                      <div className={`flex items-center justify-center w-9 h-9 ${item.iconBg} rounded-lg shrink-0`}>
                        <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          {item.badge && (
                            <Badge variant={item.badgeVariant} className="text-xs h-5 px-1.5">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Coluna Lateral */}
        <div className="space-y-6">

          {/* Conquistas e Pontos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
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

          {/* Recompensas disponíveis */}
          {rewardsAvailable.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4 text-rose-500" />
                  Recompensas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {rewardsAvailable.map((reward: any) => {
                  const canRedeem = (totalPoints || 0) >= reward.pontos_necessarios;
                  return (
                    <div key={reward.id} className={`rounded-lg border p-3 ${canRedeem ? "border-primary/30 bg-primary/5" : "opacity-60"}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-foreground leading-tight">{reward.nome}</p>
                        <Badge variant="outline" className="gap-1 shrink-0 text-xs whitespace-nowrap">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          {reward.pontos_necessarios} pts
                        </Badge>
                      </div>
                      {reward.descricao && (
                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{reward.descricao}</p>
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
                          className="h-7 text-xs gap-1"
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

          {/* Próximos Feriados */}
          {feriados.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-sky-600" />
                  Próximos Feriados
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 divide-y">
                {feriados.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2.5">
                    <p className="text-sm text-foreground">{f.descricao}</p>
                    <p className="text-xs font-medium text-muted-foreground shrink-0 ml-2">
                      {format(new Date(f.data), "dd/MM", { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Contato da Clínica */}
          {clinicSettings && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-indigo-600" />
                  Contato da Clínica
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2.5">
                <p className="font-semibold text-sm text-foreground">{clinicSettings.nome}</p>
                {clinicSettings.telefone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{clinicSettings.telefone}</span>
                  </div>
                )}
                {clinicSettings.whatsapp && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span>{clinicSettings.whatsapp}</span>
                  </div>
                )}
                {clinicSettings.endereco && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {clinicSettings.endereco}
                      {clinicSettings.numero && `, ${clinicSettings.numero}`}
                      {clinicSettings.bairro && ` - ${clinicSettings.bairro}`}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
