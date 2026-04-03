import { TrendingDown, TrendingUp, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { SummaryCard } from "./SummaryCard";
import type { PaymentSummary } from "./types";

interface PaymentSummaryCardsProps {
  summary: PaymentSummary;
}

export function PaymentSummaryCards({ summary }: PaymentSummaryCardsProps) {
  const cards = [
    {
      label: "Total Débito",
      value: summary.totalDebito,
      icon: TrendingDown,
      colorClass: "border-red-100 bg-red-50/50 text-red-700",
    },
    {
      label: "Total Pago",
      value: summary.totalPago,
      icon: TrendingUp,
      colorClass: "border-green-100 bg-green-50/50 text-green-700",
    },
    {
      label: "Saldo",
      value: summary.saldo,
      icon: AlertCircle,
      colorClass: "border-orange-100 bg-orange-50/50 text-orange-700",
    },
    {
      label: "Pendente",
      value: summary.totalPendente,
      icon: Clock,
      colorClass: "border-yellow-100 bg-yellow-50/50 text-yellow-700",
    },
    {
      label: "Atrasado",
      value: summary.totalAtrasado,
      icon: AlertTriangle,
      colorClass: "border-red-200 bg-red-100/50 text-red-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </div>
  );
}
