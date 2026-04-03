import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface BankTransactionRow {
  id: string;
  clinic_id: string | null;
  bank_account_id: string | null;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string | null;
  categoria: string | null;
  documento: string | null;
  saldo: number | null;
  status: string | null;
  pagamento_id: string | null;
  observacoes: string | null;
  data_conciliacao: string | null;
  import_batch_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateBankTransactionDTO {
  clinic_id: string;
  bank_account_id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  categoria?: string;
  documento?: string;
  saldo?: number;
  status?: "pendente" | "conciliado" | "rejeitado";
  pagamento_id?: string;
  observacoes?: string;
  import_batch_id?: string;
}

export interface BankTransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  tipo?: string;
  categoria?: string;
  bank_account_id?: string;
  search?: string;
}

export interface BankTransactionSummary {
  total: number;
  pendentes: number;
  conciliados: number;
  rejeitados: number;
  totalCreditos: number;
  totalDebitos: number;
  saldoLiquido: number;
}

const TABLE = "bank_transactions";

export const bankTransactionService = {
  /**
   * List transactions for a clinic with optional filters.
   */
  async getTransactions(
    clinicId: string | null,
    filters: BankTransactionFilters = {}
  ): Promise<BankTransactionRow[]> {
    try {
      let q = (supabase as any)
        .from(TABLE)
        .select("*")
        .order("data_transacao", { ascending: false });

      if (clinicId) q = q.eq("clinic_id", clinicId);
      if (filters.dateFrom) q = q.gte("data_transacao", filters.dateFrom);
      if (filters.dateTo) q = q.lte("data_transacao", filters.dateTo);
      if (filters.status && filters.status !== "all")
        q = q.eq("status", filters.status);
      if (filters.tipo && filters.tipo !== "all")
        q = q.eq("tipo", filters.tipo);
      if (filters.categoria) q = q.eq("categoria", filters.categoria);
      if (filters.bank_account_id)
        q = q.eq("bank_account_id", filters.bank_account_id);

      const { data, error } = await q;
      if (error) throw error;

      let results: BankTransactionRow[] = data ?? [];

      if (filters.search) {
        const term = filters.search.toLowerCase();
        results = results.filter(
          (t) =>
            t.descricao?.toLowerCase().includes(term) ||
            t.documento?.toLowerCase().includes(term) ||
            t.categoria?.toLowerCase().includes(term)
        );
      }

      return results;
    } catch (error) {
      handleError(error, "Erro ao buscar transações bancárias.");
      return [];
    }
  },

  /**
   * Get a single transaction by id.
   */
  async getById(id: string): Promise<BankTransactionRow | null> {
    try {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as BankTransactionRow;
    } catch (error) {
      handleError(error, "Erro ao buscar transação bancária.");
      return null;
    }
  },

  /**
   * Create a new bank transaction.
   */
  async createTransaction(
    dto: CreateBankTransactionDTO
  ): Promise<BankTransactionRow> {
    try {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({ ...dto, status: dto.status ?? "pendente" })
        .select()
        .single();
      if (error) throw error;
      return data as BankTransactionRow;
    } catch (error) {
      handleError(error, "Erro ao criar transação bancária.");
      throw error;
    }
  },

  /**
   * Update fields on an existing transaction.
   */
  async updateTransaction(
    id: string,
    updates: Partial<Omit<CreateBankTransactionDTO, "clinic_id">>
  ): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao atualizar transação bancária.");
      throw error;
    }
  },

  /**
   * Delete a transaction.
   */
  async deleteTransaction(id: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from(TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao remover transação bancária.");
      throw error;
    }
  },

  /**
   * Mark a transaction as reconciled against a payment.
   */
  async reconcileTransaction(
    id: string,
    pagamentoId: string,
    observacoes?: string
  ): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({
          status: "conciliado",
          pagamento_id: pagamentoId,
          data_conciliacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(observacoes ? { observacoes } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao conciliar transação.");
      throw error;
    }
  },

  /**
   * Reject a transaction with an optional reason stored in observacoes.
   */
  async rejectTransaction(id: string, reason?: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({
          status: "rejeitado",
          updated_at: new Date().toISOString(),
          ...(reason ? { observacoes: reason } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao rejeitar transação.");
      throw error;
    }
  },

  /**
   * Reset a transaction back to pending.
   */
  async resetTransaction(id: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({
          status: "pendente",
          pagamento_id: null,
          data_conciliacao: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao redefinir transação.");
      throw error;
    }
  },

  /**
   * Calculate a summary of transactions for a clinic.
   */
  async getSummary(
    clinicId: string | null,
    filters: Pick<BankTransactionFilters, "dateFrom" | "dateTo" | "bank_account_id"> = {}
  ): Promise<BankTransactionSummary> {
    try {
      let q = (supabase as any)
        .from(TABLE)
        .select("id, status, tipo, valor");

      if (clinicId) q = q.eq("clinic_id", clinicId);
      if (filters.dateFrom) q = q.gte("data_transacao", filters.dateFrom);
      if (filters.dateTo) q = q.lte("data_transacao", filters.dateTo);
      if (filters.bank_account_id)
        q = q.eq("bank_account_id", filters.bank_account_id);

      const { data, error } = await q;
      if (error) throw error;

      const rows: BankTransactionRow[] = data ?? [];

      const totalCreditos = rows
        .filter((r) => r.tipo === "credito")
        .reduce((sum, r) => sum + Number(r.valor), 0);

      const totalDebitos = rows
        .filter((r) => r.tipo === "debito")
        .reduce((sum, r) => sum + Number(r.valor), 0);

      return {
        total: rows.length,
        pendentes: rows.filter(
          (r) => !r.status || r.status === "pendente"
        ).length,
        conciliados: rows.filter((r) => r.status === "conciliado").length,
        rejeitados: rows.filter((r) => r.status === "rejeitado").length,
        totalCreditos,
        totalDebitos,
        saldoLiquido: totalCreditos - totalDebitos,
      };
    } catch (error) {
      handleError(error, "Erro ao calcular resumo de transações.");
      return {
        total: 0,
        pendentes: 0,
        conciliados: 0,
        rejeitados: 0,
        totalCreditos: 0,
        totalDebitos: 0,
        saldoLiquido: 0,
      };
    }
  },
};
