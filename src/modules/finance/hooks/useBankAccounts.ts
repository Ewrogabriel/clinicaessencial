import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  bankAccountService,
  BankAccountFormData,
} from "../services/bankAccountService";

const STALE_TIME = 1000 * 60 * 10; // 10 minutes

export function useBankAccounts() {
  const { activeClinicId } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ["bank-accounts", activeClinicId],
    queryFn: () => bankAccountService.getAccounts(activeClinicId),
    staleTime: STALE_TIME,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bank-accounts", activeClinicId] });
  };

  const createMutation = useMutation({
    mutationFn: (data: BankAccountFormData) =>
      bankAccountService.createAccount(data, activeClinicId, user?.id ?? ""),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BankAccountFormData> }) =>
      bankAccountService.updateAccount(id, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bankAccountService.deleteAccount(id),
    onSuccess: invalidate,
  });

  return {
    accounts: accountsQuery.data ?? [],
    isLoading: accountsQuery.isLoading,
    createAccount: createMutation.mutateAsync,
    updateAccount: updateMutation.mutateAsync,
    deleteAccount: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
