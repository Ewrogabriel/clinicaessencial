import type { ReviewEntry } from "../types";

export interface AuditableTransaction {
  review_history?: ReviewEntry[] | null | unknown;
}

/**
 * Append a new review entry to a transaction's audit history.
 * Returns the updated history array (does not mutate the original).
 */
export function addReviewToHistory(
  transaction: AuditableTransaction,
  action: ReviewEntry["action"],
  reviewerId: string,
  note?: string | null
): ReviewEntry[] {
  const existing = getReviewTimeline(transaction);
  const entry: ReviewEntry = {
    action,
    reviewer_id: reviewerId,
    timestamp: new Date().toISOString(),
    note: note ?? null,
  };
  return [...existing, entry];
}

/**
 * Return the typed audit trail for a transaction.
 */
export function getReviewTimeline(
  transaction: AuditableTransaction
): ReviewEntry[] {
  const raw = transaction.review_history;
  if (!Array.isArray(raw)) return [];
  return raw as ReviewEntry[];
}

/**
 * Human-readable label for an audit action.
 */
export function auditActionLabel(action: ReviewEntry["action"]): string {
  switch (action) {
    case "approve":
      return "Aprovado";
    case "reject":
      return "Rejeitado";
    case "match":
      return "Associado a pagamento";
    case "unmatch":
      return "Associação removida";
    default:
      return action;
  }
}
