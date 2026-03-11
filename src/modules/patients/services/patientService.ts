import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import type { Paciente, PacienteBasic } from "@/types/entities";

export const patientService = {
    async getPatients(activeClinicId: string | null, status: "ativo" | "inativo" = "ativo") {
        try {
            if (activeClinicId) {
                const { data: clinicPacientes, error: cpError } = await supabase
                    .from("clinic_pacientes")
                    .select("paciente_id")
                    .eq("clinic_id", activeClinicId);

                if (cpError) throw cpError;

                const ids = clinicPacientes?.map((cp) => cp.paciente_id) ?? [];
                if (!ids.length) return [];

                const { data, error } = await supabase
                    .from("pacientes")
                    .select("*")
                    .in("id", ids)
                    .eq("status", status)
                    .order("nome");

                if (error) throw error;
                return (data || []) as Paciente[];
            }

            const { data, error } = await supabase
                .from("pacientes")
                .select("*")
                .eq("status", status)
                .order("nome");

            if (error) throw error;
            return (data || []) as Paciente[];
        } catch (error) {
            handleError(error, "Erro ao buscar lista de pacientes.");
            return [];
        }
    },

    async getPatientBasic(activeClinicId: string | null, status: "ativo" | "inativo" = "ativo") {
        try {
            if (activeClinicId) {
                const { data: clinicPacientes, error: cpError } = await supabase
                    .from("clinic_pacientes")
                    .select("paciente_id")
                    .eq("clinic_id", activeClinicId);

                if (cpError) throw cpError;

                const ids = clinicPacientes?.map((cp) => cp.paciente_id) ?? [];
                if (!ids.length) return [];

                const { data, error } = await supabase
                    .from("pacientes")
                    .select("id, nome")
                    .in("id", ids)
                    .eq("status", status)
                    .order("nome");

                if (error) throw error;
                return data as PacienteBasic[];
            }

            const { data, error } = await supabase
                .from("pacientes")
                .select("id, nome")
                .eq("status", status)
                .order("nome");

            if (error) throw error;
            return data as PacienteBasic[];
        } catch (error) {
            handleError(error, "Erro ao buscar lista básica de pacientes.");
            return [];
        }
    },

    async getPatientById(id: string) {
        try {
            const { data, error } = await supabase
                .from("pacientes")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data as Paciente;
        } catch (error) {
            handleError(error, "Erro ao buscar detalhes do paciente.");
            return null;
        }
    }
};
