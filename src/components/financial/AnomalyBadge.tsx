import { AlertTriangle, AlertCircle, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Anomaly } from "@/modules/finance/services/anomalyDetectionService";

interface AnomalyBadgeProps {
  anomalies: Anomaly[];
  onResolve?: (anomaly: Anomaly) => void;
}

const ANOMALY_LABELS: Record<string, string> = {
  duplicate: "Duplicada",
  orphan: "Órfã",
  discrepancy: "Discrepância",
  ambiguous: "Ambígua",
  unreconciled: "Pendente",
  negative: "Reembolso",
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "error") return <XCircle className="h-3 w-3" />;
  if (severity === "warning") return <AlertTriangle className="h-3 w-3" />;
  return <Info className="h-3 w-3" />;
}

function severityVariant(severity: string): "destructive" | "secondary" | "outline" {
  if (severity === "error") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
}

export function AnomalyBadge({ anomalies }: AnomalyBadgeProps) {
  if (!anomalies || anomalies.length === 0) return null;

  const worst = anomalies.reduce((a, b) => {
    const rank = { error: 2, warning: 1, info: 0 };
    return (rank[a.severity as keyof typeof rank] ?? 0) >= (rank[b.severity as keyof typeof rank] ?? 0) ? a : b;
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={severityVariant(worst.severity)}
            className="gap-1 cursor-help text-xs h-5"
          >
            <SeverityIcon severity={worst.severity} />
            {anomalies.length > 1 ? `${anomalies.length} anomalias` : ANOMALY_LABELS[worst.anomaly_type] ?? worst.anomaly_type}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <SeverityIcon severity={a.severity} />
                <span className="text-xs">{a.description}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
