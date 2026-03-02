import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Trash2, AlertCircle, RotateCcw, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const MinhaAgenda = () => {
  const { patientId } = useAuth();
  const queryClient = useQueryClient();
  const [cancelDialog, setCancelDialog] = useState<{ id: string; open: boolean } | null>(null);
  const [cancelObs, setCancelObs] = useState("");
  const [rescheduleDialog, setRescheduleDialog] = useState<any>(null);
  const [rescheduleObs, setRescheduleObs] = useState("");
  const [newDateTime, setNewDateTime] = useState("");

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["patient-full-agenda", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("agendamentos")
        .select(`*, profiles:profissional_id (nome)`)
        .eq("paciente_id", patientId)
        .order("data_horario", { ascending: false }) as any);
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, obs }: { id: string; obs: string }) => {
      const ag = agendamentos.find((a: any) => a.id === id);
      const obsText = ag?.observacoes
        ? `${ag.observacoes}\n[Cancelado pelo paciente]: ${obs}`
        : `[Cancelado pelo paciente]: ${obs}`;
      const { error } = await (supabase
        .from("agendamentos")
        .update({ status: "cancelado", observacoes: obsText })
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-full-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["patient-agenda"] });
      toast.success("Sessão desmarcada com sucesso.");
      setCancelDialog(null);
      setCancelObs("");
    },
    onError: (error) => toast.error("Erro ao desmarcar: " + error.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ agendamentoId, novaData, motivo }: { agendamentoId: string; novaData: string; motivo: string }) => {
      if (!patientId) throw new Error("Paciente não identificado");
      const { error } = await (supabase
        .from("solicitacoes_remarcacao")
        .insert({
          agendamento_id: agendamentoId,
          paciente_id: patientId,
          nova_data_horario: novaData,
          motivo,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação de remarcação enviada! Aguarde a confirmação.");
      setRescheduleDialog(null);
      setRescheduleObs("");
      setNewDateTime("");
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    agendado: { label: "Agendado", variant: "outline" },
    confirmado: { label: "Confirmado", variant: "default" },
    realizado: { label: "Realizado", variant: "secondary" },
    cancelado: { label: "Cancelado", variant: "destructive" },
    falta: { label: "Falta", variant: "destructive" },
  };

  const canAct = (status: string) => status !== "cancelado" && status !== "realizado" && status !== "falta";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Minha Agenda</h1>
          <p className="text-muted-foreground">Visualize e gerencie seus horários.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground font-medium italic">Carregando seus horários...</div>
          ) : agendamentos.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum agendamento encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {agendamentos.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {format(new Date(item.data_horario), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.profiles?.nome} • {item.tipo_atendimento} • {item.duracao_minutos}min
                    </p>
                    {item.observacoes && (
                      <p className="text-xs text-muted-foreground mt-1 italic truncate max-w-md">{item.observacoes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusMap[item.status]?.variant || "outline"}>
                      {statusMap[item.status]?.label || item.status}
                    </Badge>
                    {canAct(item.status) && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => { setRescheduleDialog(item); setRescheduleObs(""); setNewDateTime(""); }}
                          title="Solicitar remarcação"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { setCancelDialog({ id: item.id, open: true }); setCancelObs(""); }}
                          title="Desmarcar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p>
          <strong>Política de Cancelamento:</strong> Cancelamentos devem ser realizados com antecedência.
          Sessões desmarcadas no próprio dia do atendimento podem ser cobradas conforme o contrato do seu plano.
        </p>
      </div>

      {/* Cancel Dialog with observations */}
      <AlertDialog open={!!cancelDialog?.open} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente desmarcar?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua sessão será marcada como cancelada. Informe o motivo abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelObs}
            onChange={(e) => setCancelObs(e.target.value)}
            placeholder="Motivo do cancelamento..."
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelDialog && cancelMutation.mutate({ id: cancelDialog.id, obs: cancelObs || "Sem motivo informado" })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Processando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleDialog} onOpenChange={(open) => !open && setRescheduleDialog(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Solicitar Remarcação</DialogTitle>
          </DialogHeader>
          {rescheduleDialog && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p><strong>Sessão atual:</strong> {format(new Date(rescheduleDialog.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                <p><strong>Profissional:</strong> {rescheduleDialog.profiles?.nome}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Nova data e horário desejado</label>
                <input
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Motivo (opcional)</label>
                <Textarea
                  value={rescheduleObs}
                  onChange={(e) => setRescheduleObs(e.target.value)}
                  placeholder="Informe o motivo da remarcação..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!newDateTime) {
                  toast.error("Informe a nova data e horário.");
                  return;
                }
                rescheduleMutation.mutate({
                  agendamentoId: rescheduleDialog.id,
                  novaData: new Date(newDateTime).toISOString(),
                  motivo: rescheduleObs || "Sem motivo informado",
                });
              }}
              disabled={rescheduleMutation.isPending}
            >
              {rescheduleMutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MinhaAgenda;
