import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface SplitEntry {
  payment_id?: string;
  amount: number;
  description?: string;
}

export interface TransactionSplit {
  id: string;
  clinic_id: string;
  bank_transaction_id: string;
  payment_id: string | null;
  amount: number;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export const splitService = {
  /**
   * Create splits for a transaction.
   * Validates that the sum of splits equals the transaction value.
   */
  async createSplits(
    clinicId: string,
    transactionId: string,
    transactionTotal: number,
    splits: SplitEntry[],
    createdBy?: string
  ): Promise<TransactionSplit[]> {
    const total = splits.reduce((s, e) => s + e.amount, 0);
    const diff = Math.abs(Math.abs(transactionTotal) - total);
    if (diff > 0.01) {
      throw new Error(
        `A soma dos splits (R$${total.toFixed(2)}) não corresponde ao valor da transação (R$${Math.abs(transactionTotal).toFixed(2)})`
      );
    }
    if (splits.length < 2) {
      throw new Error("É necessário ao menos 2 splits");
    }

    try {
      // Remove existing splits first
      await (supabase as any)
        .from("transaction_splits")
        .delete()
        .eq("bank_transaction_id", transactionId);

      const rows = splits.map((s) => ({
        clinic_id: clinicId,
        bank_transaction_id: transactionId,
        payment_id: s.payment_id ?? null,
        amount: s.amount,
        description: s.description ?? null,
        created_by: createdBy ?? null,
      }));

      const { data, error } = await (supabase as any)
        .from("transaction_splits")
        .insert(rows)
        .select();
      if (error) throw error;

      // Mark transaction as having splits
      await (supabase as any)
        .from("bank_transactions")
        .update({ has_splits: true, split_total: total, status: "conciliado" })
        .eq("id", transactionId);

      return data ?? [];
    } catch (error) {
      handleError(error, "Erro ao criar splits");
      throw error;
    }
  },

  /**
   * Load splits for a transaction.
   */
  async getSplits(transactionId: string): Promise<TransactionSplit[]> {
    try {
      const { data, error } = await (supabase as any)
        .from("transaction_splits")
        .select("*")
        .eq("bank_transaction_id", transactionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    } catch (error) {
      handleError(error, "Erro ao buscar splits");
      return [];
    }
  },

  /**
   * Delete all splits for a transaction.
   */
  async deleteSplits(transactionId: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("transaction_splits")
        .delete()
        .eq("bank_transaction_id", transactionId);
      if (error) throw error;

      await (supabase as any)
        .from("bank_transactions")
        .update({ has_splits: false, split_total: null })
        .eq("id", transactionId);
    } catch (error) {
      handleError(error, "Erro ao excluir splits");
      throw error;
    }
  },
};
