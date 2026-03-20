import { useQuery } from "@tanstack/react-query";
import { professionalService } from "../services/professionalService";

export function useProfissionaisBasic(options: { enabled?: boolean } = {}) {
    const { enabled = true } = options;
    return useQuery({
        queryKey: ["professionals-basic"],
        queryFn: () => professionalService.getProfessionalsBasic(),
        enabled,
    });
}

export function useProfissional(userId: string | undefined) {
    return useQuery({
        queryKey: ["professional", userId],
        queryFn: () => professionalService.getProfessionalById(userId!),
        enabled: !!userId,
    });
}

export function buildProfColorMap(profissionais: any[]) {
    const map: Record<string, string> = {};
    profissionais.forEach((p) => {
        if (p.user_id && p.cor_agenda) {
            map[p.user_id] = p.cor_agenda;
        }
    });
    return map;
}
