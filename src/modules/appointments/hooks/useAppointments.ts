import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentService } from "../services/appointmentService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { queryKeys } from "@/modules/shared/constants/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAvailableSlots } from "@/lib/availabilityCheck";
import type { StatusAgendamento } from "@/types/entities";
import type { Agendamento } from "@/modules/appointments/types/appointment";

interface UseAgendamentosOptions {
    pacienteId?: string;
    enabled?: boolean;
    dateStart?: string;
    dateEnd?: string;
}

export function useAgendamentos(options: UseAgendamentosOptions = {}) {
    const { activeClinicId } = useClinic();
    return useQuery({
        queryKey: [
            ...queryKeys.appointments.list(activeClinicId, options.pacienteId),
            options.dateStart,
            options.dateEnd,
        ],
        queryFn: async () => {
            const data = await appointmentService.getAppointments({
                activeClinicId,
                pacienteId: options.pacienteId,
                dateStart: options.dateStart,
                dateEnd: options.dateEnd,
            });
            return data as Agendamento[];
        },
        enabled: options.enabled ?? true,
        staleTime: 1000 * 60 * 5,
    });
}

export function useUpdateAgendamentoStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: StatusAgendamento }) =>
            appointmentService.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
            toast.success("Status atualizado!");
        },
    });
}

export function useAgendamentoCheckin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, type }: { id: string; type: "paciente" | "profissional" }) =>
            appointmentService.checkin(id, type),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
            toast.success("Check-in realizado! ✅");
        },
    });
}

export function useRescheduleAgendamento() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, newDate, profissionalId }: { id: string; newDate: Date; profissionalId: string }) =>
            appointmentService.reschedule(id, newDate, profissionalId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
            toast.success("Sessão reagendada!");
        },
    });
}

export function useScheduleSlots(options: { 
    professionalId?: string; 
    date: string; 
    clinicId: string | null;
    durationMin?: number;
    tipoSessao?: 'individual' | 'grupo';
}) {
    return useQuery({
        queryKey: [...queryKeys.appointments.slots(options.professionalId, options.date, options.clinicId), options.durationMin || 60, options.tipoSessao || 'grupo'],
        queryFn: async () => {
             if (!options.date || !options.professionalId) return [];
             const selectedDate = new Date(options.date + "T12:00:00");
            const slots = await getAvailableSlots(
                options.professionalId,
                selectedDate,
                options.tipoSessao || 'grupo',
                options.durationMin || 60
            );

            return slots.map(s => ({
                id: s.slot.id,
                time: s.slot.hora_inicio,
                end_time: s.slot.hora_fim,
                max_capacity: s.slot.max_pacientes,
                current_capacity: s.currentCount,
                is_available: s.available > 0,
                status: s.available > 0 ? "available" : "full",
            }));
        },
        enabled: !!options.date && !!options.professionalId,
        staleTime: 1000 * 60 * 2,
    });
}

export function useWeekdaySlots(options: {
    professionalId?: string;
    weekday?: number; // 0=Sun … 6=Sat
    clinicId: string | null;
    durationMin?: number; // step between slots (default 60)
}) {
    return useQuery({
        queryKey: ["weekday_slots", options.professionalId, options.weekday, options.clinicId, options.durationMin ?? 60],
        queryFn: async () => {
            if (options.weekday === undefined || !options.professionalId) return [];

            // Get a reference date for this weekday (next occurrence)
            const refDate = new Date();
            const currentDay = refDate.getDay();
            let diff = options.weekday - currentDay;
            if (diff <= 0) diff += 7;
            refDate.setDate(refDate.getDate() + diff);

            const slotResults = await getAvailableSlots(
                options.professionalId,
                refDate,
                'grupo', // Enrollments are usually group-optimized for picking
                options.durationMin ?? 60
            );

            return slotResults.map(s => ({
                time: s.slot.hora_inicio,
                max_capacity: s.slot.max_pacientes,
                current_capacity: s.currentCount,
            }));
        },
        enabled: options.weekday !== undefined && !!options.professionalId,
        staleTime: 1000 * 60 * 5,
    });
}

export function useBookAppointment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: Parameters<typeof appointmentService.bookAppointment>[0]) =>
            appointmentService.bookAppointment(params),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
            if (variables.slot_id) {
                queryClient.invalidateQueries({ queryKey: ["schedule_slots"] });
            }
            toast.success("Agendamento realizado com sucesso! 📅");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Erro ao realizar agendamento");
        },
    });
}

export function useCancelAppointment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (appointmentId: string) =>
            appointmentService.cancelAppointment(appointmentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
            queryClient.invalidateQueries({ queryKey: ["schedule_slots"] });
            toast.success("Agendamento cancelado.");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Erro ao cancelar agendamento");
        },
    });
}

export function useGenerateDaySlots() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (options: Parameters<typeof appointmentService.generateDaySlots>[0]) =>
            appointmentService.generateDaySlots(options),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schedule_slots"] });
            toast.success("Horários gerados com sucesso!");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Erro ao gerar horários");
        },
    });
}
