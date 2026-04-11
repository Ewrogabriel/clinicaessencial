/**
 * useCommissionProcessor
 *
 * Hook React que encapsula a chamada ao CommissionEngine para ser usada
 * em componentes de confirmação de sessão (Agenda, ConfirmacoesDia, etc).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { CommissionEngine, SessionOutcome } from "../commissionEngine";
import { toast } from "sonner";

export function useCommissionProcessor() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agendamentoId,
      outcome,
    }: {
      agendamentoId: string;
      outcome: SessionOutcome;
    }) => {
      if (!activeClinicId) throw new Error("Clínica não identificada");

      const result = await CommissionEngine.processSession({
        agendamentoId,
        clinicId: activeClinicId,
        outcome,
        supabaseClient: supabase,
      });

      return result;
    },
    onSuccess: (result) => {
      if (!result.skipped) {
        queryClient.invalidateQueries({ queryKey: ["commissions"] });
        queryClient.invalidateQueries({ queryKey: ["comissoes-dre"] });
      }
    },
    onError: (e: Error) => {
      // Logar mas não bloquear o fluxo principal — comissão é processo secundário
      console.warn("[CommissionProcessor] Erro ao calcular comissão:", e.message);
    },
  });
}
