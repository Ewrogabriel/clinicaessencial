import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard, MetricCardProps } from "./MetricCard";

interface MetricsGridProps {
  metrics: MetricCardProps[];
  columns?: 1 | 2 | 3 | 4;
  gap?: "small" | "medium" | "large";
  loading?: boolean;
}

const gapMap = { small: "gap-2", medium: "gap-4", large: "gap-6" };
const colMap: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function MetricsGrid({
  metrics,
  columns = 4,
  gap = "medium",
  loading = false,
}: MetricsGridProps) {
  const gridClass = `grid ${colMap[columns]} ${gapMap[gap]}`;

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {metrics.map((metric, i) => (
        <MetricCard key={i} {...metric} />
      ))}
    </div>
  );
}
