import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  reconciliationService,
  ReconciliationFilters,
  BulkActionResult,
} from "../services/reconciliationService";

const RECONCILIATION_STALE_TIME = 1000 * 60 * 5; // 5 minutes

export function useReconciliation() {
  const { activeClinicId } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReconciliationFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const transactionsQuery = useQuery({
    queryKey: ["reconciliation-transactions", activeClinicId, filters],
    queryFn: () =>
      reconciliationService.getTransactions(activeClinicId, filters),
    staleTime: RECONCILIATION_STALE_TIME,
  });

  const statsQuery = useQuery({
    queryKey: ["reconciliation-stats", activeClinicId],
    queryFn: () => reconciliationService.getStats(activeClinicId),
    staleTime: RECONCILIATION_STALE_TIME,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["reconciliation-transactions", activeClinicId],
    });
    queryClient.invalidateQueries({
      queryKey: ["reconciliation-stats", activeClinicId],
    });
  };

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      note,
    }: {
      id: string;
      note?: string;
    }) =>
      reconciliationService.approveTransaction(id, user?.id ?? "", note),
    onSuccess: () => {
      invalidate();
      setSelectedIds([]);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      id,
      reason,
    }: {
      id: string;
      reason?: string;
    }) =>
      reconciliationService.rejectTransaction(id, user?.id ?? "", reason),
    onSuccess: () => {
      invalidate();
      setSelectedIds([]);
    },
  });

  const bulkApproveMutation = useMutation<
    BulkActionResult,
    Error,
    { ids: string[]; note?: string }
  >({
    mutationFn: ({ ids, note }) =>
      reconciliationService.bulkApprove(ids, user?.id ?? "", note),
    onSuccess: () => {
      invalidate();
      setSelectedIds([]);
    },
  });

  const bulkRejectMutation = useMutation<
    BulkActionResult,
    Error,
    { ids: string[]; reason?: string }
  >({
    mutationFn: ({ ids, reason }) =>
      reconciliationService.bulkReject(ids, user?.id ?? "", reason),
    onSuccess: () => {
      invalidate();
      setSelectedIds([]);
    },
  });

  const undoMutation = useMutation({
    mutationFn: (id: string) => reconciliationService.undoReview(id),
    onSuccess: () => {
      invalidate();
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const ids = (transactionsQuery.data ?? []).map((t) => t.id);
    setSelectedIds(ids);
  };

  const selectNone = () => setSelectedIds([]);

  return {
    transactions: transactionsQuery.data ?? [],
    isLoading: transactionsQuery.isLoading,
    stats: statsQuery.data,
    filters,
    setFilters,
    selectedIds,
    toggleSelect,
    selectAll,
    selectNone,
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    bulkApprove: bulkApproveMutation.mutateAsync,
    bulkReject: bulkRejectMutation.mutateAsync,
    undo: undoMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isBulkApproving: bulkApproveMutation.isPending,
    isBulkRejecting: bulkRejectMutation.isPending,
  };
}
