import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GamificationDashboard } from "@/components/gamification/GamificationDashboard";
import {
  AlertCircle, Calendar, CreditCard, Package, Trophy, Info, Dumbbell,
  ClipboardList, FileText, MessageSquare, Handshake, User, ChevronRight,
  Megaphone, CalendarDays
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function PatientDashboard() {
  const { user, profile } = useAuth();
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();

  const { data: paciente } = useQuery({
    queryKey: ["paciente-by-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Upcoming appointments
  const { data: nextAppointments = [] } = useQuery({
    queryKey: ["patient-next-appointments", paciente?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("agendamentos")
        .select("id, data_horario, tipo_atendimento, status, profissional_id")
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

      {/* 1. Próximas Sessões */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg"><Calendar className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle className="text-base">Próximas Sessões</CardTitle>
              <CardDescription>Seus agendamentos futuros</CardDescription>
            </div>
          </div>
          <button onClick={() => navigate("/minha-agenda")} className="text-xs text-primary hover:underline flex items-center gap-1">
            Ver tudo <ChevronRight className="h-3 w-3" />
          </button>
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
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sessão agendada</p>
          )}
        </CardContent>
      </Card>

      {/* 2. Planos de Exercícios */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/planos-exercicios")}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600/10 rounded-lg"><Dumbbell className="h-5 w-5 text-purple-600" /></div>
            <div>
              <CardTitle className="text-base">Meus Planos de Exercícios</CardTitle>
              <CardDescription>{planosCount || 0} plano(s) ativo(s)</CardDescription>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
      </Card>

      {/* Grid: Financeiro + Planos de Sessão */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* 3. Financeiro */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/meus-pagamentos")}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-600/10 rounded-lg"><CreditCard className="h-5 w-5 text-green-600" /></div>
              <div>
                <CardTitle className="text-base">Financeiro</CardTitle>
                <CardDescription>Pagamentos e faturas</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 4. Meus Planos de Sessão */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/meus-planos")}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-600/10 rounded-lg"><ClipboardList className="h-5 w-5 text-amber-600" /></div>
              <div>
                <CardTitle className="text-base">Meus Planos</CardTitle>
                <CardDescription>Pacotes de sessões</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 5. Mensagens */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/mensagens")}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-600/10 rounded-lg"><MessageSquare className="h-5 w-5 text-rose-600" /></div>
              <div>
                <CardTitle className="text-base">Mensagens</CardTitle>
                <CardDescription>Chat com a clínica</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 6. Contratos */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/contratos")}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-600/10 rounded-lg"><FileText className="h-5 w-5 text-teal-600" /></div>
              <div>
                <CardTitle className="text-base">Contratos</CardTitle>
                <CardDescription>Documentos assinados</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 7. Convênios */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/convenios")}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sky-600/10 rounded-lg"><Handshake className="h-5 w-5 text-sky-600" /></div>
              <div>
                <CardTitle className="text-base">Convênios</CardTitle>
                <CardDescription>Parceiros disponíveis</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 8. Meu Perfil */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/meu-perfil")}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600/10 rounded-lg"><User className="h-5 w-5 text-indigo-600" /></div>
              <div>
                <CardTitle className="text-base">Meu Perfil</CardTitle>
                <CardDescription>Dados pessoais</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* 9. Conquistas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-lg"><Trophy className="h-5 w-5 text-amber-500" /></div>
            <CardTitle className="text-base">Minhas Conquistas</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <GamificationDashboard pacienteId={paciente.id} />
        </CardContent>
      </Card>

      {/* 10. Informações da Clínica */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg"><Info className="h-5 w-5 text-primary" /></div>
            <CardTitle className="text-base">Informações</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Avisos */}
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

            {/* Feriados */}
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

            {/* Clínica */}
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
    </div>
  );
}
