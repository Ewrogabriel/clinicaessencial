import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import type { WhatsAppMessageLogWithPatient } from "@/modules/whatsapp/services/whatsappLogsService";
import type { MessageType, MessageStatus } from "@/modules/whatsapp/types";

interface WhatsAppLogsTableProps {
  logs: WhatsAppMessageLogWithPatient[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onView: (log: WhatsAppMessageLogWithPatient) => void;
  onRetry: (log: WhatsAppMessageLogWithPatient) => void;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string | null | undefined, max = 60) {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function WhatsAppLogsTable({
  logs,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onView,
  onRetry,
}: WhatsAppLogsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Carregando logs…
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Nenhum log encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Mensagem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const statusCfg = STATUS_CONFIG[log.status] ?? {
                label: log.status,
                variant: "outline" as const,
              };
              return (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(log.sent_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{log.patient_name ?? <span className="text-muted-foreground">—</span>}</div>
                    {log.phone_number && (
                      <div className="text-xs text-muted-foreground">{log.phone_number}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {TYPE_LABELS[log.message_type] ?? log.message_type}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs">
                    {truncate(log.message_content)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Ver detalhes"
                        onClick={() => onView(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {log.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-orange-600 hover:text-orange-700"
                          title="Reenviar mensagem"
                          onClick={() => onRetry(log)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          {total} {total === 1 ? "registro" : "registros"} no total
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
