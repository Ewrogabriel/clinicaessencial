import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentService } from "../services/appointmentService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { queryKeys } from "@/modules/shared/constants/queryKeys";
import { toast } from "sonner";
import type { StatusAgendamento } from "@/types/entities";
import type { Agendamento } from "@/modules/appointments/types/appointment";

interface UseAgendamentosOptions {
    pacienteId?: string;
    enabled?: boolean;
}

export function useAgendamentos(options: UseAgendamentosOptions = {}) {
    const { activeClinicId } = useClinic();
    return useQuery({
        queryKey: queryKeys.appointments.list(activeClinicId, options.pacienteId),
        queryFn: async () => {
            const data = await appointmentService.getAppointments({
                activeClinicId,
                pacienteId: options.pacienteId,
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

export function useScheduleSlots(options: { professionalId?: string; date: string; clinicId: string | null }) {
    return useQuery({
        queryKey: queryKeys.appointments.slots(options.professionalId, options.date, options.clinicId),
        queryFn: () => appointmentService.getScheduleSlots(options),
        enabled: !!options.date,
        staleTime: 1000 * 60 * 2, // 2 minutos — slots change as bookings arrive
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
