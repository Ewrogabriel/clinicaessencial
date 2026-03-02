import { useQuery } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, CircleDot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PatientScheduleTabProps {
  pacienteId: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  agendado: { label: "Agendado", variant: "secondary", icon: <CircleDot className="h-3.5 w-3.5" /> },
  confirmado: { label: "Confirmado", variant: "default", icon: <Clock className="h-3.5 w-3.5" /> },
  realizado: { label: "Realizado", variant: "outline", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelado: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-3.5 w-3.5" /> },
  falta: { label: "Falta", variant: "destructive", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

export const PatientScheduleTab = ({ pacienteId }: PatientScheduleTabProps) => {
  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["agendamentos-paciente", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_horario", { ascending: false }) as any);
      if (error) throw error;

      // Fetch profissional names
      const profIds = [...new Set((data || []).map((a: any) => a.profissional_id))] as string[];
      let profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await (supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", profIds) as any);
        if (profs) {
          profMap = Object.fromEntries(profs.map((p: any) => [p.user_id, p.nome]));
        }
      }
      return (data || []).map((a: any) => ({ ...a, profissional_nome: profMap[a.profissional_id] || "—" }));
    },
    enabled: !!pacienteId,
  });

  const now = new Date();
  const proximos = agendamentos.filter((a: any) => !isPast(new Date(a.data_horario)) || isToday(new Date(a.data_horario)));
  const historico = agendamentos.filter((a: any) => isPast(new Date(a.data_horario)) && !isToday(new Date(a.data_horario)));

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando agenda...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Próximos Atendimentos</CardTitle>
          <CardDescription>{proximos.length} sessão(ões) agendada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {proximos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum atendimento futuro agendado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proximos.map((ag: any) => (
                <ScheduleCard key={ag.id} agendamento={ag} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Atendimentos</CardTitle>
          <CardDescription>{historico.length} sessão(ões) anterior(es)</CardDescription>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhum atendimento anterior registrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((ag: any) => (
                <ScheduleCard key={ag.id} agendamento={ag} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ScheduleCard = ({ agendamento }: { agendamento: any }) => {
  const cfg = statusConfig[agendamento.status] || statusConfig.agendado;
  const dataHorario = new Date(agendamento.data_horario);

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="text-center min-w-[50px]">
        <p className="text-2xl font-bold leading-none">{format(dataHorario, "dd")}</p>
        <p className="text-xs text-muted-foreground uppercase">{format(dataHorario, "MMM", { locale: ptBR })}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            {format(dataHorario, "HH:mm")} — {agendamento.duracao_minutos}min
          </span>
          <Badge variant={cfg.variant} className="gap-1 text-xs">
            {cfg.icon}
            {cfg.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {agendamento.tipo_atendimento.charAt(0).toUpperCase() + agendamento.tipo_atendimento.slice(1)}
          {" • "}{agendamento.tipo_sessao === "grupo" ? "Grupo" : "Individual"}
          {" • Prof. "}{agendamento.profissional_nome}
        </p>
        {agendamento.observacoes && (
          <p className="text-xs text-muted-foreground mt-1 italic truncate">{agendamento.observacoes}</p>
        )}
      </div>
    </div>
  );
};
