import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import type { BankTransactionRow } from "./bankTransactionService";

export interface Anomaly {
  id?: string;
  bank_transaction_id: string;
  anomaly_type: "duplicate" | "orphan" | "discrepancy" | "ambiguous" | "unreconciled" | "negative";
  severity: "info" | "warning" | "error";
  description: string;
  detected_at?: string;
  resolved?: boolean;
}

export interface AnomalyDetectionResult {
  transactionId: string;
  anomalies: Anomaly[];
}

const DUPLICATE_VALUE_TOLERANCE = 0.01;
const ORPHAN_DAYS = 15;
const UNRECONCILED_DAYS = 30;
const DISCREPANCY_PERCENT = 0.1;

function daysDiff(dateStr: string): number {
  const txDate = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Detect anomalies in a list of transactions (client-side, fast).
 */
export function detectLocalAnomalies(transactions: BankTransactionRow[]): Record<string, Anomaly[]> {
  const result: Record<string, Anomaly[]> = {};

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const anomalies: Anomaly[] = [];

    // Check for duplicates (same value ±0.01 on same day)
    for (let j = 0; j < transactions.length; j++) {
      if (i === j) continue;
      const other = transactions[j];
      if (
        tx.data_transacao === other.data_transacao &&
        Math.abs(Math.abs(tx.valor) - Math.abs(other.valor)) <= DUPLICATE_VALUE_TOLERANCE &&
        tx.tipo === other.tipo
      ) {
        anomalies.push({
          bank_transaction_id: tx.id,
          anomaly_type: "duplicate",
          severity: "error",
          description: `Possível transação duplicada: mesmo valor R$${Math.abs(tx.valor).toFixed(2)} no mesmo dia`,
        });
        break;
      }
    }

    // Check unreconciled for 30+ days
    if (tx.status !== "conciliado" && tx.status !== "rejeitado") {
      const days = daysDiff(tx.data_transacao);
      if (days >= UNRECONCILED_DAYS) {
        anomalies.push({
          bank_transaction_id: tx.id,
          anomaly_type: "unreconciled",
          severity: "warning",
          description: `Transação sem conciliação há ${days} dias`,
        });
      } else if (days >= ORPHAN_DAYS && !tx.pagamento_id) {
        anomalies.push({
          bank_transaction_id: tx.id,
          anomaly_type: "orphan",
          severity: "warning",
          description: `Transação sem vínculo há ${days} dias`,
        });
      }
    }

    // Negative credit (potential refund)
    if (tx.tipo === "credito" && tx.valor < 0) {
      anomalies.push({
        bank_transaction_id: tx.id,
        anomaly_type: "negative",
        severity: "warning",
        description: "Crédito negativo detectado – possível reembolso/devolução",
      });
    }

    if (anomalies.length > 0) {
      result[tx.id] = anomalies;
    }
  }

  return result;
}

export const anomalyDetectionService = {
  /**
   * Persist detected anomalies to the database.
   */
  async saveAnomalies(
    clinicId: string,
    anomalies: Anomaly[]
  ): Promise<void> {
    if (!anomalies.length) return;
    try {
      const rows = anomalies.map((a) => ({
        clinic_id: clinicId,
        bank_transaction_id: a.bank_transaction_id,
        anomaly_type: a.anomaly_type,
        severity: a.severity,
        description: a.description,
      }));
      await (supabase as any).from("transaction_anomalies").upsert(rows, {
        onConflict: "bank_transaction_id,anomaly_type",
        ignoreDuplicates: true,
      });
    } catch (error) {
      handleError(error, "Erro ao salvar anomalias");
    }
  },

  /**
   * Load stored anomalies for a clinic.
   */
  async getAnomalies(clinicId: string): Promise<Anomaly[]> {
    try {
      const { data, error } = await (supabase as any)
        .from("transaction_anomalies")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("resolved", false)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    } catch (error) {
      handleError(error, "Erro ao buscar anomalias");
      return [];
    }
  },

  /**
   * Resolve an anomaly.
   */
  async resolveAnomaly(anomalyId: string, resolvedBy: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("transaction_anomalies")
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
        .eq("id", anomalyId);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao resolver anomalia");
      throw error;
    }
  },
};
