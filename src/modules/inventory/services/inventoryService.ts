import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";

/** Column list for product queries (avoids SELECT *). */
const PRODUCT_COLUMNS =
    "id, nome, descricao, preco, estoque, ativo, created_at" as const;

export const inventoryService = {
    async getProducts() {
        try {
            const { data, error } = await supabase
                .from("produtos")
                .select(PRODUCT_COLUMNS)
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
                .update({ estoque: newStock })
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao atualizar estoque.");
            throw error;
        }
    }
};
