import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useBankTransactions } from "@/modules/finance/hooks/useBankTransactions";
import { useMatching } from "@/modules/finance/hooks/useMatching";
import { useBankAccounts } from "@/modules/finance/hooks/useBankAccounts";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { matchingService } from "@/modules/finance/services/matchingService";
import type { PossibleMatch } from "@/modules/finance/services/matchingService";
import { detectLocalAnomalies } from "@/modules/finance/services/anomalyDetectionService";
import type { Anomaly } from "@/modules/finance/services/anomalyDetectionService";
import { autoReconciliationService } from "@/modules/finance/services/autoReconciliationService";
import { auditService } from "@/modules/finance/services/auditService";
import { AdvancedFilters, DEFAULT_ADVANCED_FILTERS } from "@/components/financial/AdvancedFiltersPanel";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import { toast } from "sonner";

export function useConciliacaoState() {
  const { activeClinicId } = useClinic();
  const bankTx = useBankTransactions();
  const { accounts } = useBankAccounts();
  const { autoMatch, manualMatch, isAutoMatching } = useMatching();

  // Filters
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);

  // Selection / dialogs
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransactionRow | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchNotes, setMatchNotes] = useState("");
  const [reconcileMode, setReconcileMode] = useState<"existing" | "create_expense">("existing");
  const [linkedPatientId, setLinkedPatientId] = useState("");

  // Suggestions
  const [suggestions, setSuggestions] = useState<Record<string, PossibleMatch[]>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState<Record<string, boolean>>({});
  const loadedSuggestionsRef = useRef<Set<string>>(new Set());

  // Reject
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");

  // Edit
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ descricao: "", valor: "", data_transacao: "", bank_account_id: "" });

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Expand
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Create expense
  const [expenseForm, setExpenseForm] = useState({
    descricao: "", categoria: "outros", data_vencimento: "", status: "pendente" as "pendente" | "pago",
  });
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Import / Bank Account
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBankAccountDialog, setShowBankAccountDialog] = useState(false);

  // Enterprise
  const [anomalies, setAnomalies] = useState<Record<string, Anomaly[]>>({});
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAutoReconcileSettings, setShowAutoReconcileSettings] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [isRunningAutoReconcile, setIsRunningAutoReconcile] = useState(false);
  const [autoStats, setAutoStats] = useState<{ autoReconciled: number; suggested: number; totalProcessed: number } | undefined>();

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailModalTransaction, setDetailModalTransaction] = useState<BankTransactionRow | null>(null);

  const { transactions, summary, update, remove, reject, isReconciling, isRejecting, isUpdating, isDeleting } = bankTx;

  // Derived
  const unreconciledTransactions = useMemo(
    () => transactions.filter((tx: BankTransactionRow) => tx.status !== "conciliado" && tx.status !== "rejeitado"),
    [transactions]
  );

  useEffect(() => {
    if (transactions.length > 0) setAnomalies(detectLocalAnomalies(transactions));
  }, [transactions]);

  useEffect(() => {
    if (activeClinicId) autoReconciliationService.getTodayStats(activeClinicId).then(setAutoStats);
  }, [activeClinicId]);

  const filtered = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx: BankTransactionRow) => {
      if (filters.tipo !== "todos" && tx.tipo !== filters.tipo) return false;
      if (filters.status !== "todos") {
        if (filters.status === "pendente") { if (tx.status && tx.status !== "pendente") return false; }
        else { if (tx.status !== filters.status) return false; }
      }
      if (filters.search && !tx.descricao.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.dataInicio && new Date(tx.data_transacao) < new Date(filters.dataInicio)) return false;
      if (filters.dataFim && new Date(tx.data_transacao) > new Date(filters.dataFim)) return false;
      if (filters.conta !== "todos" && tx.bank_account_id !== filters.conta) return false;
      if (filters.anomalyType !== "todos") {
        const txAnomalies = anomalies[tx.id] ?? [];
        if (!txAnomalies.some((a) => a.anomaly_type === filters.anomalyType)) return false;
      }
      if (filters.daysUnreconciled !== "todos" && tx.status !== "conciliado" && tx.status !== "rejeitado") {
        const days = Math.floor((now.getTime() - new Date(tx.data_transacao).getTime()) / (1000 * 60 * 60 * 24));
        if (days < parseInt(filters.daysUnreconciled)) return false;
      }
      return true;
    });
  }, [transactions, filters, anomalies]);

  // ── Handlers ──

  const loadSuggestions = useCallback(async (txId: string) => {
    if (loadedSuggestionsRef.current.has(txId)) return;
    loadedSuggestionsRef.current.add(txId);
    setSuggestionsLoading((p) => ({ ...p, [txId]: true }));
    try {
      const result = await matchingService.findPossibleMatches(txId, 5);
      setSuggestions((p) => ({ ...p, [txId]: result }));
    } catch {
      setSuggestions((p) => ({ ...p, [txId]: [] }));
    } finally {
      setSuggestionsLoading((p) => ({ ...p, [txId]: false }));
    }
  }, []);

  const handleAutoMatch = async () => {
    try {
      const matches = await autoMatch();
      toast.success("✓ Auto-matching Concluído", { description: `${matches.length} transações correspondidas automaticamente` });
    } catch { toast.error("Erro ao fazer auto-matching"); }
  };

  const handleRunAutoReconcile = async () => {
    if (!activeClinicId) return;
    try {
      setIsRunningAutoReconcile(true);
      const result = await autoReconciliationService.runAutoReconcile(activeClinicId);
      setAutoStats((prev) => ({
        autoReconciled: (prev?.autoReconciled ?? 0) + result.reconciled,
        suggested: (prev?.suggested ?? 0) + result.suggested,
        totalProcessed: (prev?.totalProcessed ?? 0) + result.reconciled + result.suggested + result.skipped,
      }));
      toast.success("✓ Auto-reconciliação concluída", { description: `${result.reconciled} conciliadas, ${result.suggested} sugeridas` });
    } catch { toast.error("Erro na auto-reconciliação"); }
    finally { setIsRunningAutoReconcile(false); }
  };

  const handleUndoReconcile = async (tx: BankTransactionRow) => {
    try {
      await matchingService.undoMatch(tx.id);
      await auditService.log({
        clinic_id: activeClinicId ?? "", action: "undo", resource_type: "transaction", resource_id: tx.id,
        before_state: { status: tx.status, pagamento_id: tx.pagamento_id },
        after_state: { status: "pendente", pagamento_id: null }, reason: "Conciliação desfeita manualmente",
      });
      toast.success("✓ Conciliação desfeita");
    } catch { toast.error("Erro ao desfazer conciliação"); }
  };

  const handleOpenMatchDialog = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setMatchNotes("");
    setReconcileMode("existing");
    setLinkedPatientId("");
    setExpenseForm({ descricao: tx.descricao, categoria: "outros", data_vencimento: tx.data_transacao.slice(0, 10), status: "pago" });
    setShowMatchDialog(true);
    loadSuggestions(tx.id);
  };

  const handleManualMatch = async (transactionId: string) => {
    try {
      await manualMatch({ transactionId, paymentId: transactionId, notas: matchNotes });
      toast.success("✓ Transação vinculada com sucesso");
      setShowMatchDialog(false);
      setMatchNotes("");
    } catch { toast.error("Erro ao vincular transação"); }
  };

  const handleAcceptSuggestion = async (transactionId: string, paymentId: string) => {
    try {
      await manualMatch({ transactionId, paymentId, notas: "Sugestão automática aceita" });
      toast.success("✓ Sugestão aceita e transação conciliada");
      setShowMatchDialog(false);
    } catch { toast.error("Erro ao aceitar sugestão"); }
  };

  const handleCreateExpense = async () => {
    if (!activeClinicId || !selectedTransaction) return;
    try {
      setIsSavingExpense(true);
      const { data: newExpense, error } = await (supabase as any).from("expenses").insert({
        clinic_id: activeClinicId,
        descricao: expenseForm.descricao || selectedTransaction.descricao,
        valor: Math.abs(selectedTransaction.valor),
        data_vencimento: expenseForm.data_vencimento || selectedTransaction.data_transacao.slice(0, 10),
        categoria: expenseForm.categoria,
        status: expenseForm.status,
        data_pagamento: expenseForm.status === "pago" ? new Date().toISOString() : null,
      }).select("id").single();
      if (error) throw error;
      await update({
        id: selectedTransaction.id,
        updates: {
          status: "conciliado",
          observacoes: `Despesa criada: ${expenseForm.descricao || selectedTransaction.descricao}${newExpense?.id ? ` (ID: ${newExpense.id})` : ""}`,
        },
      });
      toast.success("✓ Despesa criada e transação conciliada");
      setShowMatchDialog(false);
    } catch { toast.error("Erro ao criar despesa"); }
    finally { setIsSavingExpense(false); }
  };

  const handleOpenRejectDialog = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setRejectMotivo("");
    setShowRejectDialog(true);
  };

  const handleReject = async () => {
    try {
      await reject({ id: selectedTransaction!.id, reason: rejectMotivo || "Rejeitado manualmente" });
      toast.success("✓ Transação rejeitada");
      setShowRejectDialog(false);
    } catch { toast.error("Erro ao rejeitar transação"); }
  };

  const handleOpenEditDialog = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setEditForm({ descricao: tx.descricao, valor: String(Math.abs(tx.valor)), data_transacao: tx.data_transacao.slice(0, 10), bank_account_id: tx.bank_account_id ?? "" });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTransaction) return;
    try {
      const valorNum = parseFloat(editForm.valor);
      if (isNaN(valorNum) || valorNum <= 0) { toast.error("Valor inválido"); return; }
      await update({
        id: selectedTransaction.id,
        updates: {
          descricao: editForm.descricao,
          valor: selectedTransaction.tipo === "debito" ? -valorNum : valorNum,
          data_transacao: editForm.data_transacao,
          ...(editForm.bank_account_id ? { bank_account_id: editForm.bank_account_id } : {}),
        },
      });
      toast.success("✓ Transação atualizada");
      setShowEditDialog(false);
    } catch { toast.error("Erro ao atualizar transação"); }
  };

  const handleOpenDeleteConfirm = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTransaction) return;
    try {
      await remove(selectedTransaction.id);
      toast.success("✓ Transação excluída");
      setShowDeleteConfirm(false);
      setSelectedTransaction(null);
    } catch { toast.error("Erro ao excluir transação"); }
  };

  const handleToggleExpand = useCallback((txId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) { next.delete(txId); } else { next.add(txId); loadSuggestions(txId); }
      return next;
    });
  }, [loadSuggestions]);

  const handleOpenDetailModal = useCallback((tx: BankTransactionRow) => {
    setDetailModalTransaction(tx);
    setSelectedTransaction(tx);
    setShowDetailModal(true);
    loadSuggestions(tx.id);
  }, [loadSuggestions]);

  return {
    activeClinicId, accounts, transactions, summary, filtered, unreconciledTransactions,
    isAutoMatching, isReconciling, isRejecting, isUpdating, isDeleting,
    // State
    selectedTransaction, setSelectedTransaction,
    filters, setFilters,
    showMatchDialog, setShowMatchDialog, matchNotes, setMatchNotes,
    reconcileMode, setReconcileMode, linkedPatientId, setLinkedPatientId,
    suggestions, suggestionsLoading,
    showRejectDialog, setShowRejectDialog, rejectMotivo, setRejectMotivo,
    showEditDialog, setShowEditDialog, editForm, setEditForm,
    showDeleteConfirm, setShowDeleteConfirm,
    expandedIds,
    expenseForm, setExpenseForm, isSavingExpense,
    showImportDialog, setShowImportDialog,
    showBankAccountDialog, setShowBankAccountDialog,
    anomalies,
    showSplitModal, setShowSplitModal,
    showAdjustmentDialog, setShowAdjustmentDialog,
    showRefundDialog, setShowRefundDialog,
    showExportModal, setShowExportModal,
    showAutoReconcileSettings, setShowAutoReconcileSettings,
    showAuditTrail, setShowAuditTrail,
    isRunningAutoReconcile, autoStats,
    showDetailModal, setShowDetailModal,
    detailModalTransaction, setDetailModalTransaction,
    // Handlers
    handleAutoMatch, handleRunAutoReconcile, handleUndoReconcile,
    handleOpenMatchDialog, handleManualMatch, handleAcceptSuggestion, handleCreateExpense,
    handleOpenRejectDialog, handleReject,
    handleOpenEditDialog, handleSaveEdit,
    handleOpenDeleteConfirm, handleConfirmDelete,
    handleToggleExpand, handleOpenDetailModal, loadSuggestions,
  };
}
