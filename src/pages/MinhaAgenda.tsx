import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Trash2, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const MinhaAgenda = () => {
  const { patientId, user } = useAuth();
  const queryClient = useQueryClient();
  const [cancelDialog, setCancelDialog] = useState<{ id: string; open: boolean } | null>(null);
  const [cancelObs, setCancelObs] = useState("");
  const [rescheduleDialog, setRescheduleDialog] = useState<any>(null);
  const [rescheduleObs, setRescheduleObs] = useState("");
  const [newDateTime, setNewDateTime] = useState("");
  const [selectedProfId, setSelectedProfId] = useState<string>("");

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["patient-full-agenda", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .order("data_horario", { ascending: false }) as any);
      if (error) throw error;
      // Fetch professional names
      const profIds = [...new Set((data || []).map((a: any) => a.profissional_id))] as string[];
      let profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        (profs || []).forEach((p: any) => { profMap[p.user_id] = p.nome; });
      }
      return (data || []).map((a: any) => ({
        ...a,
        profiles: { nome: profMap[a.profissional_id] || "Profissional" },
      }));
    },
    enabled: !!patientId,
  });

  // Fetch all professionals for cross-professional reschedule
  const { data: profissionais = [] } = useQuery({
    queryKey: ["all-professionals"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome, especialidade");
      // Filter only professionals
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("role", "profissional");
      const profIds = new Set((roles || []).map((r: any) => r.user_id));
      return (data || []).filter((p: any) => profIds.has(p.user_id));
    },
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
    mutationFn: async ({ agendamentoId, novaData, motivo, novoProfId }: { agendamentoId: string; novaData: string; motivo: string; novoProfId: string }) => {
      if (!patientId || !user) throw new Error("Paciente não identificado");
      const ag = rescheduleDialog;
      const isCancelado = ag?.status === "cancelado" || ag?.status === "falta";
      const tipoLabel = isCancelado ? "remarcação" : "reagendamento";

      const { error } = await (supabase
        .from("solicitacoes_remarcacao")
        .insert({
          agendamento_id: agendamentoId,
          paciente_id: patientId,
          nova_data_horario: novaData,
          motivo: novoProfId !== ag?.profissional_id
            ? `[Troca de profissional] ${motivo}`
            : motivo,
        }) as any);
      if (error) throw error;

      const oldProfName = ag?.profiles?.nome || "Profissional";

      if (novoProfId !== ag?.profissional_id) {
        await (supabase.from("notificacoes").insert({
          user_id: novoProfId,
          tipo: isCancelado ? "remarcacao" : "reagendamento",
          titulo: `Solicitação de ${tipoLabel} (novo profissional)`,
          resumo: `Paciente solicita ${tipoLabel} para ${format(new Date(novaData), "dd/MM 'às' HH:mm")}`,
          conteudo: `Paciente solicitou ${tipoLabel} de sessão originalmente com ${oldProfName}.\nNova data: ${format(new Date(novaData), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\nMotivo: ${motivo}`,
          link: "/solicitacoes-alteracao",
        }) as any);
        await (supabase.from("notificacoes").insert({
          user_id: ag.profissional_id,
          tipo: isCancelado ? "remarcacao" : "reagendamento",
          titulo: `Paciente solicitou troca de profissional (${tipoLabel})`,
          resumo: `${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} com outro profissional solicitada`,
          conteudo: `Paciente solicitou ${tipoLabel} para outro profissional.\nData original: ${format(new Date(ag.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\nMotivo: ${motivo}`,
          link: "/solicitacoes-alteracao",
        }) as any);
      } else {
        await (supabase.from("notificacoes").insert({
          user_id: ag.profissional_id,
          tipo: isCancelado ? "remarcacao" : "reagendamento",
          titulo: `Solicitação de ${tipoLabel}`,
          resumo: `${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} para ${format(new Date(novaData), "dd/MM 'às' HH:mm")}`,
          conteudo: `Paciente solicita ${tipoLabel}.\nData ${isCancelado ? "cancelada" : "atual"}: ${format(new Date(ag.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\nNova data: ${format(new Date(novaData), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\nMotivo: ${motivo}`,
          link: "/solicitacoes-alteracao",
        }) as any);
      }

      // Notify admins
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      for (const admin of (adminRoles || [])) {
        if (admin.user_id === ag.profissional_id || admin.user_id === novoProfId) continue;
        await (supabase.from("notificacoes").insert({
          user_id: admin.user_id,
          tipo: isCancelado ? "remarcacao" : "reagendamento",
          titulo: `Nova solicitação de ${tipoLabel}`,
          resumo: `Paciente solicita ${tipoLabel} para ${format(new Date(novaData), "dd/MM 'às' HH:mm")}`,
          link: "/solicitacoes-alteracao",
        }) as any);
      }
    },
    onSuccess: () => {
      const ag = rescheduleDialog;
      const isCancelado = ag?.status === "cancelado" || ag?.status === "falta";
      toast.success(`Solicitação de ${isCancelado ? "remarcação" : "reagendamento"} enviada! Aguarde a confirmação.`);
      setRescheduleDialog(null);
      setRescheduleObs("");
      setNewDateTime("");
      setSelectedProfId("");
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
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => { setRescheduleDialog(item); setRescheduleObs(""); setNewDateTime(""); setSelectedProfId(item.profissional_id); }}
                          title="Solicitar remarcação"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
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

      {/* Cancel Dialog */}
      <AlertDialog open={!!cancelDialog?.open} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente desmarcar?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua sessão será marcada como cancelada. Informe o motivo abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {/* Aviso importante sobre cancelamento */}
          <div className="flex gap-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
            <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold">Importante:</p>
              <p>O cancelamento desta sessão <strong>NÃO reduz o valor da sua mensalidade</strong>. Você continua pagando a mensalidade integral conforme seu contrato.</p>
            </div>
          </div>

          <Textarea value={cancelObs} onChange={(e) => setCancelObs(e.target.value)} placeholder="Motivo do cancelamento..." className="min-h-[80px]" />
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

      {/* Reschedule Dialog - now with professional selector */}
      <Dialog open={!!rescheduleDialog} onOpenChange={(open) => !open && setRescheduleDialog(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Solicitar Remarcação</DialogTitle>
          </DialogHeader>
          {rescheduleDialog && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p><strong>Sessão atual:</strong> {format(new Date(rescheduleDialog.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                <p><strong>Profissional:</strong> {rescheduleDialog.profiles?.nome}</p>
              </div>

              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select value={selectedProfId} onValueChange={setSelectedProfId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o profissional..." /></SelectTrigger>
                  <SelectContent>
                    {profissionais.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.nome}{p.especialidade ? ` — ${p.especialidade}` : ""}
                        {p.user_id === rescheduleDialog.profissional_id ? " (atual)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfId && selectedProfId !== rescheduleDialog.profissional_id && (
                  <p className="text-xs text-amber-600 font-medium">
                    ⚠️ Troca de profissional — dependerá de aprovação e disponibilidade de vaga.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nova data e horário desejado</Label>
                <input
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Textarea value={rescheduleObs} onChange={(e) => setRescheduleObs(e.target.value)} placeholder="Informe o motivo da remarcação..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!newDateTime) { toast.error("Informe a nova data e horário."); return; }
                if (!selectedProfId) { toast.error("Selecione o profissional."); return; }
                rescheduleMutation.mutate({
                  agendamentoId: rescheduleDialog.id,
                  novaData: new Date(newDateTime).toISOString(),
                  motivo: rescheduleObs || "Sem motivo informado",
                  novoProfId: selectedProfId,
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
