import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Video, Clock, Users, MessageSquare, Calendar, Wifi,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WaitingRoomProps {
  session: any;
  onJoin: () => void;
  isProfessional: boolean;
}

function useParticipantCount(sessionId: string) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const channel = supabase.channel(`waiting-room-${sessionId}`, {
      config: { presence: { key: sessionId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return count;
}

function useCountdown(scheduledAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!scheduledAt) return;
    const target = new Date(scheduledAt);
    if (isPast(target)) return;

    const tick = () => {
      const secs = differenceInSeconds(target, new Date());
      setRemaining(secs > 0 ? secs : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  return remaining;
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function WaitingRoom({ session, onJoin, isProfessional }: WaitingRoomProps) {
  const patientName: string = session.pacientes?.nome ?? "Paciente";
  // Prefer the session's own scheduled_at; fall back to the linked appointment time
  const effectiveScheduledAt: string | null = session.scheduled_at ?? session.agendamentos?.data_horario ?? null;
  const participantCount = useParticipantCount(session.id);
  const countdown = useCountdown(effectiveScheduledAt);

  const initials = patientName
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm text-muted-foreground font-medium">Sala de Espera</span>
        </div>
        <h2 className="text-2xl font-bold">
          {isProfessional ? "Pronto para iniciar?" : "Aguardando atendimento"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isProfessional
            ? "O paciente está na sala de espera."
            : "O profissional entrará em breve."}
        </p>
      </div>

      {/* Patient card */}
      <Card className="w-full">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base truncate">{patientName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isProfessional ? "Paciente" : "Consulta agendada"}
              </p>
              {effectiveScheduledAt && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(effectiveScheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 shrink-0"
            >
              {session.status === "aguardando" ? "Aguardando" : "Em andamento"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-lg font-bold">{participantCount}</span>
          <span className="text-xs text-muted-foreground text-center">
            {participantCount === 1 ? "Participante" : "Participantes"}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50">
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-lg font-bold text-green-600">OK</span>
          <span className="text-xs text-muted-foreground">Conexão</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            {countdown !== null
              ? formatCountdown(countdown)
              : effectiveScheduledAt
              ? formatDistanceToNow(new Date(effectiveScheduledAt), { locale: ptBR, addSuffix: true })
              : "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            {countdown !== null ? "Inicia em" : "Agendada"}
          </span>
        </div>
      </div>

      {/* Countdown banner */}
      {countdown !== null && (
        <div className="w-full rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Sessão começa em</p>
          <p className="text-3xl font-mono font-bold text-primary">{formatCountdown(countdown)}</p>
        </div>
      )}

      {/* Chat placeholder */}
      <Card className="w-full opacity-60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Chat da Sala (disponível durante a consulta)</span>
          </div>
          <div className="h-16 rounded-lg bg-muted/40 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Chat iniciará quando a sessão começar</p>
          </div>
        </CardContent>
      </Card>

      {/* Join button */}
      <Button
        size="lg"
        className="w-full gap-2 h-12 text-base"
        onClick={onJoin}
      >
        <Video className="h-5 w-5" />
        {isProfessional ? "Iniciar Sessão" : "Entrar na Consulta"}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Certifique-se de que sua câmera e microfone estão habilitados antes de entrar.
      </p>
    </div>
  );
}
