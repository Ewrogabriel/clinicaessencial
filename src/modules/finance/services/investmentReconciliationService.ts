/**
 * Investment Reconciliation Service
 * Links bank transactions to investments and creates new investments from transactions
 */
import { supabase } from "@/integrations/supabase/client";
import type { InvestmentMovementType } from "./investmentDetectionService";

export interface Investment {
  id: string;
  clinic_id: string | null;
  nome: string;
  tipo: string;
  instituicao: string | null;
  valor_aplicado: number;
  data_aplicacao: string;
  data_vencimento: string | null;
  taxa_contratada: number | null;
  indexador: string | null;
  percentual_indexador: number | null;
  status: string | null;
  bank_transaction_id: string | null;
  data_resgate: string | null;
  valor_resgatado: number | null;
  rendimento_total: number | null;
  historico_movimentacoes: object[] | null;
  notas: string | null;
  observacoes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateInvestmentFromTransactionDTO {
  nome: string;
  tipo: string;
  instituicao?: string;
  taxa_contratada?: number;
  indexador?: string;
  percentual_indexador?: number;
  data_vencimento?: string;
  notas?: string;
  status?: string;
}

export interface InvestmentTransaction {
  id: string;
  clinic_id: string | null;
  investimento_id: string;
  bank_transaction_id: string | null;
  tipo: InvestmentMovementType;
  valor: number;
  data_movimento: string;
  descricao: string | null;
  created_at: string | null;
}

export const investmentReconciliationService = {
  /**
   * Fetch all investments for a clinic
   */
  async getInvestments(clinicId: string): Promise<Investment[]> {
    const { data, error } = await (supabase as any)
      .from("investments")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("data_aplicacao", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single investment by ID
   */
  async getInvestment(investimentoId: string): Promise<Investment | null> {
    const { data, error } = await (supabase as any)
      .from("investments")
      .select("*")
      .eq("id", investimentoId)
      .single();
    if (error) return null;
    return data;
  },

  /**
   * Link an existing bank transaction to an investment
   */
  async linkToInvestment(
    transactionId: string,
    investimentoId: string,
    movementType: InvestmentMovementType,
    clinicId: string
  ): Promise<void> {
    // Update bank_transaction
    const { error: txError } = await (supabase as any)
      .from("bank_transactions")
      .update({
        investimento_id: investimentoId,
        is_investment: true,
        movement_type: movementType,
      })
      .eq("id", transactionId);
    if (txError) throw txError;

    // Get transaction details for investment_transactions record
    const { data: tx, error: fetchError } = await (supabase as any)
      .from("bank_transactions")
      .select("valor, data_transacao, descricao")
      .eq("id", transactionId)
      .single();
    if (fetchError) throw fetchError;

    // Create investment_transactions record
    const { error: itError } = await (supabase as any)
      .from("investment_transactions")
      .insert({
        clinic_id: clinicId,
        investimento_id: investimentoId,
        bank_transaction_id: transactionId,
        tipo: movementType,
        valor: Math.abs(tx.valor),
        data_movimento: tx.data_transacao,
        descricao: tx.descricao,
      });
    if (itError) throw itError;

    // If it's a resgate, update the investment status
    if (movementType === "resgate") {
      const { error: updateError } = await (supabase as any)
        .from("investments")
        .update({
          status: "resgatado",
          valor_resgatado: Math.abs(tx.valor),
          data_resgate: tx.data_transacao,
          rendimento_total: Math.abs(tx.valor),
        })
        .eq("id", investimentoId);
      if (updateError) throw updateError;
    }
  },

  /**
   * Unlink a bank transaction from an investment
   */
  async unlinkFromInvestment(transactionId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from("bank_transactions")
      .update({
        investimento_id: null,
        is_investment: false,
        movement_type: null,
      })
      .eq("id", transactionId);
    if (error) throw error;

    // Remove investment_transactions record
    await (supabase as any)
      .from("investment_transactions")
      .delete()
      .eq("bank_transaction_id", transactionId);
  },

  /**
   * Create a new investment from a bank transaction
   */
  async createFromTransaction(
    transactionId: string,
    clinicId: string,
    dto: CreateInvestmentFromTransactionDTO
  ): Promise<Investment> {
    // Get transaction details
    const { data: tx, error: fetchError } = await (supabase as any)
      .from("bank_transactions")
      .select("valor, data_transacao, descricao")
      .eq("id", transactionId)
      .single();
    if (fetchError) throw fetchError;

    // Create investment
    const { data: investment, error: createError } = await (supabase as any)
      .from("investments")
      .insert({
        clinic_id: clinicId,
        nome: dto.nome,
        tipo: dto.tipo,
        instituicao: dto.instituicao || null,
        valor_aplicado: Math.abs(tx.valor),
        data_aplicacao: tx.data_transacao,
        data_vencimento: dto.data_vencimento || null,
        taxa_contratada: dto.taxa_contratada || null,
        indexador: dto.indexador || "CDI",
        percentual_indexador: dto.percentual_indexador || 100,
        notas: dto.notas || null,
        status: dto.status || "ativo",
        bank_transaction_id: transactionId,
      })
      .select()
      .single();
    if (createError) throw createError;

    // Link the transaction
    const { error: linkError } = await (supabase as any)
      .from("bank_transactions")
      .update({
        investimento_id: investment.id,
        is_investment: true,
        movement_type: "aplicacao",
      })
      .eq("id", transactionId);
    if (linkError) throw linkError;

    // Create investment_transactions record
    const { error: itError } = await (supabase as any)
      .from("investment_transactions")
      .insert({
        clinic_id: clinicId,
        investimento_id: investment.id,
        bank_transaction_id: transactionId,
        tipo: "aplicacao",
        valor: Math.abs(tx.valor),
        data_movimento: tx.data_transacao,
        descricao: tx.descricao,
      });
    if (itError) throw itError;

    return investment;
  },

  /**
   * Get investment transactions history for an investment
   */
  async getInvestmentTransactions(
    investimentoId: string
  ): Promise<InvestmentTransaction[]> {
    const { data, error } = await (supabase as any)
      .from("investment_transactions")
      .select("*")
      .eq("investimento_id", investimentoId)
      .order("data_movimento", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Calculate yield for an investment
   */
  calculateYield(investment: Investment): number {
    if (!investment.valor_resgatado) return 0;
    return Number(investment.valor_resgatado) - Number(investment.valor_aplicado);
  },

  /**
   * Search investments by name or type for autocomplete
   */
  async searchInvestments(
    clinicId: string,
    query: string
  ): Promise<Investment[]> {
    const { data, error } = await (supabase as any)
      .from("investments")
      .select("*")
      .eq("clinic_id", clinicId)
      .or(`nome.ilike.%${query}%,tipo.ilike.%${query}%,instituicao.ilike.%${query}%`)
      .in("status", ["ativo"])
      .order("data_aplicacao", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },
};
