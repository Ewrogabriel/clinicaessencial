import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import type { Anomaly } from "@/modules/finance/services/anomalyDetectionService";

interface ReconciliationDashboardProps {
  transactions: BankTransactionRow[];
  anomalies: Record<string, Anomaly[]>;
  autoStats?: { autoReconciled: number; suggested: number; totalProcessed: number };
}

function daysDiff(dateStr: string): number {
  const txDate = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function ReconciliationDashboard({
  transactions,
  anomalies,
  autoStats,
}: ReconciliationDashboardProps) {
  const stats = useMemo(() => {
    const total = transactions.length;
    const conciliados = transactions.filter((t) => t.status === "conciliado");
    const pendentes = transactions.filter((t) => !t.status || t.status === "pendente");
    const rejeitados = transactions.filter((t) => t.status === "rejeitado");
    const creditos = transactions.filter((t) => t.tipo === "credito" && t.valor > 0);
    const debitos = transactions.filter((t) => t.tipo === "debito" || t.valor < 0);

    const totalCreditos = creditos.reduce((s, t) => s + Math.abs(t.valor), 0);
    const totalDebitos = debitos.reduce((s, t) => s + Math.abs(t.valor), 0);

    const taxaReconciliacao = total > 0 ? (conciliados.length / total) * 100 : 0;

    const anomalyCount = Object.keys(anomalies).length;

    // Transactions pending for 30+ days
    const longPending = pendentes.filter((t) => daysDiff(t.data_transacao) >= 30).length;

    // Average days to reconcile
    const reconciledWithDate = conciliados.filter((t) => t.data_conciliacao);
    const avgDaysToReconcile =
      reconciledWithDate.length > 0
        ? reconciledWithDate.reduce((s, t) => {
            const txDate = new Date(t.data_transacao).getTime();
            const concDate = new Date(t.data_conciliacao!).getTime();
            return s + Math.abs(concDate - txDate) / (1000 * 60 * 60 * 24);
          }, 0) / reconciledWithDate.length
        : 0;

    return {
      total,
      conciliados: conciliados.length,
      pendentes: pendentes.length,
      rejeitados: rejeitados.length,
      totalCreditos,
      totalDebitos,
      saldoLiquido: totalCreditos - totalDebitos,
      taxaReconciliacao,
      anomalyCount,
      longPending,
      avgDaysToReconcile: Math.round(avgDaysToReconcile),
    };
  }, [transactions, anomalies]);

  const kpis = [
    {
      title: "Taxa de Conciliação",
      value: `${stats.taxaReconciliacao.toFixed(1)}%`,
      sub: `${stats.conciliados} de ${stats.total}`,
      icon: <TrendingUp className="h-4 w-4" />,
      color: stats.taxaReconciliacao >= 80 ? "text-green-600" : "text-orange-600",
    },
    {
      title: "Créditos",
      value: formatBRL(stats.totalCreditos),
      sub: `${transactions.filter((t) => t.tipo === "credito" && t.valor > 0).length} transações`,
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      color: "text-green-700",
    },
    {
      title: "Débitos",
      value: formatBRL(stats.totalDebitos),
      sub: `${transactions.filter((t) => t.tipo === "debito" || t.valor < 0).length} transações`,
      icon: <TrendingDown className="h-4 w-4 text-red-600" />,
      color: "text-red-700",
    },
    {
      title: "Pendentes",
      value: String(stats.pendentes),
      sub: stats.longPending > 0 ? `${stats.longPending} há 30+ dias` : "Nenhum atrasado",
      icon: <Clock className="h-4 w-4 text-orange-500" />,
      color: stats.pendentes > 0 ? "text-orange-600" : "text-muted-foreground",
    },
    {
      title: "Anomalias",
      value: String(stats.anomalyCount),
      sub: stats.anomalyCount > 0 ? "Requerem atenção" : "Tudo ok",
      icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
      color: stats.anomalyCount > 0 ? "text-yellow-700" : "text-muted-foreground",
    },
    {
      title: "Auto-conciliados hoje",
      value: String(autoStats?.autoReconciled ?? 0),
      sub: autoStats ? `${autoStats.suggested} sugeridos` : "N/A",
      icon: <Zap className="h-4 w-4 text-blue-600" />,
      color: "text-blue-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="relative overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {kpi.icon}
              {kpi.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
