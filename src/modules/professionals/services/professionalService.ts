import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import type { ProfissionalBasic } from "@/types/entities";

export const professionalService = {
    async getProfessionalsBasic() {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("user_id, nome, cor_agenda")
                .neq("cor_agenda", null);

            if (error) throw error;
            return (data || []) as ProfissionalBasic[];
        } catch (error) {
            handleError(error, "Erro ao buscar profissionais.");
            return [];
        }
    },

    async getProfessionalById(userId: string) {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", userId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleError(error, "Erro ao buscar profissional.");
            return null;
        }
    },

    async getAvailability(profissionalId: string) {
        try {
            const { data, error } = await supabase
                .from("disponibilidade_profissional")
                .select("*")
                .eq("profissional_id", profissionalId);

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar disponibilidade.");
            return [];
        }
    }
};
