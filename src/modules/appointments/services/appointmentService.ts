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
                    tipo_sessao,
                    valor_sessao,
                    checkin_paciente,
                    checkin_profissional,
                    paciente_id,
                    profissional_id,
                    clinic_id,
                    slot_id,
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

    async getScheduleSlots(options: {
        professionalId?: string;
        date: string;
        endDate?: string;
        clinicId: string | null
    }) {
        const { professionalId, date, endDate, clinicId } = options;
        try {
            // Tenta gerar slots se tiver professionalId (RPC opcional)
            if (professionalId) {
                // Ignora erro caso a RPC não exista
                await supabase.rpc("generate_day_slots", {
                    p_professional_id: professionalId,
                    p_date: date,
                    p_clinic_id: clinicId
                }).then(() => { }).catch(() => { });
            }

            let query = supabase
                .from("schedule_slots")
                .select("*")

            if (endDate) {
                query = query.gte("date", date).lte("date", endDate);
            } else {
                query = query.eq("date", date);
            }

            if (professionalId) {
                query = query.eq("professional_id", professionalId);
            } else if (clinicId) {
                query = query.eq("clinic_id", clinicId);
            }

            const { data, error } = await query.order("date").order("start_time");

            // PGRST205 = tabela não encontrada no schema cache (feature não migrada ainda)
            // Retorna array vazio silenciosamente para não bloquear a UI
            if (error) {
                if (error.code === "PGRST205" || error.code === "42P01") {
                    console.warn("[Agenda] schedule_slots table not found - feature not migrated yet");
                    return [];
                }
                throw error;
            }
            return data || [];
        } catch (error: any) {
            // Silencia erro de tabela inexistente
            if (error?.code === "PGRST205" || error?.code === "42P01") {
                console.warn("[Agenda] schedule_slots not available, skipping.");
                return [];
            }
            handleError(error, "Erro ao buscar slots de agendamento.");
            return [];
        }
    },

    async bookAppointment(params: {
        paciente_id: string;
        profissional_id: string;
        slot_id: string;
        data_horario: string;
        duracao_minutos: number;
        tipo_atendimento: string;
        tipo_sessao: string;
        observacoes?: string;
        created_by: string;
        clinic_id: string;
    }) {
        try {
            const { data, error } = await supabase.rpc("book_appointment", {
                p_paciente_id: params.paciente_id,
                p_profissional_id: params.profissional_id,
                p_slot_id: params.slot_id,
                p_data_horario: params.data_horario,
                p_duracao_minutos: params.duracao_minutos,
                p_tipo_atendimento: params.tipo_atendimento,
                p_tipo_sessao: params.tipo_sessao,
                p_observacoes: params.observacoes || null,
                p_created_by: params.created_by,
                p_clinic_id: params.clinic_id
            });

            if (error) throw error;
            return data;
        } catch (error) {
            handleError(error, "Erro ao realizar agendamento.");
            throw error;
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

    async updateStatus(id: string, status: StatusAgendamento) {
        try {
            const { error } = await supabase
                .from("agendamentos")
                .update({ status })
                .eq("id", id);
            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao atualizar status.");
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
