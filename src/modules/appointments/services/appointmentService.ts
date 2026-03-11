import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import type { Agendamento, StatusAgendamento } from "@/types/entities";

export const appointmentService = {
    async getAppointments(options: {
        pacienteId?: string;
        profissionalId?: string;
        activeClinicId: string | null
    }) {
        const { pacienteId, profissionalId, activeClinicId } = options;
        try {
            let query = supabase
                .from("agendamentos")
                .select(`
          *,
          pacientes (id, nome, telefone)
        `);

            if (activeClinicId) {
                query = query.eq("clinic_id", activeClinicId);
            }
            if (pacienteId) {
                query = query.eq("paciente_id", pacienteId);
            }
            if (profissionalId) {
                query = query.eq("profissional_id", profissionalId);
            }

            const { data, error } = await query.order("data_horario", { ascending: true });

            if (error) throw error;
            return (data || []) as Agendamento[];
        } catch (error) {
            handleError(error, "Erro ao buscar agendamentos.");
            return [];
        }
    },

    async updateStatus(id: string, status: StatusAgendamento) {
        try {
            const { error } = await supabase
                .from("agendamentos")
                .update({ status })
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao atualizar status do agendamento.");
            throw error;
        }
    },

    async checkin(id: string, type: "paciente" | "profissional") {
        try {
            const updateData = type === "paciente"
                ? { checkin_paciente: true, checkin_paciente_at: new Date().toISOString() }
                : { checkin_profissional: true, checkin_profissional_at: new Date().toISOString() };

            const { error } = await supabase
                .from("agendamentos")
                .update(updateData)
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao realizar check-in.");
            throw error;
        }
    },

    async reschedule(id: string, newDate: Date) {
        try {
            const { error } = await supabase
                .from("agendamentos")
                .update({ data_horario: newDate.toISOString() })
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao reagendar sessão.");
            throw error;
        }
    }
};
