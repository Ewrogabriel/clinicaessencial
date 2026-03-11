import { usePlanLimit } from "@/modules/clinic/hooks/usePlanLimits";
import { AlertTriangle } from "lucide-react";

interface PlanLimitBannerProps {
  resource: string;
  label?: string;
}

export function PlanLimitBanner({ resource, label }: PlanLimitBannerProps) {
  const { data: limit } = usePlanLimit(resource);

  if (!limit || limit.max === -1 || limit.allowed) return null;

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 flex items-center gap-3 mb-4">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <div>
        <p className="text-sm font-medium text-destructive">
          Limite do plano atingido
        </p>
        <p className="text-xs text-muted-foreground">
          {label || resource}: {limit.current}/{limit.max} utilizados. 
          Faça upgrade do plano para continuar adicionando.
        </p>
      </div>
    </div>
  );
}

export function usePlanLimitCheck(resource: string) {
  const { data: limit } = usePlanLimit(resource);
  const isAtLimit = limit ? !limit.allowed && limit.max !== -1 : false;
  return { isAtLimit, current: limit?.current ?? 0, max: limit?.max ?? -1 };
}
