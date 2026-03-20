import { useQuery } from "@tanstack/react-query";
import { patientService } from "../services/patientService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { queryKeys } from "@/modules/shared/constants/queryKeys";

interface UsePacientesOptions {
    status?: "ativo" | "inativo";
    enabled?: boolean;
}

export function usePacientes(options: UsePacientesOptions = {}) {
    const { status = "ativo", enabled = true } = options;
    const { activeClinicId } = useClinic();

    return useQuery({
        queryKey: queryKeys.patients.list(activeClinicId, status),
        queryFn: () => patientService.getPatients(activeClinicId, status),
        enabled,
    });
}

export function usePacientesBasic(options: UsePacientesOptions = {}) {
    const { status = "ativo", enabled = true } = options;
    const { activeClinicId } = useClinic();

    return useQuery({
        queryKey: [...queryKeys.patients.list(activeClinicId, status), "basic"],
        queryFn: () => patientService.getPatientBasic(activeClinicId, status),
        enabled,
    });
}

export function usePaciente(pacienteId: string | undefined) {
    return useQuery({
        queryKey: pacienteId ? queryKeys.patients.detail(pacienteId) : queryKeys.patients.all,
        queryFn: async () => {
            if (!pacienteId) return null;
            return patientService.getPatientById(pacienteId);
        },
        enabled: !!pacienteId,
    });
}

export function usePacienteByUserId(userId: string | undefined) {
    return useQuery({
        queryKey: userId ? ["paciente-by-userid", userId] : queryKeys.patients.all,
        queryFn: async () => {
            if (!userId) return null;
            return patientService.getPatientByUserId(userId);
        },
        enabled: !!userId,
    });
}
