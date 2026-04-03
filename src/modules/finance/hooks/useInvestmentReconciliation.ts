/**
 * Hook for investment detection and reconciliation
 */
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import {
  investmentReconciliationService,
  type Investment,
  type CreateInvestmentFromTransactionDTO,
} from "@/modules/finance/services/investmentReconciliationService";
import {
  detectInvestment,
  type InvestmentDetectionResult,
  type InvestmentMovementType,
} from "@/modules/finance/services/investmentDetectionService";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import { toast } from "sonner";

// ── useInvestmentDetection ───────────────────────────────────────────────

export function useInvestmentDetection(transaction: BankTransactionRow | null) {
  const detection: InvestmentDetectionResult | null = transaction
    ? detectInvestment(transaction.descricao ?? "", transaction.valor ?? 0)
    : null;

  return { detection };
}

// ── useInvestmentReconciliation ──────────────────────────────────────────

export function useInvestmentReconciliation() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["bank-transactions-summary"] });
    queryClient.invalidateQueries({ queryKey: ["investments"] });
  }, [queryClient]);

  const linkMutation = useMutation({
    mutationFn: ({
      transactionId,
      investimentoId,
      movementType,
    }: {
      transactionId: string;
      investimentoId: string;
      movementType: InvestmentMovementType;
    }) =>
      investmentReconciliationService.linkToInvestment(
        transactionId,
        investimentoId,
        movementType,
        activeClinicId ?? ""
      ),
    onSuccess: () => {
      toast.success("Transação vinculada ao investimento!");
      invalidate();
    },
    onError: (e: any) =>
      toast.error("Erro ao vincular", { description: e.message }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (transactionId: string) =>
      investmentReconciliationService.unlinkFromInvestment(transactionId),
    onSuccess: () => {
      toast.success("Vínculo com investimento removido.");
      invalidate();
    },
    onError: (e: any) =>
      toast.error("Erro ao desvincular", { description: e.message }),
  });

  const createFromTransactionMutation = useMutation({
    mutationFn: ({
      transactionId,
      dto,
    }: {
      transactionId: string;
      dto: CreateInvestmentFromTransactionDTO;
    }) =>
      investmentReconciliationService.createFromTransaction(
        transactionId,
        activeClinicId ?? "",
        dto
      ),
    onSuccess: () => {
      toast.success("Investimento criado e vinculado!");
      invalidate();
    },
    onError: (e: any) =>
      toast.error("Erro ao criar investimento", { description: e.message }),
  });

  return {
    link: linkMutation.mutateAsync,
    unlink: unlinkMutation.mutateAsync,
    createFromTransaction: createFromTransactionMutation.mutateAsync,
    isLinking: linkMutation.isPending,
    isUnlinking: unlinkMutation.isPending,
    isCreating: createFromTransactionMutation.isPending,
  };
}

// ── useInvestmentSuggestions ─────────────────────────────────────────────

export function useInvestmentSuggestions(
  clinicId: string | null,
  query: string
) {
  return useQuery({
    queryKey: ["investment-search", clinicId, query],
    queryFn: () =>
      investmentReconciliationService.searchInvestments(clinicId ?? "", query),
    enabled: !!clinicId && query.length >= 2,
    staleTime: 30_000,
  });
}

// ── useInvestmentTransactions ────────────────────────────────────────────

export function useInvestmentTransactions(investimentoId: string | null) {
  return useQuery({
    queryKey: ["investment-transactions", investimentoId],
    queryFn: () =>
      investmentReconciliationService.getInvestmentTransactions(
        investimentoId ?? ""
      ),
    enabled: !!investimentoId,
    staleTime: 60_000,
  });
}

// ── useLinkedInvestment ──────────────────────────────────────────────────

export function useLinkedInvestment(investimentoId: string | null) {
  return useQuery<Investment | null>({
    queryKey: ["investment", investimentoId],
    queryFn: () =>
      investmentReconciliationService.getInvestment(investimentoId ?? ""),
    enabled: !!investimentoId,
    staleTime: 60_000,
  });
}

// ── useInvestmentsList ───────────────────────────────────────────────────

export function useInvestmentsList() {
  const { activeClinicId } = useClinic();
  return useQuery({
    queryKey: ["investments", activeClinicId],
    queryFn: () =>
      investmentReconciliationService.getInvestments(activeClinicId ?? ""),
    enabled: !!activeClinicId,
    staleTime: 60_000,
  });
}
