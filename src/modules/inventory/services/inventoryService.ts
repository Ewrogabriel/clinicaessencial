import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";

export const inventoryService = {
    async getProducts() {
        try {
            const { data, error } = await supabase
                .from("produtos")
                .select("*")
                .order("nome");

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar produtos.");
            return [];
        }
    },

    async updateStock(id: string, newStock: number) {
        try {
            const { error } = await supabase
                .from("produtos")
                .update({ estoque_atual: newStock } as any)
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao atualizar estoque.");
            throw error;
        }
    }
};
