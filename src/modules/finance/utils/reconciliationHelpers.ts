import type { BankTransaction } from "../services/reconciliationService";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export type TransactionStatus = "pendente" | "aprovado" | "rejeitado";

/**
 * Returns a human-readable label and Tailwind color class for a status.
 */
export function getStatusConfig(status: string | null): {
  label: string;
  className: string;
} {
  switch (status) {
    case "aprovado":
      return {
        label: "Aprovado",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
      };
    case "rejeitado":
      return {
        label: "Rejeitado",
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
      };
    default:
      return {
        label: "Pendente",
        className:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200",
      };
  }
}

/**
 * Format a BRL currency value.
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Format a transaction date to a localized string.
 */
export function formatTransactionDate(
  dateStr: string,
  pattern = "dd/MM/yyyy"
): string {
  try {
    return format(parseISO(dateStr), pattern, { locale: ptBR });
  } catch {
    return dateStr;
  }
}

/**
 * Sort transactions: pending first, then by date desc.
 */
export function sortTransactions(
  transactions: BankTransaction[]
): BankTransaction[] {
  return [...transactions].sort((a, b) => {
    const statusOrder = { pendente: 0, aprovado: 1, rejeitado: 2 };
    const aOrder = statusOrder[(a.status ?? "pendente") as TransactionStatus] ?? 0;
    const bOrder = statusOrder[(b.status ?? "pendente") as TransactionStatus] ?? 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (
      new Date(b.data_transacao).getTime() -
      new Date(a.data_transacao).getTime()
    );
  });
}

/**
 * Group transactions by date (YYYY-MM-DD).
 */
export function groupTransactionsByDate(
  transactions: BankTransaction[]
): Record<string, BankTransaction[]> {
  return transactions.reduce<Record<string, BankTransaction[]>>((acc, tx) => {
    const dateKey = tx.data_transacao.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(tx);
    return acc;
  }, {});
}

/**
 * Check if a transaction was reviewed within the last 5 minutes
 * (used to show the Undo button).
 */
export function canUndo(transaction: BankTransaction): boolean {
  if (!transaction.reviewed_at) return false;
  const reviewedAt = new Date(transaction.reviewed_at);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return reviewedAt >= fiveMinutesAgo;
}

/**
 * Calculate a running balance for a list of transactions, sorted by date.
 */
export function calcRunningBalance(
  transactions: BankTransaction[]
): Array<BankTransaction & { runningBalance: number }> {
  let balance = 0;
  return [...transactions]
    .sort(
      (a, b) =>
        new Date(a.data_transacao).getTime() -
        new Date(b.data_transacao).getTime()
    )
    .map((tx) => {
      if (tx.tipo === "credito" || Number(tx.valor) > 0) {
        balance += Number(tx.valor);
      } else {
        balance -= Math.abs(Number(tx.valor));
      }
      return { ...tx, runningBalance: balance };
    });
}
