import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import type { Agendamento, StatusAgendamento, TipoSessao } from "@/types/entities";
import type { ScheduleSlot } from "../types/appointment";

const SCHEDULE_SLOT_COLUMNS =
    "id, professional_id, clinic_id, availability_slot_id, date, start_time, end_time, duration_min, max_capacity, current_capacity, is_available, is_blocked, notes, created_at, updated_at";

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
                    duracao_minutos,
                    observacoes,
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

    async getScheduleSlots(options: {
        professionalId?: string;
        date: string;
        endDate?: string;
        clinicId: string | null
    }): Promise<ScheduleSlot[]> {
        try {
            let query = (supabase as any)
                .from("schedule_slots")
                .select(SCHEDULE_SLOT_COLUMNS)
                .eq("date", options.date)
                .eq("is_blocked", false);

            if (options.professionalId) {
                query = query.eq("professional_id", options.professionalId);
            }
            if (options.clinicId) {
                query = query.eq("clinic_id", options.clinicId);
            }

            const { data, error } = await query.order("start_time", { ascending: true });
            if (error) throw error;
            return (data || []) as unknown as ScheduleSlot[];
        } catch (error) {
            handleError(error, "Erro ao buscar horários disponíveis.");
            return [];
        }
    },

    async generateDaySlots(options: {
        professionalId: string;
        date: string;
        clinicId: string;
    }): Promise<void> {
        try {
            const { error } = await (supabase as any).rpc("generate_day_slots", {
                p_professional_id: options.professionalId,
                p_date: options.date,
                p_clinic_id: options.clinicId,
            });
            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao gerar horários do dia.");
            throw error;
        }
    },

    async bookAppointment(params: {
        paciente_id: string;
        profissional_id: string;
        data_horario: string;
        duracao_minutos: number;
        tipo_atendimento: string;
        tipo_sessao: TipoSessao;
        observacoes?: string;
        created_by: string;
        clinic_id: string;
        slot_id?: string;
    }) {
        try {
            // When a slot_id is provided, use the atomic book_appointment RPC which
            // locks the slot row (FOR UPDATE) and validates capacity in one transaction.
            // This is the only safe path for group sessions and concurrent bookings.
            if (params.slot_id) {
                const { data, error } = await (supabase as any).rpc("book_appointment", {
                    p_paciente_id: params.paciente_id,
                    p_profissional_id: params.profissional_id,
                    p_slot_id: params.slot_id,
                    p_data_horario: params.data_horario,
                    p_duracao_minutos: params.duracao_minutos,
                    p_tipo_atendimento: params.tipo_atendimento,
                    p_tipo_sessao: params.tipo_sessao,
                    p_observacoes: params.observacoes || null,
                    p_created_by: params.created_by,
                    p_clinic_id: params.clinic_id,
                });
                if (error) throw error;
                return { id: data } as { id: string };
            }

            // Legacy path (no slot_id): client-side double-booking guard + insert.
            // Only used for individual sessions without a pre-generated schedule slot.
            await this.checkDoubleBooking(params.profissional_id, params.data_horario);

            const { data, error } = await supabase
                .from("agendamentos")
                .insert({
                    paciente_id: params.paciente_id,
                    profissional_id: params.profissional_id,
                    data_horario: params.data_horario,
                    duracao_minutos: params.duracao_minutos,
                    tipo_atendimento: params.tipo_atendimento,
                    tipo_sessao: params.tipo_sessao,
                    observacoes: params.observacoes || null,
                    created_by: params.created_by,
                    clinic_id: params.clinic_id,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            handleError(error, "Erro ao realizar agendamento.");
            throw error;
        }
    },

    async cancelAppointment(appointmentId: string): Promise<void> {
        try {
            const { error } = await (supabase as any).rpc("cancel_appointment", {
                p_agendamento_id: appointmentId,
            });
            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao cancelar agendamento.");
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
