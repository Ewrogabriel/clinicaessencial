import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";

export const clinicalService = {
    async getEvolucoes(patientId: string) {
        try {
            const { data, error } = await supabase
                .from("evolucoes")
                .select(`
          *,
          professional:profiles!evolucoes_profissional_id_fkey (nome)
        `)
                .eq("paciente_id", patientId)
                .order("data_horario", { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar evoluções.");
            return [];
        }
    },

    async getEvaluations(patientId: string) {
        try {
            const { data, error } = await supabase
                .from("evaluations")
                .select(`
          *,
          professional:profiles!evaluations_professional_id_fkey (nome)
        `)
                .eq("paciente_id", patientId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Erro ao buscar avaliações.");
            return [];
        }
    },

    async createEvolucao(evolution: any) {
        try {
            const { data, error } = await supabase
                .from("evolucoes")
                .insert(evolution)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleError(error, "Erro ao criar evolução.");
            throw error;
        }
    }
};
