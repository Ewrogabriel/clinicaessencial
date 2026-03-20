import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import type { Profissional, ProfissionalBasic } from "@/types/entities";

/** Column list used for full professional queries (avoids SELECT *). */
const PROFESSIONAL_COLUMNS =
    "user_id, nome, email, telefone, especialidade, cor_agenda, commission_rate, commission_fixed, registro_profissional, tipo_contratacao" as const;

/** Column list for availability slot queries (avoids SELECT *). */
const AVAILABILITY_COLUMNS =
    "id, profissional_id, dia_semana, hora_inicio, hora_fim, max_pacientes" as const;

export const professionalService = {
    async getProfessionalsBasic() {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("user_id, nome, cor_agenda")
                .order("nome");

            if (error) throw error;
            return (data || []) as ProfissionalBasic[];
        } catch (error) {
            handleError(error, "Erro ao buscar profissionais.");
            return [] as ProfissionalBasic[];
        }
    },

    async getProfessionalById(userId: string): Promise<Profissional | null> {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select(PROFESSIONAL_COLUMNS)
                .eq("user_id", userId)
                .single();

            if (error) throw error;
            return data as Profissional;
        } catch (error) {
            handleError(error, "Erro ao buscar profissional.");
            return null;
        }
    },

    async getAvailability(profissionalId: string) {
        try {
            const { data, error } = await supabase
                .from("disponibilidade_profissional")
                .select(AVAILABILITY_COLUMNS)
                .eq("profissional_id", profissionalId)
                .order("dia_semana")
                .order("hora_inicio");

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar disponibilidade.");
            return [];
        }
    },
};
