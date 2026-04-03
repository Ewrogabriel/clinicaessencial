import { dateFormats } from "@/modules/shared/utils/dateFormatters";
import { useEffect, useState } from "react";
import { Clock, CheckCircle, XCircle, Edit, Scissors, RotateCcw } from "lucide-react";
import { auditService, AuditLogEntry } from "@/modules/finance/services/auditService";
import { Badge } from "@/components/ui/badge";

interface AuditTrailProps {
  clinicId: string;
  resourceId?: string;
  limit?: number;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  reconcile: <CheckCircle className="h-3 w-3 text-green-600" />,
  auto_reconcile: <CheckCircle className="h-3 w-3 text-blue-600" />,
  split: <Scissors className="h-3 w-3 text-purple-600" />,
  undo: <RotateCcw className="h-3 w-3 text-orange-600" />,
  adjust: <Edit className="h-3 w-3 text-yellow-600" />,
  reject: <XCircle className="h-3 w-3 text-red-600" />,
  edit: <Edit className="h-3 w-3 text-gray-600" />,
  delete: <XCircle className="h-3 w-3 text-red-600" />,
  refund: <RotateCcw className="h-3 w-3 text-orange-600" />,
  config_change: <Edit className="h-3 w-3 text-gray-600" />,
};

const ACTION_LABELS: Record<string, string> = {
  reconcile: "Conciliado",
  auto_reconcile: "Auto-conciliado",
  split: "Split criado",
  undo: "Desfeito",
  adjust: "Ajuste",
  reject: "Rejeitado",
  edit: "Editado",
  delete: "Excluído",
  refund: "Reembolso",
  config_change: "Config. alterada",
};

// formatDate is now imported from shared utils

export function AuditTrail({ clinicId, resourceId, limit = 20 }: AuditTrailProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    setIsLoading(true);
    auditService
      .getLogs(clinicId, { resourceId, limit })
      .then(setLogs)
      .finally(() => setIsLoading(false));
  }, [clinicId, resourceId, limit]);

  if (isLoading) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        Carregando histórico...
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        Nenhum registro de auditoria encontrado
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log, idx) => (
        <div key={log.id ?? idx} className="flex items-start gap-2 text-xs">
          <div className="mt-0.5 shrink-0">
            {ACTION_ICONS[log.action] ?? <Clock className="h-3 w-3" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-4 text-xs px-1">
                {ACTION_LABELS[log.action] ?? log.action}
              </Badge>
              <span className="text-muted-foreground">
                {log.created_at ? formatDate(log.created_at) : ""}
              </span>
            </div>
            {log.reason && (
              <p className="text-muted-foreground mt-0.5 truncate">{log.reason}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
