import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GamificationDashboard } from "@/components/gamification/GamificationDashboard";
import { PatientAgendaTab } from "@/components/patient/PatientAgendaTab";
import { PatientFinanceTab } from "@/components/patient/PatientFinanceTab";
import { PatientProdutosTab } from "@/components/patient/PatientProdutosTab";
import { PatientInfoTab } from "@/components/patient/PatientInfoTab";
import {
  AlertCircle, Calendar, CreditCard, Package, Trophy, Info, Dumbbell,
  ClipboardList, FileText, MessageSquare, Handshake, User, ChevronRight,
  Megaphone, CalendarDays, Gift, Star
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatientAgenda } from "@/hooks/usePatientAgenda";
import { usePatientFinance } from "@/hooks/usePatientFinance";
import { usePatientProdutos } from "@/hooks/usePatientProdutos";
import { useState } from "react";
import { toast } from "sonner";

export default function PatientDashboard() {
  const { user, profile } = useAuth();
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("inicio");

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

  // Upcoming appointments count
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
        .limit(3);
      return data || [];
    },
    enabled: !!paciente?.id,
  });

  // Exercise plans count
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

  // Pending payments count
  const { data: pendingCount } = useQuery({
    queryKey: ["patient-pending-count", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return 0;
      const { count } = await supabase
        .from("pagamentos")
        .select("*", { count: "exact", head: true })
        .eq("paciente_id", paciente.id)
        .eq("status", "pendente");
      return count || 0;
    },
    enabled: !!paciente?.id,
  });

  // Rewards available
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

  // Avisos
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

  // Clinic info
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

  // Feriados
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

  // Gamification points
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

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {profile?.nome || paciente?.nome}! 👋
        </h1>
        <p className="text-muted-foreground text-sm">Bem-vindo ao seu portal</p>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("agenda")}>
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{nextAppointments.length}</p>
            <p className="text-xs text-muted-foreground">Próximas sessões</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/planos-exercicios")}>
          <CardContent className="p-4 text-center">
            <Dumbbell className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{planosCount || 0}</p>
            <p className="text-xs text-muted-foreground">Planos exercícios</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("financeiro")}>
          <CardContent className="p-4 text-center">
            <CreditCard className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{pendingCount || 0}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("recompensas")}>
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{totalPoints || 0}</p>
            <p className="text-xs text-muted-foreground">Pontos</p>
          </CardContent>
        </Card>
      </div>

      {/* Next appointment preview */}
      {nextAppointments.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Próxima Sessão
            </CardTitle>
            <button onClick={() => navigate("/minha-agenda")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver agenda <ChevronRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">
                  {format(new Date(nextAppointments[0].data_horario), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">{nextAppointments[0].tipo_atendimento}</p>
              </div>
              <Badge variant={nextAppointments[0].status === "confirmado" ? "default" : "secondary"} className="text-xs">
                {nextAppointments[0].status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="inicio" className="text-xs">Início</TabsTrigger>
          <TabsTrigger value="agenda" className="text-xs">Agenda</TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
          <TabsTrigger value="recompensas" className="text-xs">Recompensas</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
        </TabsList>

        {/* Início Tab */}
        <TabsContent value="inicio" className="space-y-4 mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Minha Agenda", desc: "Sessões futuras", icon: Calendar, route: "/minha-agenda", color: "text-primary", bg: "bg-primary/10" },
              { label: "Exercícios", desc: `${planosCount || 0} plano(s)`, icon: Dumbbell, route: "/planos-exercicios", color: "text-purple-600", bg: "bg-purple-600/10" },
              { label: "Meus Planos", desc: "Pacotes de sessão", icon: ClipboardList, route: "/meus-planos", color: "text-amber-600", bg: "bg-amber-600/10" },
              { label: "Pagamentos", desc: "Financeiro", icon: CreditCard, route: "/meus-pagamentos", color: "text-green-600", bg: "bg-green-600/10" },
              { label: "Mensagens", desc: "Chat", icon: MessageSquare, route: "/mensagens", color: "text-rose-600", bg: "bg-rose-600/10" },
              { label: "Contratos", desc: "Documentos", icon: FileText, route: "/contratos", color: "text-teal-600", bg: "bg-teal-600/10" },
              { label: "Convênios", desc: "Parceiros", icon: Handshake, route: "/convenios", color: "text-sky-600", bg: "bg-sky-600/10" },
              { label: "Meu Perfil", desc: "Dados pessoais", icon: User, route: "/meu-perfil", color: "text-indigo-600", bg: "bg-indigo-600/10" },
              { label: "Conquistas", desc: `${totalPoints || 0} pts`, icon: Trophy, route: "", color: "text-amber-500", bg: "bg-amber-500/10", tab: "recompensas" },
            ].map((item) => (
              <Card
                key={item.label}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => item.route ? navigate(item.route) : item.tab ? setActiveTab(item.tab) : null}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 ${item.bg} rounded-lg shrink-0`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Agenda Tab */}
        <TabsContent value="agenda" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Minhas Sessões
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate("/minha-agenda")}>Ver completa</Button>
            </CardHeader>
            <CardContent>
              {nextAppointments.length > 0 ? (
                <div className="space-y-2">
                  {nextAppointments.map((apt) => (
                    <div key={apt.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(apt.data_horario), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">{apt.tipo_atendimento}</p>
                      </div>
                      <Badge variant={apt.status === "confirmado" ? "default" : "secondary"} className="text-xs">
                        {apt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma sessão agendada</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financeiro Tab */}
        <TabsContent value="financeiro" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" /> Financeiro
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate("/meus-pagamentos")}>Ver tudo</Button>
            </CardHeader>
            <CardContent>
              {(pendingCount || 0) > 0 ? (
                <div className="p-4 bg-destructive/10 rounded-lg text-center">
                  <p className="text-sm font-medium text-destructive">Você tem {pendingCount} pagamento(s) pendente(s)</p>
                  <Button variant="destructive" size="sm" className="mt-2" onClick={() => navigate("/meus-pagamentos")}>
                    Ver pagamentos
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento pendente 🎉</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recompensas Tab */}
        <TabsContent value="recompensas" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" /> Meus Pontos: {totalPoints || 0}
              </CardTitle>
              <CardDescription>Troque seus pontos por descontos</CardDescription>
            </CardHeader>
            <CardContent>
              {rewardsAvailable.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {rewardsAvailable.map((reward: any) => {
                    const canRedeem = (totalPoints || 0) >= reward.pontos_necessarios;
                    return (
                      <div key={reward.id} className={`border rounded-lg p-4 ${canRedeem ? "border-primary/30" : "opacity-60"}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{reward.nome}</p>
                            {reward.descricao && <p className="text-xs text-muted-foreground">{reward.descricao}</p>}
                          </div>
                          <Badge variant="outline" className="gap-1 shrink-0">
                            <Star className="h-3 w-3" /> {reward.pontos_necessarios}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <Badge className="bg-green-600">
                            {reward.tipo === "desconto_percentual"
                              ? `${reward.percentual_desconto}% OFF`
                              : `R$ ${reward.valor_desconto?.toFixed(2)}`}
                          </Badge>
                          <Button
                            size="sm"
                            variant={canRedeem ? "default" : "outline"}
                            disabled={!canRedeem}
                            onClick={() => redeemReward(reward)}
                            className="h-7 text-xs"
                          >
                            <Gift className="h-3 w-3 mr-1" /> Resgatar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma recompensa disponível no momento</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" /> Conquistas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GamificationDashboard pacienteId={paciente.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> Informações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-1">
                    <Megaphone className="h-3.5 w-3.5" /> Mural de Avisos
                  </h4>
                  {avisos.length > 0 ? (
                    <div className="space-y-2">
                      {avisos.map((aviso) => (
                        <div key={aviso.id} className="p-3 bg-muted rounded-lg">
                          <p className="font-medium text-sm">{aviso.titulo}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{aviso.mensagem}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum aviso</p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> Próximos Feriados
                  </h4>
                  {feriados.length > 0 ? (
                    <div className="space-y-2">
                      {feriados.map((f) => (
                        <div key={f.id} className="p-3 bg-muted rounded-lg">
                          <p className="font-medium text-sm">{f.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(f.data), "dd 'de' MMMM", { locale: ptBR })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem feriados próximos</p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" /> Dados da Clínica
                  </h4>
                  {clinicSettings ? (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{clinicSettings.nome}</p>
                      {clinicSettings.telefone && <p className="text-muted-foreground">📞 {clinicSettings.telefone}</p>}
                      {clinicSettings.whatsapp && <p className="text-muted-foreground">💬 {clinicSettings.whatsapp}</p>}
                      {clinicSettings.endereco && (
                        <p className="text-muted-foreground text-xs">
                          📍 {clinicSettings.endereco}
                          {clinicSettings.numero && `, ${clinicSettings.numero}`}
                          {clinicSettings.bairro && ` - ${clinicSettings.bairro}`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
