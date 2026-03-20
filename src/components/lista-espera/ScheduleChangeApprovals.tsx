import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
};

const ScheduleChangeApprovals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["solicitacoes-mudanca"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("solicitacoes_mudanca_horario") as any)
        .select("*, pacientes(nome, telefone), matriculas(tipo_atendimento, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("solicitacoes_mudanca_horario") as any)
        .update({ status: "aprovado", aprovador_id: user?.id, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-mudanca"] });
      toast.success("Solicitação aprovada!");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await (supabase.from("solicitacoes_mudanca_horario") as any)
        .update({ status: "rejeitado", aprovador_id: user?.id, motivo_rejeicao: motivo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-mudanca"] });
      setRejectDialog({ open: false, id: "" });
      setRejectReason("");
      toast.success("Solicitação rejeitada.");
    },
  });

  const pending = requests.filter((r: any) => r.status === "pendente");

  if (isLoading) return <p className="p-8 text-center text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {pending.length} solicitação(ões) pendente(s)
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {requests.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhuma solicitação</p>
          <p className="text-sm">Não há solicitações de mudança de horário pendentes.</p>
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {requests.map((req: any) => (
            <div key={req.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{req.pacientes?.nome || "Paciente"}</p>
                <p className="text-xs text-muted-foreground">
                  {req.matriculas?.tipo_atendimento}
                </p>
                <div className="flex gap-4 text-xs mt-1">
                  <span className="text-muted-foreground">
                    Atual: {req.dia_semana_atual?.map((d: number) => DIAS_SEMANA[d]).join(", ") || "—"} {req.horario_atual || ""}
                  </span>
                  <span className="text-primary font-medium">
                    → Novo: {req.dia_semana_novo?.map((d: number) => DIAS_SEMANA[d]).join(", ")} {req.horario_novo}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
                {req.motivo_rejeicao && (
                  <p className="text-xs text-destructive mt-1">Motivo: {req.motivo_rejeicao}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={statusMap[req.status]?.variant || "outline"}>
                  {statusMap[req.status]?.label || req.status}
                </Badge>
                {req.status === "pendente" && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => approveMutation.mutate(req.id)}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setRejectDialog({ open: true, id: req.id })}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da rejeição</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Informe o motivo..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: "" })}>Cancelar</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate({ id: rejectDialog.id, motivo: rejectReason })} disabled={rejectMutation.isPending}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleChangeApprovals;
