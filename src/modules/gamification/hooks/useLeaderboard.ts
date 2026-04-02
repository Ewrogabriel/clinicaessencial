import { useQuery } from "@tanstack/react-query";
import { gamificationService, LeaderboardPeriod } from "../services/gamificationService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

export function useLeaderboard(period: LeaderboardPeriod) {
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["gamification-leaderboard", activeClinicId, period],
    queryFn: () => gamificationService.getLeaderboard(activeClinicId!, period),
    enabled: !!activeClinicId,
    staleTime: 1000 * 60 * 5,
  });
}
