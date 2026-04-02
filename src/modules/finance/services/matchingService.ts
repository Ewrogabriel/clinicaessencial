import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import type { MatchResult } from "../types";

interface PaymentCandidate {
  id: string;
  valor: number;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  descricao?: string | null;
  paciente_nome?: string | null;
  status_pagamento?: string | null;
}

interface TransactionCandidate {
  id: string;
  valor: number;
  data_transacao: string;
  descricao: string;
}

function daysDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function descriptionOverlap(descA: string, descB: string): number {
  const a = normalizeText(descA);
  const b = normalizeText(descB);
  if (!a || !b) return 0;
  const wordsA = a.split(" ").filter((w) => w.length > 3);
  if (wordsA.length === 0) return 0;
  const matches = wordsA.filter((w) => b.includes(w)).length;
  return matches / wordsA.length;
}

/**
 * Score a single (transaction, payment) pair.
 * Returns 0–100.
 */
export function scoreMatch(
  tx: TransactionCandidate,
  payment: PaymentCandidate
): { score: number; reason: string } {
  const txVal = Math.abs(tx.valor);
  const pyVal = Math.abs(payment.valor);

  // Both zero: perfect value match
  if (txVal === 0 && pyVal === 0) {
    // Fall through to date/description scoring
  } else {
    // Value must be within 5% to be considered at all
    const valDiff = pyVal > 0 ? Math.abs(txVal - pyVal) / pyVal : (txVal > 0 ? 1 : 0);
    if (valDiff > 0.05) return { score: 0, reason: "Valor muito diferente" };
  }

  let score = 0;
  const reasons: string[] = [];

  // Exact value match scoring
  const valDiff =
    txVal === 0 && pyVal === 0
      ? 0
      : pyVal > 0
      ? Math.abs(txVal - pyVal) / pyVal
      : txVal > 0
      ? 1
      : 0;

  if (valDiff === 0) {
    score += 50;
    reasons.push("valor exato");
  } else {
    score += Math.round((1 - valDiff / 0.05) * 30);
    reasons.push("valor próximo");
  }

  // Date proximity
  const refDate =
    payment.data_pagamento ?? payment.data_vencimento ?? null;
  if (refDate) {
    const days = daysDiff(tx.data_transacao, refDate);
    if (days <= 1) {
      score += 40;
      reasons.push("data exata");
    } else if (days <= 7) {
      score += 25;
      reasons.push(`${Math.round(days)}d de diferença`);
    } else if (days <= 14) {
      score += 10;
      reasons.push(`${Math.round(days)}d de diferença`);
    }
  }

  // Description overlap
  const candidateDesc = [
    payment.descricao ?? "",
    payment.paciente_nome ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const overlap = descriptionOverlap(tx.descricao, candidateDesc);
  if (overlap > 0) {
    score += Math.round(overlap * 10);
    reasons.push("descrição similar");
  }

  return {
    score: Math.min(score, 100),
    reason: reasons.join(", "),
  };
}

/**
 * Find top-3 matches for a single transaction from a list of payments.
 */
export function suggestMatches(
  tx: TransactionCandidate,
  payments: PaymentCandidate[],
  topN = 3
): MatchResult[] {
  const scored = payments
    .map((p) => {
      const { score, reason } = scoreMatch(tx, p);
      return { payment_id: p.id, confidence: score, reason } as MatchResult;
    })
    .filter((m) => m.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topN);

  return scored;
}

/**
 * Batch match: for each transaction, find the best payment match (if >= 70%).
 * Returns a map of transactionId → MatchResult | null.
 */
export function batchMatch(
  transactions: TransactionCandidate[],
  payments: PaymentCandidate[]
): Map<string, MatchResult | null> {
  const result = new Map<string, MatchResult | null>();

  for (const tx of transactions) {
    const matches = suggestMatches(tx, payments, 1);
    const best = matches[0] ?? null;
    result.set(tx.id, best && best.confidence >= 70 ? best : null);
  }

  return result;
}

export const matchingService = {
  scoreMatch,
  suggestMatches,
  batchMatch,

  /**
   * Persist a match decision on a bank_transaction row.
   * @param confidence - Match confidence in 0–100 range (will be stored as 0–1 fraction in DB)
   */
  async matchTransaction(
    transactionId: string,
    paymentId: string,
    confidence: number
  ): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("bank_transactions")
        .update({
          matched_payment_id: paymentId,
          matched_confidence: confidence / 100,
        })
        .eq("id", transactionId);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao salvar match da transação.");
      throw error;
    }
  },

  /**
   * Remove a match from a transaction.
   */
  async unmatchTransaction(transactionId: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("bank_transactions")
        .update({
          matched_payment_id: null,
          matched_paciente_id: null,
          matched_confidence: null,
        })
        .eq("id", transactionId);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao remover match da transação.");
      throw error;
    }
  },
};
