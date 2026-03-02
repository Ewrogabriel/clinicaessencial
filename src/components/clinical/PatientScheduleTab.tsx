import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, CircleDot, Ban, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

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
  const queryClient = useQueryClient();
  const [actionDialog, setActionDialog] = useState<{ open: boolean; agendamento: any; action: "cancelar" | "remarcar" } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["agendamentos-paciente", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_horario", { ascending: true }) as any);
      if (error) throw error;

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

  const proximos = agendamentos
    .filter((a: any) => {
      const d = new Date(a.data_horario);
      return (!isPast(d) || isToday(d)) && a.status !== "cancelado";
    })
    .sort((a: any, b: any) => new Date(a.data_horario).getTime() - new Date(b.data_horario).getTime());

  const historico = agendamentos
    .filter((a: any) => {
      const d = new Date(a.data_horario);
      return (isPast(d) && !isToday(d)) || a.status === "cancelado";
    })
    .sort((a: any, b: any) => new Date(b.data_horario).getTime() - new Date(a.data_horario).getTime());

  const handleAction = async () => {
    if (!actionDialog) return;
    if (!justificativa.trim()) {
      toast({ title: "Informe a justificativa", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const newStatus = actionDialog.action === "cancelar" ? "cancelado" : "agendado";
      const obs = actionDialog.agendamento.observacoes
        ? `${actionDialog.agendamento.observacoes}\n[${actionDialog.action === "cancelar" ? "Cancelado" : "Remarcado"}]: ${justificativa}`
        : `[${actionDialog.action === "cancelar" ? "Cancelado" : "Remarcado"}]: ${justificativa}`;

      const { error } = await (supabase
        .from("agendamentos")
        .update({ status: newStatus, observacoes: obs })
        .eq("id", actionDialog.agendamento.id) as any);
      if (error) throw error;

      toast({ title: actionDialog.action === "cancelar" ? "Agendamento cancelado" : "Agendamento remarcado" });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-paciente", pacienteId] });
      setActionDialog(null);
      setJustificativa("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
                <ScheduleCard
                  key={ag.id}
                  agendamento={ag}
                  showActions
                  onCancel={() => { setActionDialog({ open: true, agendamento: ag, action: "cancelar" }); setJustificativa(""); }}
                  onReschedule={() => { setActionDialog({ open: true, agendamento: ag, action: "remarcar" }); setJustificativa(""); }}
                />
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
                <ScheduleCard
                  key={ag.id}
                  agendamento={ag}
                  showActions={ag.status === "cancelado"}
                  onReschedule={() => { setActionDialog({ open: true, agendamento: ag, action: "remarcar" }); setJustificativa(""); }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de justificativa */}
      <Dialog open={!!actionDialog?.open} onOpenChange={(open) => { if (!open) setActionDialog(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "cancelar" ? "Cancelar Agendamento" : "Remarcar Agendamento"}
            </DialogTitle>
          </DialogHeader>
          {actionDialog && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Data:</strong>{" "}
                  {format(new Date(actionDialog.agendamento.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                <p>
                  <strong>Tipo:</strong>{" "}
                  {actionDialog.agendamento.tipo_atendimento.charAt(0).toUpperCase() + actionDialog.agendamento.tipo_atendimento.slice(1)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Justificativa *</label>
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Informe o motivo..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Voltar</Button>
            <Button
              variant={actionDialog?.action === "cancelar" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={saving}
            >
              {saving ? "Salvando..." : actionDialog?.action === "cancelar" ? "Confirmar Cancelamento" : "Confirmar Remarcação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface ScheduleCardProps {
  agendamento: any;
  showActions?: boolean;
  onCancel?: () => void;
  onReschedule?: () => void;
}

const ScheduleCard = ({ agendamento, showActions, onCancel, onReschedule }: ScheduleCardProps) => {
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
      {showActions && (
        <div className="flex gap-1 shrink-0">
          {onCancel && agendamento.status !== "cancelado" && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onCancel} title="Desmarcar">
              <Ban className="h-4 w-4" />
            </Button>
          )}
          {onReschedule && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={onReschedule} title="Remarcar">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
