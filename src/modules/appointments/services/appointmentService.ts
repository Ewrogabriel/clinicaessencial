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
                    id, 
                    data_horario, 
                    status, 
                    tipo_atendimento,
                    valor_sessao,
                    checkin_paciente,
                    checkin_profissional,
                    paciente_id,
                    profissional_id,
                    clinic_id,
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
            return (data || []) as unknown as Agendamento[];
        } catch (error) {
            handleError(error, "Erro ao buscar agendamentos.");
            return [];
        }
    },

    async checkDoubleBooking(profissionalId: string, dataHorario: string, excludingId?: string) {
        const { data } = await supabase
            .from("agendamentos")
            .select("id")
            .eq("profissional_id", profissionalId)
            .eq("data_horario", dataHorario)
            .neq("status", "cancelado")
            .maybeSingle();

        if (data && data.id !== excludingId) {
            throw new Error("Este profissional já possui um agendamento neste horário.");
        }
        return false;
    },

    async reschedule(id: string, newDate: Date, profissionalId: string) {
        try {
            await this.checkDoubleBooking(profissionalId, newDate.toISOString(), id);

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
