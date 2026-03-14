export interface ScheduleSlot {
    id: string;
    professional_id: string;
    clinic_id: string;
    availability_slot_id?: string | null;
    date: string;
    start_time: string;
    end_time: string;
    duration_min: number;
    max_capacity: number;
    current_capacity: number;
    is_available: boolean;
    is_blocked: boolean;
    notes?: string | null;
    created_at: string;
    updated_at: string;
}

export interface Agendamento {
    id: string;
    paciente_id: string;
    profissional_id: string;
    clinic_id?: string;
    data_horario: string;
    duracao_minutos: number;
    tipo_atendimento: string;
    tipo_sessao: string;
    status: string;
    observacoes: string | null;
    slot_id?: string;
    valor_sessao?: number;
    checkin_paciente?: boolean;
    checkin_profissional?: boolean;
    checkin_paciente_at?: string | null;
    checkin_profissional_at?: string | null;
    pacientes?: {
        id: string;
        nome: string;
        telefone?: string;
    } | null;
    profiles?: {
        nome: string;
    } | null;
}
