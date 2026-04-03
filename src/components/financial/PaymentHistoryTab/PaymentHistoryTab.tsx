import { useState } from "react";

import { PaymentHistoryHeader } from "./PaymentHistoryHeader";
import { PaymentSummaryCards } from "./PaymentSummaryCards";
import { PaymentFiltersBar } from "./PaymentFiltersBar";
import { PaymentTable } from "./PaymentTable";
import { PaymentDetailModal } from "./PaymentDetailModal";
import { usePatientPayments } from "./usePatientPayments";
import { usePaymentFilters } from "./usePaymentFilters";
import { usePaymentSummary } from "./usePaymentSummary";
import type { PaymentEntry, PaymentHistoryTabProps } from "./types";

export function PaymentHistoryTab({ pacienteId, pacienteNome }: PaymentHistoryTabProps) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentEntry | null>(null);

  const { data: payments = [], isLoading } = usePatientPayments(pacienteId);
  const { filters, setFilters, filtered, hasActiveFilters, clearFilters } =
    usePaymentFilters(payments);
  const summary = usePaymentSummary(filtered);

  if (isLoading) {
    return (
      <div className="py-12 text-center animate-pulse text-muted-foreground">
        Carregando histórico de pagamentos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PaymentHistoryHeader pacienteNome={pacienteNome} />

      <PaymentSummaryCards summary={summary} />

      <PaymentFiltersBar
        filters={filters}
        onChange={setFilters}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      <PaymentTable
        payments={filtered}
        allPaymentsCount={payments.length}
        onSelectPayment={setSelectedPayment}
      />

      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
}
