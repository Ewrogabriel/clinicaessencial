import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { retryMessage } from "@/modules/whatsapp/services/whatsappLogsService";
import type { WhatsAppMessageLogWithPatient } from "@/modules/whatsapp/services/whatsappLogsService";
import type { MessageType, MessageStatus } from "@/modules/whatsapp/types";

interface WhatsAppLogDetailProps {
  log: WhatsAppMessageLogWithPatient | null;
  open: boolean;
  onClose: () => void;
  onRetried?: () => void;
}

const TYPE_LABELS: Record<MessageType, string> = {
  session_confirmation: "Confirmação de Sessão",
  monthly_reminder: "Lembrete de Mensalidade",
  overdue_alert: "Alerta de Atraso",
};

const STATUS_CONFIG: Record<
  MessageStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  sent: { label: "Enviado", variant: "secondary" },
  delivered: { label: "Entregue", variant: "default" },
  read: { label: "Lido", variant: "default" },
  failed: { label: "Falha", variant: "destructive" },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start">
      <span className="w-44 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function WhatsAppLogDetail({ log, open, onClose, onRetried }: WhatsAppLogDetailProps) {
  const [retrying, setRetrying] = useState(false);

  if (!log) return null;

  const statusCfg = STATUS_CONFIG[log.status] ?? { label: log.status, variant: "outline" as const };

  const handleRetry = async () => {
    setRetrying(true);
    const newId = await retryMessage(log.id);
    setRetrying(false);
    if (newId) {
      toast.success("Mensagem re-enfileirada para envio.");
      onRetried?.();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da Mensagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <Row label="ID do Log" value={<span className="font-mono text-xs break-all">{log.id}</span>} />

          <Separator />

          <Row label="Paciente" value={log.patient_name} />
          <Row label="Telefone" value={log.phone_number} />

          <Separator />

          <Row label="Tipo" value={TYPE_LABELS[log.message_type] ?? log.message_type} />
          <Row
            label="Status"
            value={<Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>}
          />
          <Row label="Data de Envio" value={formatDate(log.sent_at)} />
          <Row
            label="Data de Entrega"
            value={log.delivered_at ? formatDate(log.delivered_at) : <span className="text-muted-foreground text-xs">Não registrada</span>}
          />

          {log.error_message && (
            <>
              <Separator />
              <Row
                label="Erro"
                value={
                  <span className="text-destructive text-sm break-all">{log.error_message}</span>
                }
              />
            </>
          )}

          {log.message_content && (
            <>
              <Separator />
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Conteúdo da Mensagem</span>
                <div className="rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
                  {log.message_content}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {log.status === "failed" && (
            <Button onClick={handleRetry} disabled={retrying} className="gap-2">
              {retrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Enviar Novamente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
