import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import type { PossibleMatch } from "@/modules/finance/services/matchingService";
import type { Anomaly } from "@/modules/finance/services/anomalyDetectionService";

export const EXPENSE_CATEGORIES = [
  "aluguel", "luz", "agua", "internet", "limpeza",
  "pessoal", "impostos", "insumos", "marketing", "outros",
];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  aluguel: "Aluguel",
  luz: "Luz",
  agua: "Água",
  internet: "Internet",
  limpeza: "Limpeza",
  pessoal: "Pessoal",
  impostos: "Impostos",
  insumos: "Insumos",
  marketing: "Marketing",
  outros: "Outros",
};

export interface ExpenseForm {
  descricao: string;
  categoria: string;
  data_vencimento: string;
  status: "pendente" | "pago";
}

export interface EditForm {
  descricao: string;
  valor: string;
  data_transacao: string;
  bank_account_id: string;
}

export interface ConciliacaoHandlers {
  handleAutoMatch: () => Promise<void>;
  handleRunAutoReconcile: () => Promise<void>;
  handleUndoReconcile: (tx: BankTransactionRow) => Promise<void>;
  handleOpenMatchDialog: (tx: BankTransactionRow) => void;
  handleManualMatch: (transactionId: string) => Promise<void>;
  handleAcceptSuggestion: (transactionId: string, paymentId: string) => Promise<void>;
  handleCreateExpense: () => Promise<void>;
  handleOpenRejectDialog: (tx: BankTransactionRow) => void;
  handleReject: () => Promise<void>;
  handleOpenEditDialog: (tx: BankTransactionRow) => void;
  handleSaveEdit: () => Promise<void>;
  handleOpenDeleteConfirm: (tx: BankTransactionRow) => void;
  handleConfirmDelete: () => Promise<void>;
  handleToggleExpand: (txId: string) => void;
  handleOpenDetailModal: (tx: BankTransactionRow) => void;
  loadSuggestions: (txId: string) => Promise<void>;
}

export interface ConciliacaoState {
  selectedTransaction: BankTransactionRow | null;
  showMatchDialog: boolean;
  setShowMatchDialog: (v: boolean) => void;
  matchNotes: string;
  setMatchNotes: (v: string) => void;
  reconcileMode: "existing" | "create_expense";
  setReconcileMode: (v: "existing" | "create_expense") => void;
  linkedPatientId: string;
  setLinkedPatientId: (v: string) => void;
  suggestions: Record<string, PossibleMatch[]>;
  suggestionsLoading: Record<string, boolean>;
  showRejectDialog: boolean;
  setShowRejectDialog: (v: boolean) => void;
  rejectMotivo: string;
  setRejectMotivo: (v: string) => void;
  showEditDialog: boolean;
  setShowEditDialog: (v: boolean) => void;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  expandedIds: Set<string>;
  expenseForm: ExpenseForm;
  setExpenseForm: React.Dispatch<React.SetStateAction<ExpenseForm>>;
  isSavingExpense: boolean;
  showImportDialog: boolean;
  setShowImportDialog: (v: boolean) => void;
  showBankAccountDialog: boolean;
  setShowBankAccountDialog: (v: boolean) => void;
  anomalies: Record<string, Anomaly[]>;
  showSplitModal: boolean;
  setShowSplitModal: (v: boolean) => void;
  showAdjustmentDialog: boolean;
  setShowAdjustmentDialog: (v: boolean) => void;
  showRefundDialog: boolean;
  setShowRefundDialog: (v: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;
  showAutoReconcileSettings: boolean;
  setShowAutoReconcileSettings: (v: boolean) => void;
  showAuditTrail: boolean;
  setShowAuditTrail: (v: boolean) => void;
  isRunningAutoReconcile: boolean;
  autoStats?: { autoReconciled: number; suggested: number; totalProcessed: number };
  showDetailModal: boolean;
  setShowDetailModal: (v: boolean) => void;
  detailModalTransaction: BankTransactionRow | null;
  setDetailModalTransaction: (v: BankTransactionRow | null) => void;
  setSelectedTransaction: (v: BankTransactionRow | null) => void;
}
