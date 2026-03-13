import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Trash2, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";

const MinhaAgenda = () => {
  const { patientId } = useAuth();
  const queryClient = useQueryClient();
  const [cancelDialog, setCancelDialog] = useState<{ id: string; open: boolean } | null>(null);
  const [cancelObs, setCancelObs] = useState("");
  const [rescheduleDialog, setRescheduleDialog] = useState<any>(null);

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
      const profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        (profs || []).forEach((p: { user_id: string; nome: string }) => { profMap[p.user_id] = p.nome; });
      }
      return (data || []).map((a: any) => ({
        ...a,
        profiles: { nome: profMap[a.profissional_id] || "Profissional" },
      }));
    },
    enabled: !!patientId,
  });

  // Fetch all professionals for cross-professional reschedule
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
                          onClick={() => setRescheduleDialog(item)}
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

      {/* Reschedule Dialog - uses full calendar with availability */}
      <RescheduleDialog
        open={!!rescheduleDialog}
        onOpenChange={(open) => !open && setRescheduleDialog(null)}
        agendamento={rescheduleDialog}
        onSuccess={() => {
          setRescheduleDialog(null);
          queryClient.invalidateQueries({ queryKey: ["patient-full-agenda"] });
        }}
      />
    </div>
  );
};

export default MinhaAgenda;
