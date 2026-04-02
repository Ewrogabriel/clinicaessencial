import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, Calendar, Clock, User, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSendConfirmation } from "@/modules/appointments/hooks/useConfirmation";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

interface ConfirmationDialogProps {
  agendamento: any;
  open: boolean;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  confirmado: {
    label: "Confirmado",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

export function ConfirmationDialog({ agendamento, open, onClose }: ConfirmationDialogProps) {
  const { activeClinicId } = useClinic();
  const sendMutation = useSendConfirmation();

  if (!agendamento) return null;

  const paciente = agendamento.pacientes ?? agendamento.paciente;
  const confirmacao = agendamento.confirmacao_presenca as string | null;
  const enviadoEm: string | null =
    agendamento.confirmacao_enviada_at ?? agendamento.confirmacao_enviada_em ?? null;

  const dataFmt = agendamento.data_horario
    ? format(parseISO(agendamento.data_horario), "dd/MM/yyyy", { locale: ptBR })
    : "—";
  const horaFmt = agendamento.data_horario
    ? format(parseISO(agendamento.data_horario), "HH:mm")
    : "—";
  const diaSemana = agendamento.data_horario
    ? format(parseISO(agendamento.data_horario), "EEEE", { locale: ptBR })
    : "";

  const handleSend = async () => {
    if (!activeClinicId) return;
    await sendMutation.mutateAsync({
      agendamentoId: agendamento.id,
      clinicId: activeClinicId,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Enviar Confirmação via WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Patient info */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{paciente?.nome ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="capitalize">
                {diaSemana}, {dataFmt}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{horaFmt}</span>
            </div>
          </div>

          {/* Confirmation status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status de confirmação:</span>
            {confirmacao ? (
              <Badge className={`gap-1 ${statusConfig[confirmacao]?.className ?? ""}`}>
                {confirmacao === "confirmado" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {statusConfig[confirmacao]?.label ?? confirmacao}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Aguardando resposta
              </Badge>
            )}
          </div>

          {/* Last sent timestamp */}
          {enviadoEm && (
            <p className="text-xs text-muted-foreground italic">
              Último envio:{" "}
              {format(parseISO(enviadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}

          {!paciente?.telefone && (
            <p className="text-xs text-destructive">
              ⚠️ Paciente sem telefone cadastrado. Não é possível enviar a confirmação.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sendMutation.isPending}>
            Fechar
          </Button>
          <Button
            className="gap-2 bg-green-600 hover:bg-green-700 text-white border-0"
            onClick={handleSend}
            disabled={!paciente?.telefone || sendMutation.isPending}
          >
            <MessageCircle className="h-4 w-4" />
            {sendMutation.isPending ? "Enviando..." : enviadoEm ? "Reenviar" : "Enviar WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
