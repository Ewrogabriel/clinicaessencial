import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentService } from "../services/appointmentService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { queryKeys } from "@/modules/shared/constants/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

export function useScheduleSlots(options: { professionalId?: string; date: string; clinicId: string | null }) {
    return useQuery({
        queryKey: queryKeys.appointments.slots(options.professionalId, options.date, options.clinicId),
        queryFn: async () => {
            if (!options.date || !options.professionalId) return [];

            const selectedDate = new Date(options.date + "T12:00:00");
            const dayOfWeek = selectedDate.getDay();

            // Fetch availability slots for this professional on this day of week
            let availQuery = supabase
                .from("disponibilidade_profissional")
                .select("id, hora_inicio, hora_fim, max_pacientes, dia_semana")
                .eq("profissional_id", options.professionalId)
                .eq("dia_semana", dayOfWeek)
                .eq("ativo", true)
                .order("hora_inicio");

            if (options.clinicId) {
                availQuery = availQuery.eq("clinic_id", options.clinicId);
            }

            const { data: slots, error: slotsError } = await availQuery;
            if (slotsError || !slots || slots.length === 0) return [];

            // Fetch existing appointments for this professional on this date
            const dateStart = new Date(selectedDate);
            dateStart.setHours(0, 0, 0, 0);
            const dateEnd = new Date(selectedDate);
            dateEnd.setHours(23, 59, 59, 999);

            const { data: appointments } = await supabase
                .from("agendamentos")
                .select("id, data_horario, tipo_sessao")
                .eq("profissional_id", options.professionalId)
                .gte("data_horario", dateStart.toISOString())
                .lte("data_horario", dateEnd.toISOString())
                .not("status", "in", '("cancelado","falta")');

            // Map slots with capacity info
            return slots.map((slot: any) => {
                const slotAppts = (appointments ?? []).filter((a: any) => {
                    const aTime = new Date(a.data_horario);
                    const aTimeStr = `${String(aTime.getHours()).padStart(2, "0")}:${String(aTime.getMinutes()).padStart(2, "0")}:00`;
                    return aTimeStr >= slot.hora_inicio && aTimeStr < slot.hora_fim;
                });

                const currentCount = slotAppts.length;
                const isFull = currentCount >= slot.max_pacientes;

                return {
                    id: slot.id,
                    start_time: slot.hora_inicio,
                    end_time: slot.hora_fim,
                    max_capacity: slot.max_pacientes,
                    current_capacity: currentCount,
                    is_available: !isFull,
                    status: isFull ? "full" : "available",
                };
            });
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

            let query = supabase
                .from("disponibilidade_profissional")
                .select("id, hora_inicio, hora_fim, max_pacientes")
                .eq("profissional_id", options.professionalId)
                .eq("dia_semana", options.weekday)
                .eq("ativo", true)
                .order("hora_inicio");

            if (options.clinicId) {
                query = query.eq("clinic_id", options.clinicId);
            }

            const { data: windows, error } = await query;
            if (error || !windows || windows.length === 0) return [];

            const step = options.durationMin ?? 60;
            const slots: Array<{ time: string; max_capacity: number }> = [];

            for (const win of windows) {
                const [sh, sm] = win.hora_inicio.split(":").map(Number);
                const [eh, em] = win.hora_fim.split(":").map(Number);
                let cur = sh * 60 + sm;
                const end = eh * 60 + em;
                while (cur + step <= end) {
                    const h = Math.floor(cur / 60);
                    const m = cur % 60;
                    slots.push({
                        time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                        max_capacity: win.max_pacientes,
                    });
                    cur += step;
                }
            }

            return slots;
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
