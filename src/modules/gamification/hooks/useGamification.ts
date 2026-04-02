import { useQuery } from "@tanstack/react-query";
import { gamificationService } from "../services/gamificationService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";

export function usePlayerStats(patientId?: string) {
  const { activeClinicId } = useClinic();
  const { patientId: authPatientId } = useAuth();

  const resolvedPatientId = patientId ?? authPatientId ?? undefined;

  return useQuery({
    queryKey: ["gamification-player-stats", resolvedPatientId, activeClinicId],
    queryFn: () => gamificationService.getPlayerStats(resolvedPatientId!, activeClinicId!),
    enabled: !!resolvedPatientId && !!activeClinicId,
    staleTime: 1000 * 60,
  });
}
