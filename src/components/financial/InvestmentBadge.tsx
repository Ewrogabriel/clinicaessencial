import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface InvestmentBadgeProps {
  movementType?: string | null;
  small?: boolean;
}

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  aplicacao: { label: "Aplicação", color: "bg-blue-100 text-blue-800" },
  aporte: { label: "Aporte", color: "bg-indigo-100 text-indigo-800" },
  resgate: { label: "Resgate", color: "bg-emerald-100 text-emerald-800" },
  rendimento: { label: "Rendimento", color: "bg-green-100 text-green-800" },
  taxa: { label: "Taxa", color: "bg-red-100 text-red-800" },
  dividendo: { label: "Dividendo", color: "bg-purple-100 text-purple-800" },
};

export function InvestmentBadge({ movementType, small }: InvestmentBadgeProps) {
  const config = movementType ? MOVEMENT_LABELS[movementType] : null;

  if (!config) {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-blue-300 text-blue-700 ${small ? "text-xs" : ""}`}
      >
        <TrendingUp className={small ? "h-2.5 w-2.5" : "h-3 w-3"} />
        Investimento
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={`gap-1 ${config.color} ${small ? "text-xs" : ""}`}
    >
      <TrendingUp className={small ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {config.label}
    </Badge>
  );
}
