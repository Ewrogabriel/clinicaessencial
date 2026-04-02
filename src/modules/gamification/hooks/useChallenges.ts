import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { gamificationService } from "../services/gamificationService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { toast } from "sonner";

export function useChallenges() {
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["gamification-challenges", activeClinicId],
    queryFn: () => gamificationService.getChallenges(activeClinicId!),
    enabled: !!activeClinicId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateChallenge() {
  const { activeClinicId } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      titulo: string;
      descricao: string;
      meta: number;
      pontos_recompensa: number;
      data_inicio: string;
      data_fim: string;
      tipo?: string;
    }) => {
      const { data, error } = await (supabase.from("gamification_desafios") as any)
        .insert([{ ...payload, clinica_id: activeClinicId, criado_por: user?.id, ativo: true }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-challenges", activeClinicId] });
      toast.success("Desafio criado com sucesso!");
    },
    onError: (e: any) => {
      toast.error("Erro ao criar desafio: " + (e.message ?? "Tente novamente."));
    },
  });
}

export function useCompleteChallenge() {
  const { patientId } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { data, error } = await (supabase.from("gamification_progresso_desafios") as any)
        .upsert([{
          desafio_id: challengeId,
          paciente_id: patientId,
          clinica_id: activeClinicId,
          concluido: true,
          concluido_em: new Date().toISOString(),
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-challenges", activeClinicId] });
      queryClient.invalidateQueries({ queryKey: ["gamification-player-stats", patientId, activeClinicId] });
      toast.success("Desafio concluído!");
    },
    onError: (e: any) => {
      toast.error("Erro ao concluir desafio: " + (e.message ?? "Tente novamente."));
    },
  });
}
