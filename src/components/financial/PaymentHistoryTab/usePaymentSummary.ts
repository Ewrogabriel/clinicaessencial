import { useMemo } from "react";
import type { PaymentEntry, PaymentSummary } from "./types";

export function usePaymentSummary(payments: PaymentEntry[]): PaymentSummary {
  return useMemo(() => {
    const totalDebito = payments
      .filter((p) => p.status !== "reembolsado" && p.status !== "cancelado")
      .reduce((sum, p) => sum + p.valor, 0);

    const totalPago = payments
      .filter((p) => p.status === "pago")
      .reduce((sum, p) => sum + p.valor, 0);

    const totalPendente = payments
      .filter((p) =>
        ["pendente", "aberto", "nao_iniciado", "parcialmente_pago"].includes(p.status)
      )
      .reduce((sum, p) => sum + p.valor, 0);

    const totalAtrasado = payments
      .filter((p) => p.status === "atrasado" || p.status === "vencido")
      .reduce((sum, p) => sum + p.valor, 0);

    const saldo = totalDebito - totalPago;

    return { totalDebito, totalPago, saldo, totalPendente, totalAtrasado };
  }, [payments]);
}
