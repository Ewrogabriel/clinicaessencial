import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Video, Plus, Clock, CheckCircle2, Search,
  FileText, Mic, Calendar, Activity,
  Copy, ExternalLink, Link as LinkIcon, Share2,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  aguardando: { label: "Sala de espera", color: "bg-amber-100 text-amber-800" },
  em_andamento: { label: "Em andamento", color: "bg-green-100 text-green-800" },
  finalizado: { label: "Finalizada", color: "bg-muted text-muted-foreground" },
  encerrada: { label: "Encerrada", color: "bg-muted text-muted-foreground" },
};

export default function TeleconsultaHub() {
  const navigate = useNavigate();
  const { user, isProfissional, isAdmin, isGestor, patientId } = useAuth();
  const { activeClinicId } = useClinic();
  const [search, setSearch] = useState("");
  const isProfOrAdmin = isProfissional || isAdmin || isGestor;

  // Fetch teleconsulta sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["teleconsulta-sessions", activeClinicId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("teleconsulta_sessions")
        .select("*, pacientes(nome, telefone), agendamentos(data_horario)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
      if (!isProfOrAdmin && patientId) query = query.eq("paciente_id", patientId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch scheduled teleconsulta appointments (that don't have a session yet)
  const { data: scheduledAppointments = [] } = useQuery({
    queryKey: ["teleconsulta-agendamentos", activeClinicId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("agendamentos")
        .select("id, data_horario, status, observacoes, paciente_id, profissional_id, pacientes(nome, telefone), duracao_minutos")
        .ilike("observacoes", "%[TELECONSULTA]%")
        .in("status", ["agendado", "confirmado"])
        .order("data_horario", { ascending: true });

      if (activeClinicId) query = query.eq("clinic_id", activeClinicId);

      const { data, error } = await query;
      if (error) throw error;

      // Filter out appointments that already have a session
      const sessionAgendamentoIds = new Set(
        sessions.filter((s: any) => s.agendamento_id).map((s: any) => s.agendamento_id)
      );
      return (data || []).filter((a: any) => !sessionAgendamentoIds.has(a.id));
    },
    enabled: !!user && !loadingSessions,
  });

  const filtered = sessions.filter((s: any) => {
    if (!search) return true;
    const nome = s.pacientes?.nome?.toLowerCase() || "";
    return nome.includes(search.toLowerCase());
  });

  const filteredAppointments = scheduledAppointments.filter((a: any) => {
    if (!search) return true;
    const nome = a.pacientes?.nome?.toLowerCase() || "";
    return nome.includes(search.toLowerCase());
  });

  const active = filtered.filter((s: any) => ["aguardando", "em_andamento"].includes(s.status));
  const past = filtered.filter((s: any) => ["finalizado", "encerrada"].includes(s.status));

  const getPatientLink = (roomId: string) => `${window.location.origin}/sala/${roomId}`;

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const sendWhatsApp = (phone: string | null, nome: string, link: string) => {
    const cleanPhone = phone?.replace(/\D/g, "") || "";
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const msg = `Olá ${nome}! 😊\n\nSua teleconsulta está pronta. Acesse pelo link abaixo:\n\n📹 ${link}\n\nBasta clicar no link no horário agendado. Aguardamos você!`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // ─── Session Card ───
  const SessionCard = ({ session }: { session: any }) => {
    const sc = statusConfig[session.status] || statusConfig.aguardando;
    const hasTranscript = !!session.transcricao_bruta;
    const hasSummary = !!session.resumo_clinico;
    const durationMin = session.duration_seconds ? Math.floor(session.duration_seconds / 60) : null;
    const patientLink = session.room_id ? getPatientLink(session.room_id) : "";
    const scheduledAt = session.agendamentos?.data_horario;

    return (
      <Card className="hover:border-primary/40 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 cursor-pointer"
              onClick={() => navigate(`/teleconsulta?session=${session.id}`)}>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {session.pacientes?.nome || "Sessão Avulsa"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scheduledAt
                    ? format(new Date(scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : format(new Date(session.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {durationMin && ` • ${durationMin}min`}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>
                {sc.label}
              </span>
              <div className="flex gap-1">
                {hasTranscript && <Mic className="h-3.5 w-3.5 text-primary" title="Transcrição disponível" />}
                {hasSummary && <FileText className="h-3.5 w-3.5 text-green-600" title="Resumo clínico" />}
              </div>
            </div>
          </div>

          {/* Link do paciente */}
          {patientLink && session.status !== "finalizado" && session.status !== "encerrada" && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LinkIcon className="h-3 w-3" />
                <span className="font-medium">Link para o paciente:</span>
              </div>
              <div className="flex gap-1.5">
                <Input readOnly value={patientLink} className="text-xs font-mono h-8" />
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyLink(patientLink)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-2">
                {session.pacientes?.telefone && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1"
                    onClick={() => sendWhatsApp(session.pacientes?.telefone, session.pacientes?.nome || "", patientLink)}>
                    <Share2 className="h-3 w-3" /> WhatsApp
                  </Button>
                )}
                <Button size="sm" className="gap-1.5 text-xs flex-1"
                  onClick={() => navigate(`/teleconsulta?session=${session.id}`)}>
                  <Video className="h-3 w-3" /> Entrar
                </Button>
              </div>
            </div>
          )}

          {/* Past session actions */}
          {(session.status === "finalizado" || session.status === "encerrada") && (
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1"
                onClick={() => navigate(`/teleconsulta?session=${session.id}`)}>
                <FileText className="h-3 w-3" /> Ver detalhes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Scheduled Appointment Card ───
  const AppointmentCard = ({ appointment }: { appointment: any }) => {
    const scheduled = new Date(appointment.data_horario);
    const isUpcoming = !isPast(scheduled);
    const roomId = `essencial-fisio-${appointment.id.slice(0, 8)}`;
    const patientLink = getPatientLink(roomId);

    return (
      <Card className="hover:border-primary/40 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {appointment.pacientes?.nome || "Paciente"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(scheduled, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {appointment.duracao_minutos && ` • ${appointment.duracao_minutos}min`}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={isUpcoming ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted"}>
              {isUpcoming ? "Agendada" : "Passada"}
            </Badge>
          </div>

          <div className="mt-3 pt-3 border-t space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LinkIcon className="h-3 w-3" />
              <span className="font-medium">Link para o paciente:</span>
            </div>
            <div className="flex gap-1.5">
              <Input readOnly value={patientLink} className="text-xs font-mono h-8" />
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyLink(patientLink)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex gap-2">
              {appointment.pacientes?.telefone && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1"
                  onClick={() => sendWhatsApp(appointment.pacientes?.telefone, appointment.pacientes?.nome || "", patientLink)}>
                  <Share2 className="h-3 w-3" /> WhatsApp
                </Button>
              )}
              <Button size="sm" className="gap-1.5 text-xs flex-1"
                onClick={() => navigate(`/teleconsulta?agendamento=${appointment.id}`)}>
                <Video className="h-3 w-3" /> Iniciar Sala
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" /> Teleconsulta
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Atendimentos por vídeo com transcrição automática e IA
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isProfOrAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate("/planos-exercicios")} className="gap-2">
                <Activity className="h-4 w-4" /> Planos de Exercícios
              </Button>
              <Button size="sm" onClick={() => navigate("/teleconsulta?nova=1")} className="gap-2">
                <Plus className="h-4 w-4" /> Nova Teleconsulta
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Agendadas</p>
              <p className="text-xl font-bold">{scheduledAppointments.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-xs text-muted-foreground">Ativas</p>
              <p className="text-xl font-bold">{active.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Com transcrição</p>
              <p className="text-xl font-bold">
                {sessions.filter((s: any) => s.transcricao_bruta).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Com resumo IA</p>
              <p className="text-xl font-bold">
                {sessions.filter((s: any) => s.resumo_clinico).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* How it works */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-primary mb-3">Como funciona</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Video, text: "Inicie a teleconsulta" },
              { icon: Mic, text: "Transcrição automática em pt-BR" },
              { icon: FileText, text: "IA gera resumo clínico" },
              { icon: CheckCircle2, text: "Salvo no prontuário do paciente" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Sessions */}
      <Tabs defaultValue="agendadas">
        <TabsList>
          <TabsTrigger value="agendadas">
            Agendadas {filteredAppointments.length > 0 && <Badge variant="default" className="ml-1.5 h-5">{filteredAppointments.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="ativas">
            Ativas {active.length > 0 && <Badge variant="default" className="ml-1.5 h-5">{active.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="agendadas" className="mt-4 space-y-3">
          {filteredAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma teleconsulta agendada</p>
              {isProfOrAdmin && (
                <Button className="mt-4 gap-2" onClick={() => navigate("/agenda")}>
                  <Calendar className="h-4 w-4" /> Agendar na Agenda
                </Button>
              )}
            </div>
          ) : (
            filteredAppointments.map((a: any) => <AppointmentCard key={a.id} appointment={a} />)
          )}
        </TabsContent>

        <TabsContent value="ativas" className="mt-4 space-y-3">
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Video className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma teleconsulta ativa no momento</p>
            </div>
          ) : (
            active.map((s: any) => <SessionCard key={s.id} session={s} />)
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-3">
          {past.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma teleconsulta finalizada</p>
            </div>
          ) : (
            past.map((s: any) => <SessionCard key={s.id} session={s} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
