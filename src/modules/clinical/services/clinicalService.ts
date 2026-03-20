import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import type { Database } from "@/integrations/supabase/types";

type EvolucaoInsert = Database["public"]["Tables"]["evolutions"]["Insert"];
type EvolucaoRow = Database["public"]["Tables"]["evolutions"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["evaluations"]["Row"];

/** Column list for evolution queries (avoids SELECT *). */
const EVOLUTION_COLUMNS =
    "id, paciente_id, profissional_id, clinic_id, descricao, conduta, data_evolucao, assinatura_url, created_at" as const;

/** Column list for evaluation queries (avoids SELECT *). */
const EVALUATION_COLUMNS =
    "id, paciente_id, profissional_id, clinic_id, queixa_principal, antecedentes_pessoais, historico_doenca, objetivos_tratamento, conduta_inicial, data_avaliacao, created_at" as const;

export const clinicalService = {
    async getEvolucoes(patientId: string): Promise<EvolucaoRow[]> {
        try {
            const { data, error } = await supabase
                .from("evolutions")
                .select(EVOLUTION_COLUMNS)
                .eq("paciente_id", patientId)
                .order("data_evolucao", { ascending: false });

            if (error) throw error;
            return (data || []) as EvolucaoRow[];
        } catch (error) {
            handleError(error, "Erro ao buscar evoluções.");
            return [];
        }
    },

    async getEvaluations(patientId: string): Promise<EvaluationRow[]> {
        try {
            const { data, error } = await supabase
                .from("evaluations")
                .select(EVALUATION_COLUMNS)
                .eq("paciente_id", patientId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return (data || []) as EvaluationRow[];
        } catch (error) {
            handleError(error, "Erro ao buscar avaliações.");
            return [];
        }
    },

    async createEvolucao(evolution: EvolucaoInsert): Promise<EvolucaoRow> {
        try {
            const { data, error } = await supabase
                .from("evolutions")
                .insert(evolution)
                .select(EVOLUTION_COLUMNS)
                .single();

            if (error) throw error;
            return data as EvolucaoRow;
        } catch (error) {
            handleError(error, "Erro ao criar evolução.");
            throw error;
        }
    },
};
