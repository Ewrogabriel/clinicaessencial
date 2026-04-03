import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import {
  bankTransactionService,
  BankTransactionFilters,
  CreateBankTransactionDTO,
} from "../services/bankTransactionService";

const STALE_TIME = 1000 * 60 * 5; // 5 minutes

export const bankTransactionKeys = {
  all: (clinicId: string | null) =>
    ["bank-transactions", clinicId] as const,
  filtered: (clinicId: string | null, filters: BankTransactionFilters) =>
    ["bank-transactions", clinicId, filters] as const,
  detail: (id: string) =>
    ["bank-transaction", id] as const,
  summary: (clinicId: string | null, filters?: BankTransactionFilters) =>
    ["bank-transactions-summary", clinicId, filters] as const,
};

export function useBankTransactions(filters: BankTransactionFilters = {}) {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const transactionsQuery = useQuery({
    queryKey: bankTransactionKeys.filtered(activeClinicId, filters),
    queryFn: () =>
      bankTransactionService.getTransactions(activeClinicId, filters),
    staleTime: STALE_TIME,
  });

  const summaryQuery = useQuery({
    queryKey: bankTransactionKeys.summary(activeClinicId, {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      bank_account_id: filters.bank_account_id,
    }),
    queryFn: () =>
      bankTransactionService.getSummary(activeClinicId, {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        bank_account_id: filters.bank_account_id,
      }),
    staleTime: STALE_TIME,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["bank-transactions", activeClinicId],
    });
    queryClient.invalidateQueries({
      queryKey: ["bank-transactions-summary", activeClinicId],
    });
  };

  const createMutation = useMutation({
    mutationFn: (dto: Omit<CreateBankTransactionDTO, "clinic_id">) =>
      bankTransactionService.createTransaction({
        ...dto,
        clinic_id: activeClinicId ?? "",
      }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<CreateBankTransactionDTO, "clinic_id">>;
    }) => bankTransactionService.updateTransaction(id, updates),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      bankTransactionService.deleteTransaction(id),
    onSuccess: invalidate,
  });

  const reconcileMutation = useMutation({
    mutationFn: ({
      id,
      pagamentoId,
      observacoes,
    }: {
      id: string;
      pagamentoId: string;
      observacoes?: string;
    }) =>
      bankTransactionService.reconcileTransaction(id, pagamentoId, observacoes),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      bankTransactionService.rejectTransaction(id, reason),
    onSuccess: invalidate,
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) =>
      bankTransactionService.resetTransaction(id),
    onSuccess: invalidate,
  });

  return {
    transactions: transactionsQuery.data ?? [],
    isLoading: transactionsQuery.isLoading,
    isError: transactionsQuery.isError,
    summary: summaryQuery.data,
    isSummaryLoading: summaryQuery.isLoading,

    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    reconcile: reconcileMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    reset: resetMutation.mutateAsync,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReconciling: reconcileMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isResetting: resetMutation.isPending,
  };
}

export function useBankTransaction(id: string) {
  return useQuery({
    queryKey: bankTransactionKeys.detail(id),
    queryFn: () => bankTransactionService.getById(id),
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}
