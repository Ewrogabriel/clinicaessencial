import { useState } from "react";
import { TrendingUp, DollarSign, Users, AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RevenueChart } from "@/components/master/RevenueChart";
import { useRevenueMetrics, Period } from "@/modules/master/hooks/useRevenueAnalytics";

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    default: "text-primary",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-destructive",
  };
  const iconColor = colorMap[variant ?? "default"];

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <Icon className={`h-8 w-8 shrink-0 mt-1 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold truncate">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          {trend !== undefined && (
            <Badge
              variant={trend >= 0 ? "default" : "destructive"}
              className="mt-1 text-xs"
            >
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "month", label: "Último mês" },
  { value: "quarter", label: "Último trimestre" },
  { value: "year", label: "Último ano" },
];

export default function RevenueAnalytics() {
  const [period, setPeriod] = useState<Period>("quarter");
  const { data, isLoading } = useRevenueMetrics(period);

  const formatCurrency = (v: number) => formatBRL(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Análise de Receita</h1>
            <p className="text-muted-foreground text-sm">
              MRR, CAC, LTV e métricas de crescimento
            </p>
          </div>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="MRR (Receita Mensal Recorrente)"
          value={isLoading ? "…" : formatCurrency(data?.mrr ?? 0)}
          icon={DollarSign}
          trend={data?.growth}
          variant="success"
        />
        <KpiCard
          title="CAC (Custo de Aquisição)"
          value={isLoading ? "…" : formatCurrency(data?.cac ?? 0)}
          subtitle="por clínica"
          icon={TrendingDown}
          variant="warning"
        />
        <KpiCard
          title="LTV (Valor do Tempo de Vida)"
          value={isLoading ? "…" : formatCurrency(data?.ltv ?? 0)}
          subtitle="projeção 12 meses"
          icon={TrendingUp}
          variant="default"
        />
        <KpiCard
          title="Churn Rate"
          value={isLoading ? "…" : `${(data?.churnRate ?? 0).toFixed(1)}%`}
          subtitle={`${data?.activeClinics ?? 0} clínicas ativas`}
          icon={AlertTriangle}
          variant={(data?.churnRate ?? 0) > 10 ? "danger" : "default"}
        />
      </div>

      {/* Monthly chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Receita Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Carregando dados…
            </div>
          ) : (
            <RevenueChart data={data?.monthly ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Top clinics by revenue (derived from monthly data) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Receita Total</p>
              <p className="text-xl font-bold">
                {isLoading ? "…" : formatCurrency(data?.totalRevenue ?? 0)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Crescimento</p>
              <p className="text-xl font-bold">
                {isLoading ? "…" : `${(data?.growth ?? 0).toFixed(1)}%`}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Clínicas Ativas</p>
              <p className="text-xl font-bold">{isLoading ? "…" : data?.activeClinics ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
