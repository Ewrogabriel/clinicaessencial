import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import type { BankAccount, CreateBankAccountDTO } from "../types";

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
      return (data ?? []) as BankAccount[];
    } catch (error) {
      handleError(error, "Erro ao buscar contas bancárias.");
      return [];
    }
  },

  async createAccount(dto: CreateBankAccountDTO): Promise<BankAccount> {
    try {
      const { data, error } = await (supabase as any)
        .from("bank_accounts")
        .insert({ ...dto, ativo: dto.ativo ?? true })
        .select()
        .single();
      if (error) throw error;
      return data as BankAccount;
    } catch (error) {
      handleError(error, "Erro ao criar conta bancária.");
      throw error;
    }
  },

  async updateAccount(
    id: string,
    updates: Partial<CreateBankAccountDTO>
  ): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("bank_accounts")
        .update({ ...updates, updated_at: new Date().toISOString() })
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
