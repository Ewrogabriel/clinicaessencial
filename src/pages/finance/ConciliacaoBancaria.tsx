import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Check,
  X,
  Upload,
  Zap,
  Filter,
  AlertCircle,
  Calendar,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  Lightbulb,
  Plus,
  Link,
} from "lucide-react";
import { useBankTransactions } from "@/modules/finance/hooks/useBankTransactions";
import { useMatching } from "@/modules/finance/hooks/useMatching";
import { useBankAccounts } from "@/modules/finance/hooks/useBankAccounts";
import { toast } from "@/modules/shared/hooks/use-toast";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import { Label } from "@/components/ui/label";
import { ImportStatementDialog } from "@/components/financial/ImportStatementDialog";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import { matchingService } from "@/modules/finance/services/matchingService";
import type { PossibleMatch } from "@/modules/finance/services/matchingService";
import { PatientCombobox } from "@/components/ui/patient-combobox";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";

const EXPENSE_CATEGORIES = [
  "aluguel", "luz", "agua", "internet", "limpeza",
  "pessoal", "impostos", "insumos", "marketing", "outros",
];

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
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

export default function ConciliacaoBancaria() {
  const { activeClinicId } = useClinic();
  const {
    transactions,
    summary,
    update,
    remove,
    reject,
    isReconciling,
    isRejecting,
    isUpdating,
    isDeleting,
  } = useBankTransactions();

  const { accounts } = useBankAccounts();
  const { autoMatch, manualMatch, isAutoMatching } = useMatching();

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    tipo: "todos",
    status: "todos",
    search: "",
    dataInicio: "",
    dataFim: "",
  });

  // ── Seleção / diálogos ───────────────────────────────────────────────────
  const [selectedTransaction, setSelectedTransaction] =
    useState<BankTransactionRow | null>(null);

  // Conciliar
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchNotes, setMatchNotes] = useState("");
  const [reconcileMode, setReconcileMode] = useState<"existing" | "create_expense">("existing");
  const [linkedPatientId, setLinkedPatientId] = useState("");

  // Sugestões
  const [suggestions, setSuggestions] = useState<Record<string, PossibleMatch[]>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState<Record<string, boolean>>({});
  const loadedSuggestionsRef = useRef<Set<string>>(new Set());

  // Rejeitar
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");

  // Editar
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    descricao: "",
    valor: "",
    data_transacao: "",
    bank_account_id: "",
  });

  // Excluir
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Expandir linhas
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Criar despesa
  const [expenseForm, setExpenseForm] = useState({
    descricao: "",
    categoria: "outros",
    data_vencimento: "",
    status: "pendente" as "pendente" | "pago",
  });
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Importar
  const [showImportDialog, setShowImportDialog] = useState(false);

  // ── Derivados ────────────────────────────────────────────────────────────
  const unreconciledTransactions = useMemo(
    () =>
      transactions.filter(
        (tx: BankTransactionRow) =>
          tx.status !== "conciliado" && tx.status !== "rejeitado"
      ),
    [transactions]
  );

  const filtered = useMemo(() => {
    return transactions.filter((tx: BankTransactionRow) => {
      if (filters.tipo !== "todos" && tx.tipo !== filters.tipo) return false;
      if (filters.status !== "todos") {
        if (filters.status === "pendente") {
          if (tx.status && tx.status !== "pendente") return false;
        } else {
          if (tx.status !== filters.status) return false;
        }
      }
      if (
        filters.search &&
        !tx.descricao.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      if (
        filters.dataInicio &&
        new Date(tx.data_transacao) < new Date(filters.dataInicio)
      )
        return false;
      if (
        filters.dataFim &&
        new Date(tx.data_transacao) > new Date(filters.dataFim)
      )
        return false;
      return true;
    });
  }, [transactions, filters]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAutoMatch = async () => {
    try {
      const matches = await autoMatch();
      toast({
        title: "✓ Auto-matching Concluído",
        description: `${matches.length} transações correspondidas automaticamente`,
      });
    } catch {
      toast({ title: "Erro ao fazer auto-matching", variant: "destructive" });
    }
  };

  // Conciliar
  const handleOpenMatchDialog = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setMatchNotes("");
    setReconcileMode("existing");
    setLinkedPatientId("");
    setExpenseForm({
      descricao: tx.descricao,
      categoria: "outros",
      data_vencimento: tx.data_transacao.slice(0, 10),
      status: "pago",
    });
    setShowMatchDialog(true);
    loadSuggestions(tx.id);
  };

  const handleManualMatch = async (transactionId: string) => {
    try {
      await manualMatch({
        transactionId,
        paymentId: transactionId,
        notas: matchNotes,
      });
      toast({ title: "✓ Transação vinculada com sucesso" });
      setShowMatchDialog(false);
      setMatchNotes("");
    } catch {
      toast({ title: "Erro ao vincular transação", variant: "destructive" });
    }
  };

  const handleAcceptSuggestion = async (transactionId: string, paymentId: string) => {
    try {
      await manualMatch({ transactionId, paymentId, notas: "Sugestão automática aceita" });
      toast({ title: "✓ Sugestão aceita e transação conciliada" });
      setShowMatchDialog(false);
    } catch {
      toast({ title: "Erro ao aceitar sugestão", variant: "destructive" });
    }
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
      // Mark transaction as conciliado (with expense reference in observacoes)
      await update({
        id: selectedTransaction.id,
        updates: {
          status: "conciliado",
          observacoes: `Despesa criada: ${expenseForm.descricao || selectedTransaction.descricao}${newExpense?.id ? ` (ID: ${newExpense.id})` : ""}`,
        },
      });
      toast({ title: "✓ Despesa criada e transação conciliada" });
      setShowMatchDialog(false);
    } catch {
      toast({ title: "Erro ao criar despesa", variant: "destructive" });
    } finally {
      setIsSavingExpense(false);
    }
  };

  // Rejeitar
  const handleOpenRejectDialog = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setRejectMotivo("");
    setShowRejectDialog(true);
  };

  const handleReject = async () => {
    try {
      await reject({
        id: selectedTransaction.id,
        reason: rejectMotivo || "Rejeitado manualmente",
      });
      toast({ title: "✓ Transação rejeitada" });
      setShowRejectDialog(false);
    } catch {
      toast({ title: "Erro ao rejeitar transação", variant: "destructive" });
    }
  };

  // Editar
  const handleOpenEditDialog = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setEditForm({
      descricao: tx.descricao,
      valor: String(Math.abs(tx.valor)),
      data_transacao: tx.data_transacao.slice(0, 10),
      bank_account_id: tx.bank_account_id ?? "",
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTransaction) return;
    try {
      const valorNum = parseFloat(editForm.valor);
      if (isNaN(valorNum) || valorNum <= 0) {
        toast({ title: "Valor inválido", variant: "destructive" });
        return;
      }
      await update({
        id: selectedTransaction.id,
        updates: {
          descricao: editForm.descricao,
          valor: selectedTransaction.tipo === "debito" ? -valorNum : valorNum,
          data_transacao: editForm.data_transacao,
          ...(editForm.bank_account_id ? { bank_account_id: editForm.bank_account_id } : {}),
        },
      });
      toast({ title: "✓ Transação atualizada" });
      setShowEditDialog(false);
    } catch {
      toast({ title: "Erro ao atualizar transação", variant: "destructive" });
    }
  };

  // Excluir
  const handleOpenDeleteConfirm = (tx: BankTransactionRow) => {
    setSelectedTransaction(tx);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTransaction) return;
    try {
      await remove(selectedTransaction.id);
      toast({ title: "✓ Transação excluída" });
      setShowDeleteConfirm(false);
      setSelectedTransaction(null);
    } catch {
      toast({ title: "Erro ao excluir transação", variant: "destructive" });
    }
  };

  // Expandir
  const handleToggleExpand = useCallback((txId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
        loadSuggestions(txId);
      }
      return next;
    });
  }, []);

  // Sugestões
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

  // ── Helpers visuais ───────────────────────────────────────────────────────
  const getStatusBadge = (status?: string | null) => {
    if (status === "conciliado")
      return <Badge className="bg-green-100 text-green-800 border-green-200">Conciliada</Badge>;
    if (status === "rejeitado")
      return <Badge variant="destructive">Rejeitada</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return "text-green-600 font-semibold";
    if (c >= 0.6) return "text-yellow-600 font-semibold";
    return "text-muted-foreground";
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Conciliação Bancária
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e concilie suas transações bancárias
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleAutoMatch}
            disabled={isAutoMatching || unreconciledTransactions.length === 0}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            {isAutoMatching ? "Processando..." : "Auto-matching"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="h-4 w-4" />
            Importar
          </Button>
        </div>
      </div>

      {/* Resumo KPIs */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-3xl font-bold mt-2">{summary.total}</p>
              <p className="text-xs text-muted-foreground mt-1">transações</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-transparent">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-green-700">Conciliadas</p>
              <p className="text-3xl font-bold text-green-700 mt-2">
                {summary.conciliados}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {summary.total > 0
                  ? ((summary.conciliados / summary.total) * 100).toFixed(0)
                  : 0}
                %
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-transparent">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-yellow-700">A Conciliar</p>
              <p className="text-3xl font-bold text-yellow-700 mt-2">
                {summary.pendentes}
              </p>
              <p className="text-xs text-yellow-600 mt-1">pendentes</p>
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-gradient-to-br from-green-50 to-transparent">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-green-700">Entradas</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatBRL(summary.totalCreditos)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Saídas</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {formatBRL(summary.totalDebitos)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Filtros</h3>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <Input
              placeholder="Pesquisar..."
              value={filters.search}
              onChange={(e) =>
                setFilters((p) => ({ ...p, search: e.target.value }))
              }
            />
            <Select
              value={filters.tipo}
              onValueChange={(v) => setFilters((p) => ({ ...p, tipo: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="conciliado">Conciliadas</SelectItem>
                <SelectItem value="rejeitado">Rejeitadas</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.dataInicio}
              onChange={(e) =>
                setFilters((p) => ({ ...p, dataInicio: e.target.value }))
              }
            />
            <Input
              type="date"
              value={filters.dataFim}
              onChange={(e) =>
                setFilters((p) => ({ ...p, dataFim: e.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Transações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Transações ({filtered.length})</CardTitle>
          {filtered.some((tx: BankTransactionRow) => !tx.status || tx.status === "pendente") && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
              {
                filtered.filter(
                  (tx: BankTransactionRow) => !tx.status || tx.status === "pendente"
                ).length
              }{" "}
              pendentes
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[700px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma transação encontrada
              </div>
            ) : (
              filtered.map((tx: BankTransactionRow) => {
                const isPending = !tx.status || tx.status === "pendente";
                const isExpanded = expandedIds.has(tx.id);
                const txSuggestions = suggestions[tx.id] ?? [];
                const hasSuggestions = txSuggestions.length > 0;

                return (
                  <div key={tx.id} className="border-b last:border-b-0">
                    {/* Linha principal */}
                    <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      {/* Expandir */}
                      <button
                        className="mr-2 p-1 rounded hover:bg-muted text-muted-foreground"
                        onClick={() => handleToggleExpand(tx.id)}
                        title={isExpanded ? "Recolher" : "Expandir detalhes"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {/* Descrição e Data */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{tx.descricao}</p>
                          {isPending && hasSuggestions && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              <Lightbulb className="h-3 w-3" />
                              {txSuggestions.length} {txSuggestions.length === 1 ? "sugestão" : "sugestões"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.data_transacao).toLocaleDateString("pt-BR")}
                          </p>
                          {tx.documento && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <p className="text-xs text-muted-foreground">{tx.documento}</p>
                            </>
                          )}
                          {tx.categoria && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <p className="text-xs text-muted-foreground capitalize">{tx.categoria}</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Valor e Status */}
                      <div className="flex items-center gap-4 mx-4">
                        <div className="text-right">
                          <p
                            className={`font-semibold text-sm ${
                              tx.tipo === "credito" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {tx.tipo === "credito" ? "+" : "-"}
                            {formatBRL(Math.abs(tx.valor))}
                          </p>
                          {getStatusBadge(tx.status)}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1">
                        {/* Editar */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditDialog(tx)}
                          title="Editar transação"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        {/* Excluir */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenDeleteConfirm(tx)}
                          title="Excluir transação"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>

                        {isPending && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenMatchDialog(tx)}
                              className="gap-1.5 ml-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Conciliar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenRejectDialog(tx)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                              title="Rejeitar"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Painel expandido */}
                    {isExpanded && (
                      <div className="px-12 pb-4 bg-muted/30 border-t space-y-3">
                        {/* Vincular Paciente */}
                        {isPending && (
                          <div className="pt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Vincular Paciente</span>
                            </div>
                            <PatientCombobox
                              value={linkedPatientId}
                              onValueChange={setLinkedPatientId}
                              placeholder="Buscar paciente..."
                              className="max-w-sm"
                            />
                          </div>
                        )}

                        {/* Sugestões de Matching */}
                        {isPending && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">Sugestões de Correspondência</span>
                            </div>
                            {suggestionsLoading[tx.id] ? (
                              <p className="text-xs text-muted-foreground">Buscando sugestões...</p>
                            ) : txSuggestions.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhuma sugestão encontrada para esta transação.</p>
                            ) : (
                              <div className="space-y-2">
                                {txSuggestions.map((s) => (
                                  <div
                                    key={s.paymentId}
                                    className="flex items-center justify-between bg-white border rounded p-2 text-sm"
                                  >
                                    <div className="flex-1">
                                      <p className="font-medium text-xs">{s.descricao}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-muted-foreground">
                                          {formatBRL(s.valor)}
                                        </span>
                                        {s.data_pagamento && (
                                          <span className="text-xs text-muted-foreground">
                                            • {new Date(s.data_pagamento).toLocaleDateString("pt-BR")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3">
                                      <span className={`text-xs ${confidenceColor(s.confianca)}`}>
                                        {Math.round(s.confianca * 100)}%
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => handleAcceptSuggestion(tx.id, s.paymentId)}
                                      >
                                        <Check className="h-3 w-3" />
                                        Aceitar
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Observações existentes */}
                        {tx.observacoes && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Observações: </span>
                            <span className="text-xs text-muted-foreground">{tx.observacoes}</span>
                          </div>
                        )}
                        {tx.data_conciliacao && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Conciliada em: </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(tx.data_conciliacao).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Pendentes */}
      {summary && summary.pendentes > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-amber-900">
              {summary.pendentes} transação(ões) pendente(s)
            </h4>
            <p className="text-sm text-amber-700 mt-1">
              Use o auto-matching para encontrar correspondências automáticas ou
              concilie manualmente clicando em "Conciliar".
            </p>
          </div>
        </div>
      )}

      {/* ── Dialog: Conciliar ─────────────────────────────────────────────── */}
      <Dialog open={showMatchDialog} onOpenChange={(open) => { if (!open) setShowMatchDialog(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conciliar Transação</DialogTitle>
            <DialogDescription>
              Vincule esta transação a um pagamento ou crie uma nova despesa
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              {/* Resumo da transação */}
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Transação selecionada</p>
                <p className="font-medium text-sm mt-0.5">{selectedTransaction.descricao}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-sm font-semibold ${selectedTransaction.tipo === "credito" ? "text-green-600" : "text-red-600"}`}>
                    {selectedTransaction.tipo === "credito" ? "+" : "-"}
                    {formatBRL(Math.abs(selectedTransaction.valor))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedTransaction.data_transacao).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>

              {/* Vincular Paciente */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Label>Vincular Paciente (opcional)</Label>
                </div>
                <PatientCombobox
                  value={linkedPatientId}
                  onValueChange={setLinkedPatientId}
                  placeholder="Selecionar paciente..."
                />
              </div>

              {/* Modo de conciliação */}
              <div>
                <Label className="mb-2 block">Opção de Pagamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                      reconcileMode === "existing"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                    onClick={() => setReconcileMode("existing")}
                  >
                    <Link className="h-4 w-4 mb-1" />
                    <p className="font-medium">Conciliar Pagamento</p>
                    <p className="text-xs text-muted-foreground">Vincular a pagamento registrado</p>
                  </button>
                  <button
                    className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                      reconcileMode === "create_expense"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                    onClick={() => setReconcileMode("create_expense")}
                  >
                    <Plus className="h-4 w-4 mb-1" />
                    <p className="font-medium">Criar Despesa</p>
                    <p className="text-xs text-muted-foreground">Registrar nova despesa</p>
                  </button>
                </div>
              </div>

              {/* Modo: Conciliar Pagamento Existente */}
              {reconcileMode === "existing" && (
                <div className="space-y-3">
                  {/* Sugestões */}
                  {suggestionsLoading[selectedTransaction.id] ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Buscando sugestões de pagamento...
                    </p>
                  ) : (suggestions[selectedTransaction.id] ?? []).length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3 text-blue-500" />
                        Sugestões ({(suggestions[selectedTransaction.id] ?? []).length})
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {(suggestions[selectedTransaction.id] ?? []).map((s) => (
                          <div
                            key={s.paymentId}
                            className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded p-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{s.descricao}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">{formatBRL(s.valor)}</span>
                                <span className={`text-xs ${confidenceColor(s.confianca)}`}>
                                  • {Math.round(s.confianca * 100)}% compatível
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="ml-2 h-7 text-xs gap-1 shrink-0"
                              onClick={() => handleAcceptSuggestion(selectedTransaction.id, s.paymentId)}
                            >
                              <Check className="h-3 w-3" />
                              Aceitar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      Nenhum pagamento sugerido para o período desta transação.
                    </p>
                  )}

                  <div>
                    <Label>Notas (opcional)</Label>
                    <Input
                      placeholder="Adicione observações..."
                      value={matchNotes}
                      onChange={(e) => setMatchNotes(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleManualMatch(selectedTransaction.id)}
                    disabled={isReconciling}
                  >
                    {isReconciling ? "Processando..." : "Conciliar Transação"}
                  </Button>
                </div>
              )}

              {/* Modo: Criar Despesa */}
              {reconcileMode === "create_expense" && (
                <div className="space-y-3">
                  <div>
                    <Label>Descrição da Despesa</Label>
                    <Input
                      value={expenseForm.descricao}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, descricao: e.target.value }))}
                      placeholder="Ex: Aluguel, Material..."
                      className="mt-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Categoria</Label>
                      <Select
                        value={expenseForm.categoria}
                        onValueChange={(v) => setExpenseForm((p) => ({ ...p, categoria: v }))}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {EXPENSE_CATEGORY_LABELS[c] ?? c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={expenseForm.status}
                        onValueChange={(v) => setExpenseForm((p) => ({ ...p, status: v as "pendente" | "pago" }))}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pago">Pago</SelectItem>
                          <SelectItem value="pendente">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Data de Vencimento</Label>
                    <Input
                      type="date"
                      value={expenseForm.data_vencimento}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, data_vencimento: e.target.value }))}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="bg-muted rounded p-2 text-xs text-muted-foreground">
                    Valor: <span className="font-semibold text-foreground">{formatBRL(Math.abs(selectedTransaction.valor))}</span>
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={handleCreateExpense}
                    disabled={isSavingExpense}
                  >
                    <Plus className="h-4 w-4" />
                    {isSavingExpense ? "Criando despesa..." : "Criar Despesa e Conciliar"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar Transação ──────────────────────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) setShowEditDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
            <DialogDescription>Altere os dados desta transação bancária</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input
                value={editForm.descricao}
                onChange={(e) => setEditForm((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Descrição da transação"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.valor}
                  onChange={(e) => setEditForm((p) => ({ ...p, valor: e.target.value }))}
                  placeholder="0,00"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={editForm.data_transacao}
                  onChange={(e) => setEditForm((p) => ({ ...p, data_transacao: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            {accounts.length > 0 && (
              <div>
                <Label>Conta Bancária</Label>
                <Select
                  value={editForm.bank_account_id}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, bank_account_id: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecionar conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.apelido || acc.banco_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={isUpdating}>
                {isUpdating ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Excluir ──────────────────────────────────────────── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir Transação?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não poderá ser desfeita. A transação{" "}
            <strong>{selectedTransaction?.descricao}</strong> (
            {selectedTransaction ? formatBRL(Math.abs(selectedTransaction.valor)) : ""}) será
            permanentemente removida.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: Rejeitar ─────────────────────────────────────────── */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Rejeitar Transação?</AlertDialogTitle>
          <AlertDialogDescription>
            Adicione um motivo para rejeição
          </AlertDialogDescription>
          <Input
            placeholder="Motivo da rejeição..."
            value={rejectMotivo}
            onChange={(e) => setRejectMotivo(e.target.value)}
          />
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isRejecting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRejecting ? "Rejeitando..." : "Rejeitar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Import Dialog ─────────────────────────────────────────────────── */}
      <ImportStatementDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />
    </div>
  );
}
