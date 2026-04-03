import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import {
  matchingService,
  MatchingResult,
} from "@/modules/finance/services/matchingService";

export function useMatching() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["bank-transactions", activeClinicId],
    });
    queryClient.invalidateQueries({
      queryKey: ["bank-transactions-summary", activeClinicId],
    });
    queryClient.invalidateQueries({
      queryKey: ["reconciliation-transactions", activeClinicId],
    });
    queryClient.invalidateQueries({
      queryKey: ["reconciliation-stats", activeClinicId],
    });
  };

  // Auto-matching
  const autoMatchMutation = useMutation<MatchingResult[], Error, void>({
    mutationFn: () =>
      matchingService.autoMatchTransactions(activeClinicId ?? ""),
    onSuccess: invalidate,
  });

  // Manual matching
  const manualMatchMutation = useMutation<
    void,
    Error,
    { transactionId: string; paymentId: string; notas?: string }
  >({
    mutationFn: ({ transactionId, paymentId, notas }) =>
      matchingService.manualMatch(transactionId, paymentId, notas),
    onSuccess: invalidate,
  });

  // Desfazer match
  const undoMatchMutation = useMutation<void, Error, string>({
    mutationFn: (transactionId: string) =>
      matchingService.undoMatch(transactionId),
    onSuccess: invalidate,
  });

  return {
    autoMatch: autoMatchMutation.mutateAsync,
    manualMatch: manualMatchMutation.mutateAsync,
    undoMatch: undoMatchMutation.mutateAsync,
    isAutoMatching: autoMatchMutation.isPending,
    isManualMatching: manualMatchMutation.isPending,
    isUndoing: undoMatchMutation.isPending,
    autoMatchLoading: autoMatchMutation.isPending,
  };
}
