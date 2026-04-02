import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConfirmationStats,
  getConfirmationStatus,
  sendConfirmationRequest,
  bulkSendConfirmations,
  updateConfirmation,
  ConfirmacaoStatus,
  DateRange,
} from "@/modules/appointments/services/confirmationService";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { toast } from "@/modules/shared/hooks/use-toast";

export function useConfirmationStats(dateRange: DateRange) {
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["confirmation-stats", activeClinicId, dateRange.start, dateRange.end],
    enabled: !!activeClinicId,
    queryFn: () => getConfirmationStats(activeClinicId!, dateRange),
  });
}

export function useSendConfirmation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agendamentoId, clinicId }: { agendamentoId: string; clinicId: string }) =>
      sendConfirmationRequest(agendamentoId, clinicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["confirmation-stats"] });
      queryClient.invalidateQueries({ queryKey: ["confirmacoes-7dias"] });
      toast({ title: "Confirmação enviada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar confirmação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useBulkSendConfirmations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agendamentoIds, clinicId }: { agendamentoIds: string[]; clinicId: string }) =>
      bulkSendConfirmations(agendamentoIds, clinicId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["confirmation-stats"] });
      queryClient.invalidateQueries({ queryKey: ["confirmacoes-7dias"] });
      toast({ title: `${variables.agendamentoIds.length} confirmações enviadas!` });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar confirmações em lote",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useConfirmationStatus(agendamentoId: string | undefined) {
  return useQuery({
    queryKey: ["confirmation-status", agendamentoId],
    enabled: !!agendamentoId,
    queryFn: () => getConfirmationStatus(agendamentoId!),
  });
}

export function useUpdateConfirmation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agendamentoId, status }: { agendamentoId: string; status: ConfirmacaoStatus }) =>
      updateConfirmation(agendamentoId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["confirmation-status", variables.agendamentoId] });
      queryClient.invalidateQueries({ queryKey: ["confirmation-stats"] });
      queryClient.invalidateQueries({ queryKey: ["confirmacoes-7dias"] });
      toast({ title: "Status de confirmação atualizado!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar confirmação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
