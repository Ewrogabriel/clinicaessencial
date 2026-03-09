import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Video, Plus, Clock, CheckCircle2, Users, Search,
  FileText, Mic, Calendar, ChevronRight, Activity,
  Copy, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  aguardando: { label: "Sala de espera", color: "bg-amber-100 text-amber-800" },
  em_andamento: { label: "Em andamento", color: "bg-green-100 text-green-800" },
  finalizado: { label: "Finalizada", color: "bg-muted text-muted-foreground" },
};

export default function TeleconsultaHub() {
  const navigate = useNavigate();
  const { user, profile, isProfissional, isAdmin, isGestor, patientId } = useAuth();
  const { activeClinicId } = useClinic();
  const [search, setSearch] = useState("");
  const isProfOrAdmin = isProfissional || isAdmin || isGestor;

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["teleconsulta-sessions", activeClinicId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("teleconsulta_sessions")
        .select("*, pacientes(nome, telefone)")
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

  const filtered = sessions.filter((s: any) => {
    if (!search) return true;
    const nome = s.pacientes?.nome?.toLowerCase() || "";
    return nome.includes(search.toLowerCase());
  });

  const active = filtered.filter((s: any) => ["aguardando", "em_andamento"].includes(s.status));
  const past = filtered.filter((s: any) => s.status === "finalizado");

  const getTeleconsultaLink = (sessionId: string) => `${window.location.origin}/teleconsulta?session=${sessionId}`;

  const copyLink = (sessionId: string) => {
    navigator.clipboard.writeText(getTeleconsultaLink(sessionId));
    toast.success("Link copiado!");
  };

  const sendWhatsApp = (session: any) => {
    const link = getTeleconsultaLink(session.id);
    const phone = session.pacientes?.telefone?.replace(/\D/g, "") || "";
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = `Olá ${session.pacientes?.nome || ""}! 😊\n\nSua teleconsulta está pronta. Acesse pelo link abaixo:\n${link}\n\nAguardamos você!`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const SessionCard = ({ session }: { session: any }) => {
    const sc = statusConfig[session.status] || statusConfig.aguardando;
    const hasTranscript = !!session.transcricao_bruta;
    const hasSummary = !!session.resumo_clinico;
    const durationMin = session.duration_seconds ? Math.floor(session.duration_seconds / 60) : null;

    return (
      <Card className="hover:border-primary/40 transition-colors group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 cursor-pointer"
              onClick={() => navigate(`/teleconsulta?session=${session.id}`)}>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {session.pacientes?.nome || "Paciente"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(session.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {durationMin && ` • ${durationMin}min`}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>
                {sc.label}
              </span>
              <div className="flex gap-1">
                {hasTranscript && (
                  <span title="Transcrição disponível">
                    <Mic className="h-3.5 w-3.5 text-primary" />
                  </span>
                )}
                {hasSummary && (
                  <span title="Resumo clínico disponível">
                    <FileText className="h-3.5 w-3.5 text-green-600" />
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Action buttons for active sessions */}
          {session.status !== "finalizado" && (
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => copyLink(session.id)}>
                <Copy className="h-3 w-3" /> Copiar Link
              </Button>
              {session.pacientes?.telefone && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => sendWhatsApp(session)}>
                  <ExternalLink className="h-3 w-3" /> Enviar WhatsApp
                </Button>
              )}
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/teleconsulta?session=${session.id}`)}>
                <Video className="h-3 w-3" /> Entrar
              </Button>
            </div>
          )}
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
            <Video className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{sessions.length}</p>
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
          placeholder="Buscar por paciente ou profissional..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Sessions */}
      <Tabs defaultValue="ativas">
        <TabsList>
          <TabsTrigger value="ativas">
            Ativas {active.length > 0 && <Badge variant="default" className="ml-1.5 h-5">{active.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ativas" className="mt-4 space-y-3">
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Video className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma teleconsulta ativa no momento</p>
              {isProfOrAdmin && (
                <Button className="mt-4 gap-2" onClick={() => navigate("/agenda")}>
                  <Calendar className="h-4 w-4" /> Ver Agenda
                </Button>
              )}
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
