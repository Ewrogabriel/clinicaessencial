import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import type { Tables } from "@/types/database.types";

export type BankAccount = Tables<"bank_accounts">;

export interface BankAccountFormData {
  apelido: string;
  banco_nome: string;
  banco_codigo: string;
  agencia?: string;
  conta?: string;
  tipo?: string;
  ativo?: boolean;
}

export const bankAccountService = {
  async getAccounts(clinicId: string | null): Promise<BankAccount[]> {
    try {
      let q = (supabase as any)
        .from("bank_accounts")
        .select("*")
        .order("banco_nome", { ascending: true });

      if (clinicId) q = q.eq("clinic_id", clinicId);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    } catch (error) {
      handleError(error, "Erro ao buscar contas bancárias.");
      return [];
    }
  },

  async getAccount(id: string): Promise<BankAccount | null> {
    try {
      const { data, error } = await (supabase as any)
        .from("bank_accounts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data ?? null;
    } catch (error) {
      handleError(error, "Erro ao buscar conta bancária.");
      return null;
    }
  },

  async createAccount(
    formData: BankAccountFormData,
    clinicId: string | null,
    userId: string
  ): Promise<BankAccount> {
    try {
      const { data, error } = await (supabase as any)
        .from("bank_accounts")
        .insert({
          apelido: formData.apelido,
          banco_nome: formData.banco_nome,
          banco_codigo: formData.banco_codigo,
          agencia: formData.agencia || null,
          conta: formData.conta || null,
          tipo: formData.tipo || "corrente",
          ativo: formData.ativo ?? true,
          clinic_id: clinicId,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, "Erro ao criar conta bancária.");
      throw error;
    }
  },

  async updateAccount(
    id: string,
    formData: Partial<BankAccountFormData>
  ): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("bank_accounts")
        .update({
          ...(formData.apelido !== undefined && { apelido: formData.apelido }),
          ...(formData.banco_nome !== undefined && { banco_nome: formData.banco_nome }),
          ...(formData.banco_codigo !== undefined && { banco_codigo: formData.banco_codigo }),
          ...(formData.agencia !== undefined && { agencia: formData.agencia || null }),
          ...(formData.conta !== undefined && { conta: formData.conta || null }),
          ...(formData.tipo !== undefined && { tipo: formData.tipo }),
          ...(formData.ativo !== undefined && { ativo: formData.ativo }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao atualizar conta bancária.");
      throw error;
    }
  },

  async deleteAccount(id: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("bank_accounts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao remover conta bancária.");
      throw error;
    }
  },
};
