import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { bankAccountService } from "../services/bankAccountService";
import type { CreateBankAccountDTO } from "../types";

const STALE_TIME = 1000 * 60 * 5;

export function useBankAccounts() {
  const { activeClinicId } = useClinic();
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
    mutationFn: (dto: Omit<CreateBankAccountDTO, "clinic_id">) =>
      bankAccountService.createAccount({
        ...dto,
        clinic_id: activeClinicId ?? "",
      }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateBankAccountDTO>;
    }) => bankAccountService.updateAccount(id, data),
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
