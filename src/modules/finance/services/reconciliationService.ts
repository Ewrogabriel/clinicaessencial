import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import { Tables } from "@/types/database.types";

export type BankTransaction = Tables<"bank_transactions">;

export interface ReconciliationFilters {
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  status?: string;
  pacienteSearch?: string;
}

export interface ReconciliationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalValue: number;
  pendingValue: number;
}

export interface BulkActionResult {
  success: number;
  failed: number;
}

export const reconciliationService = {
  /**
   * Fetch bank transactions with optional filters.
   */
  async getTransactions(
    clinicId: string | null,
    filters: ReconciliationFilters = {}
  ): Promise<BankTransaction[]> {
    try {
      let q = (supabase as any)
        .from("bank_transactions")
        .select(
          "id, data_transacao, descricao, valor, status, tipo, categoria, documento, saldo, reviewed, reviewed_at, reviewed_by, matched_paciente_id, matched_payment_id, matched_confidence, bank_account_id, clinic_id, created_at, import_batch_id"
        )
        .order("data_transacao", { ascending: false });

      if (clinicId) q = q.eq("clinic_id", clinicId);

      if (filters.dateFrom) q = q.gte("data_transacao", filters.dateFrom);
      if (filters.dateTo) q = q.lte("data_transacao", filters.dateTo);
      if (filters.status && filters.status !== "all")
        q = q.eq("status", filters.status);
      if (filters.paymentMethod && filters.paymentMethod !== "all")
        q = q.eq("tipo", filters.paymentMethod);

      const { data, error } = await q;
      if (error) throw error;

      let results: BankTransaction[] = data ?? [];

      // Patient search filter (client-side since matched_paciente_id is a FK)
      if (filters.pacienteSearch) {
        const term = filters.pacienteSearch.toLowerCase();
        results = results.filter((t) =>
          t.descricao?.toLowerCase().includes(term)
        );
      }

      return results;
    } catch (error) {
      handleError(error, "Erro ao buscar transações bancárias.");
      return [];
    }
  },

  /**
   * Approve (mark as reviewed) a single transaction.
   */
  async approveTransaction(
    id: string,
    reviewedBy: string,
    note?: string
  ): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("bank_transactions")
        .update({
          status: "aprovado",
          reviewed: true,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          ...(note ? { descricao: note } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao aprovar transação.");
      throw error;
    }
  },

  /**
   * Reject a single transaction with a reason.
   */
  async rejectTransaction(
    id: string,
    reviewedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("bank_transactions")
        .update({
          status: "rejeitado",
          reviewed: true,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          ...(reason ? { descricao: reason } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao rejeitar transação.");
      throw error;
    }
  },

  /**
   * Bulk approve multiple transactions.
   */
  async bulkApprove(
    ids: string[],
    reviewedBy: string,
    note?: string
  ): Promise<BulkActionResult> {
    let success = 0;
    let failed = 0;

    await Promise.all(
      ids.map(async (id) => {
        try {
          await reconciliationService.approveTransaction(id, reviewedBy, note);
          success++;
        } catch {
          failed++;
        }
      })
    );

    return { success, failed };
  },

  /**
   * Bulk reject multiple transactions.
   */
  async bulkReject(
    ids: string[],
    reviewedBy: string,
    reason?: string
  ): Promise<BulkActionResult> {
    let success = 0;
    let failed = 0;

    await Promise.all(
      ids.map(async (id) => {
        try {
          await reconciliationService.rejectTransaction(id, reviewedBy, reason);
          success++;
        } catch {
          failed++;
        }
      })
    );

    return { success, failed };
  },

  /**
   * Undo a recent approval/rejection (within a 5-minute window).
   */
  async undoReview(id: string): Promise<void> {
    try {
      const { data: tx, error: fetchErr } = await (supabase as any)
        .from("bank_transactions")
        .select("reviewed_at")
        .eq("id", id)
        .single();

      if (fetchErr) throw fetchErr;

      const reviewedAt = tx?.reviewed_at ? new Date(tx.reviewed_at) : null;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      if (!reviewedAt || reviewedAt < fiveMinutesAgo) {
        throw new Error(
          "Apenas revisões feitas nos últimos 5 minutos podem ser desfeitas."
        );
      }

      const { error } = await (supabase as any)
        .from("bank_transactions")
        .update({
          status: "pendente",
          reviewed: false,
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq("id", id);

      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao desfazer revisão.");
      throw error;
    }
  },

  /**
   * Get aggregated statistics for the reconciliation panel.
   */
  async getStats(clinicId: string | null): Promise<ReconciliationStats> {
    try {
      let q = (supabase as any)
        .from("bank_transactions")
        .select("id, status, valor");

      if (clinicId) q = q.eq("clinic_id", clinicId);

      const { data, error } = await q;
      if (error) throw error;

      const rows: Array<{ status: string | null; valor: number }> = data ?? [];

      const stats: ReconciliationStats = {
        total: rows.length,
        pending: rows.filter((r) => !r.status || r.status === "pendente").length,
        approved: rows.filter((r) => r.status === "aprovado").length,
        rejected: rows.filter((r) => r.status === "rejeitado").length,
        totalValue: rows.reduce((s, r) => s + Number(r.valor), 0),
        pendingValue: rows
          .filter((r) => !r.status || r.status === "pendente")
          .reduce((s, r) => s + Number(r.valor), 0),
      };

      return stats;
    } catch (error) {
      handleError(error, "Erro ao calcular estatísticas de conciliação.");
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalValue: 0,
        pendingValue: 0,
      };
    }
  },
};
