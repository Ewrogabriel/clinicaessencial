import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentService } from "../services/appointmentService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { toast } from "sonner";
import type { StatusAgendamento } from "@/types/entities";

interface UseAgendamentosOptions {
    pacienteId?: string;
    profissionalId?: string;
    enabled?: boolean;
}

export function useAgendamentos(options: UseAgendamentosOptions = {}) {
    const { pacienteId, profissionalId, enabled = true } = options;
    const { activeClinicId } = useClinic();

    return useQuery({
        queryKey: ["agendamentos", pacienteId, profissionalId, activeClinicId],
        queryFn: () => appointmentService.getAppointments({ pacienteId, profissionalId, activeClinicId }),
        enabled,
    });
}

export function useUpdateAgendamentoStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: StatusAgendamento }) =>
            appointmentService.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
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
            queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
            toast.success("Check-in realizado! ✅");
        },
    });
}

export function useRescheduleAgendamento() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, newDate }: { id: string; newDate: Date }) =>
            appointmentService.reschedule(id, newDate),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
            toast.success("Sessão reagendada!");
        },
    });
}
