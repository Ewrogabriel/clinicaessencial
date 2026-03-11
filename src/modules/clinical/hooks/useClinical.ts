import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clinicalService } from "../services/clinicalService";
import { toast } from "sonner";

export function useEvolucoes(patientId: string | undefined) {
    return useQuery({
        queryKey: ["evolucoes", patientId],
        queryFn: () => clinicalService.getEvolucoes(patientId!),
        enabled: !!patientId,
    });
}

export function useEvaluations(patientId: string | undefined) {
    return useQuery({
        queryKey: ["evaluations", patientId],
        queryFn: () => clinicalService.getEvaluations(patientId!),
        enabled: !!patientId,
    });
}

export function useCreateEvolucao() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (evolution: any) => clinicalService.createEvolucao(evolution),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["evolucoes", variables.paciente_id] });
            toast.success("Evolução registrada!");
        },
    });
}
