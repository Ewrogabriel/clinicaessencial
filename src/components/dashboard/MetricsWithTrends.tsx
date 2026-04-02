import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Calendar, TrendingUp, DollarSign, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardMetrics } from "@/modules/dashboard/hooks/useDashboardMetrics";
import type { MetricDelta } from "@/modules/dashboard/services/dashboardService";

function DeltaBadge({ delta }: { delta: MetricDelta }) {
  if (delta.trend === "neutral")
    return <span className="flex items-center gap-1 text-muted-foreground text-xs"><Minus className="h-3 w-3" />0%</span>;

  const pct = Math.abs(delta.deltaPercent).toFixed(1);
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        delta.trend === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      )}
    >
      {delta.trend === "up" ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {pct}%
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  valueClassName,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  delta?: MetricDelta;
  valueClassName?: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-sm">{label}</span>
          </div>
          {delta && !isLoading && <DeltaBadge delta={delta} />}
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-28 mt-2" />
        ) : (
          <p className={cn("text-2xl font-bold mt-2", valueClassName)}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Dashboard metrics panel with trend arrows and 1-hour caching.
 * Replaces the ad-hoc KPI calculations in Dashboard.tsx.
 */
export function MetricsWithTrends() {
  const { metrics, isLoading, isRefetching, refresh } = useDashboardMetrics();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Indicadores do Mês
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isRefetching}
          className="h-7 gap-1 text-xs"
        >
          <RefreshCw className={cn("h-3 w-3", isRefetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          icon={Users}
          label="Pacientes Ativos"
          value={metrics?.activePatients ?? 0}
          delta={metrics?.deltas.activePatients}
          isLoading={isLoading}
        />
        <MetricCard
          icon={Calendar}
          label="Sessões do Mês"
          value={metrics?.todayAppointments ?? 0}
          delta={metrics?.deltas.todayAppointments}
          isLoading={isLoading}
        />
        <MetricCard
          icon={TrendingUp}
          label="Taxa de Ocupação"
          value={`${(metrics?.occupancyRate ?? 0).toFixed(0)}%`}
          isLoading={isLoading}
        />
        <MetricCard
          icon={DollarSign}
          label="Receita do Mês"
          value={fmtBRL(metrics?.monthlyRevenue ?? 0)}
          delta={metrics?.deltas.monthlyRevenue}
          valueClassName="text-green-600 dark:text-green-400"
          isLoading={isLoading}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Alertas"
          value={metrics?.pendingAlerts ?? 0}
          valueClassName={
            (metrics?.pendingAlerts ?? 0) > 0
              ? "text-destructive"
              : undefined
          }
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
