import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import type { MatchResult } from "../types";

export interface MatchingResult {
  transactionId: string;
  paymentId: string;
  confianca: number;
  motivo: string;
}

export interface PossibleMatch {
  paymentId: string;
  descricao: string;
  valor: number;
  data_pagamento: string;
  confianca: number;
}

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

  /**
   * Auto-matching: encontra correspondências automáticas entre transações e pagamentos.
   * Critérios: valor (50%), data (30%), descrição (20%). Confiança mínima: 0.75.
   */
  async autoMatchTransactions(clinicId: string): Promise<MatchingResult[]> {
    try {
      const { data: transactions, error: txError } = await (supabase as any)
        .from("bank_transactions")
        .select("*")
        .eq("clinic_id", clinicId)
        .is("status", null)
        .order("data_transacao", { ascending: false });

      if (txError) throw txError;

      const { data: payments, error: payError } = await (supabase as any)
        .from("pagamentos")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("status_pagamento", "pago")
        .is("bank_transaction_id", null);

      if (payError) throw payError;

      const matches: MatchingResult[] = [];
      const usedPayments = new Set<string>();

      for (const tx of (transactions as any[]) || []) {
        let bestMatch: MatchingResult | null = null;

        for (const pag of (payments as any[]) || []) {
          if (usedPayments.has(pag.id)) continue;

          const confianca = this.calculateConfidence(tx, pag);

          if (confianca >= 0.75) {
            if (!bestMatch || confianca > bestMatch.confianca) {
              bestMatch = {
                transactionId: tx.id,
                paymentId: pag.id,
                confianca,
                motivo: this.getMotivo(tx, pag, confianca),
              };
            }
          }
        }

        if (bestMatch) {
          matches.push(bestMatch);
          usedPayments.add(bestMatch.paymentId);
        }
      }

      return matches;
    } catch (error) {
      handleError(error, "Erro no matching automático");
      return [];
    }
  },

  /**
   * Calcular score de confiança entre transação e pagamento.
   * Critérios: valor (50%), data (30%), descrição (20%). Retorna 0–1.
   */
  calculateConfidence(transaction: any, payment: any): number {
    let confianca = 0;
    const pesos = { valor: 0.5, data: 0.3, descricao: 0.2 };

    // 1. VALOR (peso 50%)
    const valorTx = Math.abs(Number(transaction.valor));
    const valorPag = Math.abs(Number(payment.valor));
    const diferenca = Math.abs(valorTx - valorPag);
    const tolerancia = valorPag > 0 ? valorPag * 0.02 : 0;

    if (diferenca === 0) {
      confianca += pesos.valor * 1.0;
    } else if (tolerancia > 0 && diferenca <= tolerancia) {
      confianca += pesos.valor * 0.9;
    } else if (tolerancia > 0 && diferenca <= tolerancia * 2) {
      confianca += pesos.valor * 0.5;
    }

    // 2. DATA (peso 30%)
    const refDate = payment.data_pagamento ?? payment.data_vencimento ?? null;
    if (refDate) {
      const diffDias =
        Math.abs(
          new Date(transaction.data_transacao).getTime() -
            new Date(refDate).getTime()
        ) /
        (1000 * 60 * 60 * 24);

      if (diffDias === 0) {
        confianca += pesos.data * 1.0;
      } else if (diffDias <= 1) {
        confianca += pesos.data * 0.9;
      } else if (diffDias <= 3) {
        confianca += pesos.data * 0.7;
      } else if (diffDias <= 7) {
        confianca += pesos.data * 0.4;
      }
    }

    // 3. DESCRIÇÃO (peso 20%)
    const descTx = (transaction.descricao ?? "").toLowerCase().trim();
    const candidateDesc = [
      payment.descricao ?? "",
      payment.paciente_nome ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .trim();

    if (descTx && candidateDesc) {
      if (descTx === candidateDesc) {
        confianca += pesos.descricao * 1.0;
      } else if (
        descTx.includes(candidateDesc) ||
        candidateDesc.includes(descTx)
      ) {
        confianca += pesos.descricao * 0.8;
      } else {
        const palavrasTx = descTx.split(" ");
        const palavrasPag = candidateDesc.split(" ");
        const comuns = palavrasTx.filter(
          (p) => p.length > 3 && palavrasPag.includes(p)
        ).length;
        if (comuns > 0) {
          confianca += pesos.descricao * 0.5;
        }
      }
    }

    return Math.min(confianca, 1.0);
  },

  /**
   * Gerar motivo do matching para auditoria.
   */
  getMotivo(tx: any, pag: any, confianca: number): string {
    const razoes: string[] = [];

    const diffValor = Math.abs(Number(tx.valor) - Number(pag.valor));
    if (diffValor === 0) {
      razoes.push("Valor exato");
    } else if (Number(pag.valor) > 0 && diffValor < Number(pag.valor) * 0.02) {
      razoes.push("Valor muito similar");
    }

    const refDate = pag.data_pagamento ?? pag.data_vencimento ?? null;
    if (refDate) {
      const diffDias =
        Math.abs(
          new Date(tx.data_transacao).getTime() - new Date(refDate).getTime()
        ) /
        (1000 * 60 * 60 * 24);
      if (diffDias <= 1) {
        razoes.push("Data próxima");
      }
    }

    const descTx = (tx.descricao ?? "").toLowerCase();
    const descPag = (pag.descricao ?? pag.paciente_nome ?? "").toLowerCase();
    if (descTx && descPag && (descTx.includes(descPag) || descPag.includes(descTx))) {
      razoes.push("Descrição correlata");
    }

    if (razoes.length === 0) {
      razoes.push(`Confiança ${Math.round(confianca * 100)}%`);
    }

    return razoes.join(" + ");
  },

  /**
   * Match manual com validação.
   */
  async manualMatch(
    transactionId: string,
    paymentId: string,
    notas?: string
  ): Promise<void> {
    try {
      const { data: existing } = await (supabase as any)
        .from("bank_transactions")
        .select("id")
        .eq("pagamento_id", paymentId)
        .neq("id", transactionId);

      if (existing && existing.length > 0) {
        throw new Error("Este pagamento já está vinculado a outra transação");
      }

      const { error: txError } = await (supabase as any)
        .from("bank_transactions")
        .update({
          pagamento_id: paymentId,
          status: "conciliado",
          data_conciliacao: new Date().toISOString(),
          observacoes: notas
            ? `Match manual: ${notas}`
            : "Vinculado manualmente",
        })
        .eq("id", transactionId);

      if (txError) throw txError;

      const { error: payError } = await (supabase as any)
        .from("pagamentos")
        .update({ bank_transaction_id: transactionId })
        .eq("id", paymentId);

      if (payError) throw payError;
    } catch (error) {
      handleError(error, "Erro ao fazer match manual");
      throw error;
    }
  },

  /**
   * Listar possíveis matches para uma transação.
   */
  async findPossibleMatches(
    transactionId: string,
    limite: number = 10
  ): Promise<PossibleMatch[]> {
    try {
      const { data: transaction, error: txError } = await (supabase as any)
        .from("bank_transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (txError) throw txError;
      if (!transaction) return [];

      const dataInicio = new Date(transaction.data_transacao);
      dataInicio.setDate(1);
      const dataFim = new Date(dataInicio);
      dataFim.setMonth(dataFim.getMonth() + 1);
      dataFim.setDate(0);

      const { data: payments, error: payError } = await (supabase as any)
        .from("pagamentos")
        .select("id, descricao, valor, data_pagamento, status_pagamento")
        .eq("clinic_id", transaction.clinic_id)
        .eq("status_pagamento", "pago")
        .gte("data_pagamento", dataInicio.toISOString().split("T")[0])
        .lte("data_pagamento", dataFim.toISOString().split("T")[0])
        .is("bank_transaction_id", null);

      if (payError) throw payError;

      const matches: PossibleMatch[] = ((payments as any[]) || [])
        .map((pag: any) => ({
          paymentId: pag.id,
          descricao: pag.descricao ?? "",
          valor: pag.valor,
          data_pagamento: pag.data_pagamento,
          confianca: this.calculateConfidence(transaction, pag),
        }))
        .filter((m) => m.confianca >= 0.4)
        .sort((a, b) => b.confianca - a.confianca)
        .slice(0, limite);

      return matches;
    } catch (error) {
      handleError(error, "Erro ao buscar possíveis matches");
      return [];
    }
  },

  /**
   * Desfazer um match (usando campo pagamento_id).
   */
  async undoMatch(transactionId: string): Promise<void> {
    try {
      const { data: tx } = await (supabase as any)
        .from("bank_transactions")
        .select("pagamento_id")
        .eq("id", transactionId)
        .single();

      const { error: txError } = await (supabase as any)
        .from("bank_transactions")
        .update({
          pagamento_id: null,
          status: null,
          data_conciliacao: null,
        })
        .eq("id", transactionId);

      if (txError) throw txError;

      if (tx?.pagamento_id) {
        await (supabase as any)
          .from("pagamentos")
          .update({ bank_transaction_id: null })
          .eq("id", tx.pagamento_id);
      }
    } catch (error) {
      handleError(error, "Erro ao desfazer match");
      throw error;
    }
  },
};
