import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";

export const clinicalService = {
    async getEvolucoes(patientId: string) {
        try {
            const { data, error } = await supabase
                .from("evolutions")
                .select("*")
                .eq("paciente_id", patientId)
                .order("data_evolucao", { ascending: false });

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
                .select("*")
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
                .from("evolutions")
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
