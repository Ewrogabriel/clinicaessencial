import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { gamificationService } from "../services/gamificationService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { toast } from "sonner";

export function useRewardsCatalog() {
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["gamification-rewards-catalog", activeClinicId],
    queryFn: () => gamificationService.getRewardsCatalog(activeClinicId!),
    enabled: !!activeClinicId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useRedeemReward() {
  const { patientId } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rewardId: string) => {
      if (!patientId || !activeClinicId) throw new Error("Dados insuficientes.");
      return gamificationService.redeemReward(patientId, rewardId, activeClinicId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-player-stats", patientId, activeClinicId] });
      queryClient.invalidateQueries({ queryKey: ["gamification-redemptions", patientId] });
      toast.success("Recompensa resgatada com sucesso!");
    },
    onError: (e: any) => {
      toast.error("Erro ao resgatar recompensa: " + (e.message ?? "Tente novamente."));
    },
  });
}

export function useRedemptionHistory() {
  const { patientId } = useAuth();

  return useQuery({
    queryKey: ["gamification-redemptions", patientId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("gamification_resgates") as any)
        .select("*, gamification_recompensas(titulo, icone, custo_pontos)")
        .eq("paciente_id", patientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
    staleTime: 1000 * 60,
  });
}
