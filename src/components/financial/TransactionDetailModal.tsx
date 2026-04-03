import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ClipboardList,
  Link2,
  Lightbulb,
  AlertTriangle,
  DollarSign,
  History,
  Network,
  Zap,
  MessageSquare,
  Check,
  X,
  Pencil,
  Scissors,
  RotateCcw,
  Copy,
  ChevronLeft,
  ChevronRight,
  Archive,
  Star,
  AlertCircle,
  XCircle,
  Info,
  CheckCircle2,
  Loader2,
  User,
  Keyboard,
  TrendingUp,
} from "lucide-react";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import { AuditTrail } from "@/components/financial/AuditTrail";
import { AnomalyBadge } from "@/components/financial/AnomalyBadge";
import { InvestmentLinkSection } from "@/components/financial/InvestmentLinkSection";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import type { PossibleMatch } from "@/modules/finance/services/matchingService";
import type { Anomaly } from "@/modules/finance/services/anomalyDetectionService";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

interface TransactionDetailModalProps {
  transaction: BankTransactionRow | null;
  transactions: BankTransactionRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions?: PossibleMatch[];
  suggestionsLoading?: boolean;
  anomalies?: Anomaly[];
  clinicId?: string;
  onEdit?: (tx: BankTransactionRow) => void;
  onReconcile?: (tx: BankTransactionRow) => void;
  onReject?: (tx: BankTransactionRow) => void;
  onSplit?: (tx: BankTransactionRow) => void;
  onRefund?: (tx: BankTransactionRow) => void;
  onAdjust?: (tx: BankTransactionRow) => void;
  onUndo?: (tx: BankTransactionRow) => void;
  onDelete?: (tx: BankTransactionRow) => void;
  onAcceptSuggestion?: (transactionId: string, paymentId: string) => void;
  onNavigate?: (tx: BankTransactionRow) => void;
  onSaveNote?: (transactionId: string, note: string) => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getStatusConfig(status?: string | null) {
  switch (status) {
    case "conciliado":
      return {
        label: "Conciliada",
        icon: <CheckCircle2 className="h-4 w-4" />,
        className: "bg-green-100 text-green-800 border-green-200",
        dot: "bg-green-500",
      };
    case "rejeitado":
      return {
        label: "Rejeitada",
        icon: <XCircle className="h-4 w-4" />,
        className: "bg-red-100 text-red-800 border-red-200",
        dot: "bg-red-500",
      };
    default:
      return {
        label: "Pendente",
        icon: <AlertCircle className="h-4 w-4" />,
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        dot: "bg-yellow-500",
      };
  }
}

function formatDate(dateStr: string | null | undefined, withTime = false) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (withTime) {
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function confidenceStars(confidence: number) {
  const stars = Math.round(confidence * 5);
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={`h-3 w-3 ${i < stars ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
    />
  ));
}

function confidenceColor(c: number) {
  if (c >= 0.8) return "text-green-600 font-semibold";
  if (c >= 0.6) return "text-yellow-600 font-semibold";
  return "text-muted-foreground";
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5 text-sm border-b last:border-b-0 border-border/50">
      <span className="text-muted-foreground shrink-0 mr-4 min-w-[120px]">{label}</span>
      <span className="font-medium text-right break-all">{value ?? "—"}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function TransactionDetailModal({
  transaction,
  transactions,
  open,
  onOpenChange,
  suggestions = [],
  suggestionsLoading = false,
  anomalies = [],
  clinicId,
  onEdit,
  onReconcile,
  onReject,
  onSplit,
  onRefund,
  onAdjust,
  onUndo,
  onDelete,
  onAcceptSuggestion,
  onNavigate,
  onSaveNote,
}: TransactionDetailModalProps) {
  const [note, setNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const currentIndex = transaction
    ? transactions.findIndex((t) => t.id === transaction.id)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < transactions.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev && onNavigate) {
      onNavigate(transactions[currentIndex - 1]);
    }
  }, [hasPrev, onNavigate, transactions, currentIndex]);

  const goToNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(transactions[currentIndex + 1]);
    }
  }, [hasNext, onNavigate, transactions, currentIndex]);

  const handleCopyId = useCallback(() => {
    if (!transaction) return;
    navigator.clipboard.writeText(transaction.id).then(() => {
      toast.success("✓ ID copiado para área de transferência");
    });
  }, [transaction]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in textarea/input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
        goToPrev();
      } else if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
        goToNext();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        // Only copy ID when no text is selected
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          e.preventDefault();
          handleCopyId();
        }
      } else if (e.key === "?" || e.key === "h") {
        setShowShortcuts((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goToPrev, goToNext, onOpenChange, handleCopyId]);

  if (!transaction) return null;

  const statusCfg = getStatusConfig(transaction.status);
  const isConciliated = transaction.status === "conciliado";
  const isRejected = transaction.status === "rejeitado";
  const isCredit = transaction.tipo === "credito";
  const valor = Math.abs(transaction.valor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[900px] w-[95vw] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden"
        aria-label="Detalhes da Transação"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <DialogTitle className="text-lg font-bold leading-tight">
                  Detalhes da Transação
                </DialogTitle>
                <Badge className={statusCfg.className}>
                  <span className="flex items-center gap-1">
                    {statusCfg.icon}
                    {statusCfg.label}
                  </span>
                </Badge>
                {anomalies.length > 0 && (
                  <AnomalyBadge anomalies={anomalies} />
                )}
                {transaction.is_investment && (
                  <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    Investimento
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {transaction.descricao}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setShowShortcuts((v) => !v)}
                      aria-label="Atalhos de teclado"
                    >
                      <Keyboard className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Atalhos de teclado (?)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Keyboard shortcuts panel */}
          {showShortcuts && (
            <div className="mt-3 p-3 bg-muted rounded-lg text-xs text-muted-foreground grid grid-cols-2 gap-1.5">
              <span><kbd className="px-1 py-0.5 bg-background border rounded text-xs">ESC</kbd> Fechar modal</span>
              <span><kbd className="px-1 py-0.5 bg-background border rounded text-xs">←</kbd> Transação anterior</span>
              <span><kbd className="px-1 py-0.5 bg-background border rounded text-xs">→</kbd> Próxima transação</span>
              <span><kbd className="px-1 py-0.5 bg-background border rounded text-xs">Ctrl+C</kbd> Copiar ID</span>
              <span><kbd className="px-1 py-0.5 bg-background border rounded text-xs">?</kbd> Ver atalhos</span>
            </div>
          )}
        </DialogHeader>

        {/* ── Scrollable content ───────────────────────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          <div
            className="px-6 py-4 space-y-5 animate-in fade-in-0 duration-200"
          >
            {/* ── Layout: 2 columns on lg+ ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* ── SEÇÃO 1: Informações da Transação ────────────────────── */}
              <div className="rounded-lg border bg-card p-4">
                <SectionHeader
                  icon={<ClipboardList className="h-4 w-4" />}
                  title="Informações da Transação"
                />
                <div className="space-y-0">
                  <InfoRow label="ID" value={
                    <span className="font-mono text-xs truncate max-w-[180px] block" title={transaction.id}>
                      {transaction.id.slice(0, 8)}...{transaction.id.slice(-6)}
                    </span>
                  } />
                  <InfoRow label="Data" value={formatDate(transaction.data_transacao, true)} />
                  <InfoRow label="Tipo" value={
                    <Badge variant="outline" className={isCredit ? "text-green-700 border-green-300" : "text-red-700 border-red-300"}>
                      {isCredit ? "Crédito" : "Débito"}
                    </Badge>
                  } />
                  <InfoRow label="Valor" value={
                    <span className={`font-bold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                      {isCredit ? "+" : "-"}{formatBRL(valor)}
                    </span>
                  } />
                  <InfoRow label="Status" value={
                    <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                  } />
                  <InfoRow label="Descrição" value={transaction.descricao} />
                  {transaction.documento && (
                    <InfoRow label="Documento" value={transaction.documento} />
                  )}
                  {transaction.categoria && (
                    <InfoRow label="Categoria" value={
                      <span className="capitalize">{transaction.categoria}</span>
                    } />
                  )}
                  {transaction.observacoes && (
                    <InfoRow label="Observações" value={transaction.observacoes} />
                  )}
                  {transaction.saldo != null && (
                    <InfoRow label="Saldo Pós-Tx" value={formatBRL(transaction.saldo)} />
                  )}
                </div>
              </div>

              {/* ── SEÇÃO 2: Status de Reconciliação ─────────────────────── */}
              <div className="rounded-lg border bg-card p-4">
                <SectionHeader
                  icon={<Link2 className="h-4 w-4" />}
                  title="Status de Reconciliação"
                />
                <div className="space-y-0">
                  <InfoRow label="Status Atual" value={
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${statusCfg.dot}`} />
                      <span>{statusCfg.label}</span>
                    </div>
                  } />
                  {transaction.data_conciliacao && (
                    <InfoRow
                      label="Data de Conciliação"
                      value={formatDate(transaction.data_conciliacao)}
                    />
                  )}
                  {transaction.pagamento_id && (
                    <InfoRow
                      label="Conciliada com"
                      value={
                        <span className="font-mono text-xs">
                          {transaction.pagamento_id.slice(0, 12)}...
                        </span>
                      }
                    />
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                  {onReconcile && (
                    <Button
                      size="sm"
                      variant={isConciliated ? "outline" : "default"}
                      className={`gap-1 text-xs h-8 ${isConciliated ? "border-green-200 text-green-700 hover:bg-green-50" : ""}`}
                      onClick={() => { onReconcile(transaction); onOpenChange(false); }}
                    >
                      <Link2 className="h-3 w-3" />
                      {isConciliated ? "Re-conciliar" : isRejected ? "Aceitar" : "Conciliar"}
                    </Button>
                  )}
                  {isConciliated && onUndo && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8 border-gray-200 text-gray-600 hover:bg-gray-50"
                      onClick={() => { onUndo(transaction); onOpenChange(false); }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Desfazer
                    </Button>
                  )}
                  {!isRejected && onReject && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8 border-orange-200 text-orange-600 hover:bg-orange-50"
                      onClick={() => { onReject(transaction); onOpenChange(false); }}
                    >
                      <X className="h-3 w-3" />
                      Rejeitar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* ── SEÇÃO 2.5: Integração com Investimentos ───────────────────── */}
            {clinicId && (
              <div className="rounded-lg border bg-card p-4">
                <InvestmentLinkSection
                  transaction={transaction}
                  clinicId={clinicId}
                />
              </div>
            )}

            {/* ── SEÇÃO 3: Sugestões Inteligentes ───────────────────────────── */}
            <div className="rounded-lg border bg-card p-4">
              <SectionHeader
                icon={<Lightbulb className="h-4 w-4 text-blue-500" />}
                title="Sugestões de Matching"
              />
              {suggestionsLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando sugestões...
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhuma sugestão encontrada para esta transação.
                </p>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((s, idx) => {
                    const pct = Math.round(s.confianca * 100);
                    return (
                      <div
                        key={s.paymentId}
                        className={`rounded-lg border p-3 transition-colors ${
                          s.confianca >= 0.8
                            ? "border-green-200 bg-green-50"
                            : s.confianca >= 0.6
                            ? "border-yellow-200 bg-yellow-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-muted-foreground">
                                #{idx + 1}
                              </span>
                              <div className="flex items-center gap-0.5">
                                {confidenceStars(s.confianca)}
                              </div>
                              <span className={`text-xs font-bold ${confidenceColor(s.confianca)}`}>
                                {pct}% compatível
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate">{s.descricao}</p>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                              <span>Valor: <strong>{formatBRL(s.valor)}</strong></span>
                              {s.data_pagamento && (
                                <span>
                                  Data:{" "}
                                  <strong>
                                    {new Date(s.data_pagamento).toLocaleDateString("pt-BR")}
                                  </strong>
                                </span>
                              )}
                              {Math.abs(s.valor - valor) > 0.01 && (
                                <span className="text-red-600">
                                  Diff:{" "}
                                  <strong>
                                    {s.valor > valor ? "+" : ""}
                                    {formatBRL(s.valor - valor)}
                                  </strong>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onAcceptSuggestion && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs gap-1 px-2"
                                onClick={() => {
                                  onAcceptSuggestion(transaction.id, s.paymentId);
                                  onOpenChange(false);
                                }}
                              >
                                <Check className="h-3 w-3" />
                                Aceitar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SEÇÃO 4 + 5: Anomalias & Detalhes Financeiros ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* SEÇÃO 4: Anomalias Detectadas */}
              <div className="rounded-lg border bg-card p-4">
                <SectionHeader
                  icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                  title="Anomalias Detectadas"
                />
                {anomalies.length === 0 ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Nenhuma anomalia detectada
                  </div>
                ) : (
                  <div className="space-y-2">
                    {anomalies.map((a, idx) => {
                      const icon =
                        a.severity === "error" ? (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        ) : a.severity === "warning" ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        );
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 p-2 rounded text-xs ${
                            a.severity === "error"
                              ? "bg-red-50 border border-red-200"
                              : a.severity === "warning"
                              ? "bg-yellow-50 border border-yellow-200"
                              : "bg-blue-50 border border-blue-200"
                          }`}
                        >
                          {icon}
                          <span>{a.description}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SEÇÃO 5: Detalhes Financeiros */}
              <div className="rounded-lg border bg-card p-4">
                <SectionHeader
                  icon={<DollarSign className="h-4 w-4" />}
                  title="Detalhes Financeiros"
                />
                <div className="space-y-0">
                  <InfoRow label="Valor" value={
                    <span className={`font-bold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                      {isCredit ? "+" : "-"}{formatBRL(valor)}
                    </span>
                  } />
                  <InfoRow label="Tipo" value={isCredit ? "Crédito" : "Débito"} />
                  <InfoRow label="Moeda" value="BRL" />
                  {transaction.saldo != null && (
                    <InfoRow label="Saldo Pós-Tx" value={formatBRL(transaction.saldo)} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  * Taxas de gateway e banco serão exibidas quando configuradas na conta bancária.
                </p>
              </div>
            </div>

            {/* ── SEÇÃO 6: Histórico de Auditoria ───────────────────────────── */}
            {clinicId && (
              <div className="rounded-lg border bg-card p-4">
                <SectionHeader
                  icon={<History className="h-4 w-4" />}
                  title="Histórico de Alterações"
                />
                <AuditTrail
                  clinicId={clinicId}
                  resourceId={transaction.id}
                  limit={10}
                />
              </div>
            )}

            {/* ── SEÇÃO 7: Relacionamentos ───────────────────────────────────── */}
            <div className="rounded-lg border bg-card p-4">
              <SectionHeader
                icon={<Network className="h-4 w-4" />}
                title="Relacionamentos"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    {transaction.pagamento_id ? (
                      <div>
                        <p className="font-medium">Pagamento vinculado</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          ID: {transaction.pagamento_id}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">
                        Sem vínculo com paciente / pagamento
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  {transaction.bank_account_id && (
                    <div className="p-2 bg-muted/30 rounded text-center">
                      <p className="font-medium text-foreground truncate">Conta</p>
                      <p className="font-mono text-xs truncate" title={transaction.bank_account_id}>
                        {transaction.bank_account_id.slice(0, 8)}...
                      </p>
                    </div>
                  )}
                  {transaction.import_batch_id && (
                    <div className="p-2 bg-muted/30 rounded text-center">
                      <p className="font-medium text-foreground">Lote Importação</p>
                      <p className="font-mono text-xs truncate" title={transaction.import_batch_id}>
                        {transaction.import_batch_id.slice(0, 8)}...
                      </p>
                    </div>
                  )}
                  {transaction.created_at && (
                    <div className="p-2 bg-muted/30 rounded text-center">
                      <p className="font-medium text-foreground">Criada em</p>
                      <p>{new Date(transaction.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── SEÇÃO 8: Ações Rápidas ─────────────────────────────────────── */}
            <div className="rounded-lg border bg-card p-4">
              <SectionHeader
                icon={<Zap className="h-4 w-4 text-yellow-500" />}
                title="Ações Rápidas"
              />
              <div className="flex flex-wrap gap-2">
                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => { onEdit(transaction); onOpenChange(false); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
                {onReconcile && (
                  <Button
                    size="sm"
                    variant={isConciliated ? "outline" : "default"}
                    className={`gap-1.5 h-8 text-xs ${
                      isConciliated
                        ? "border-green-200 text-green-700 hover:bg-green-50"
                        : ""
                    }`}
                    onClick={() => { onReconcile(transaction); onOpenChange(false); }}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {isConciliated ? "Re-conciliar" : "Conciliar"}
                  </Button>
                )}
                {!isRejected && onReject && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
                    onClick={() => { onReject(transaction); onOpenChange(false); }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Rejeitar
                  </Button>
                )}
                {onSplit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                    onClick={() => { onSplit(transaction); onOpenChange(false); }}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Split
                  </Button>
                )}
                {isCredit && onRefund && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
                    onClick={() => { onRefund(transaction); onOpenChange(false); }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reembolso
                  </Button>
                )}
                {onAdjust && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => { onAdjust(transaction); onOpenChange(false); }}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Ajuste
                  </Button>
                )}
                {isConciliated && onUndo && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs border-gray-200 text-gray-600 hover:bg-gray-50"
                    onClick={() => { onUndo(transaction); onOpenChange(false); }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Desfazer
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs"
                  onClick={handleCopyId}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar ID
                </Button>
                {onDelete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => { onDelete(transaction); onOpenChange(false); }}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )}
              </div>
            </div>

            {/* ── SEÇÃO 9: Notas e Comentários ───────────────────────────────── */}
            <div className="rounded-lg border bg-card p-4">
              <SectionHeader
                icon={<MessageSquare className="h-4 w-4" />}
                title="Notas Internas"
              />
              <div className="space-y-3">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Adicionar nota interna..."
                  rows={3}
                  className="resize-none text-sm"
                  aria-label="Nova nota"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={!note.trim() || isSavingNote}
                  onClick={async () => {
                    if (!note.trim()) return;
                    if (onSaveNote) {
                      setIsSavingNote(true);
                      try {
                        await onSaveNote(transaction.id, note.trim());
                        toast.success("✓ Nota salva com sucesso");
                        setNote("");
                      } catch {
                        toast.error("Erro ao salvar nota");
                      } finally {
                        setIsSavingNote(false);
                      }
                    } else {
                      // No persistence handler: show info
                      toast.success("ℹ️ Para salvar notas, configure o handler onSaveNote");
                    }
                  }}
                >
                  {isSavingNote ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" />
                  )}
                  Adicionar Nota
                </Button>

                {/* Existing observations as note */}
                {transaction.observacoes && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Sistema</span>
                      <span>•</span>
                      {transaction.updated_at && (
                        <span>{new Date(transaction.updated_at).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    <p className="text-sm">{transaction.observacoes}</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* ── SEÇÃO 10: Footer ──────────────────────────────────────────────── */}
        <div className="border-t bg-muted/30 px-6 py-3 flex items-center justify-between gap-3 flex-wrap shrink-0">
          {/* Navigation */}
          <div className="flex items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={goToPrev}
                    disabled={!hasPrev}
                    aria-label="Transação anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                </TooltipTrigger>
                <TooltipContent>← Transação anterior</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="text-xs text-muted-foreground px-1">
              {currentIndex + 1} / {transactions.length}
            </span>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={goToNext}
                    disabled={!hasNext}
                    aria-label="Próxima transação"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Próxima transação →</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={handleCopyId}
              title="Copiar ID (Ctrl+C)"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar ID
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 text-xs"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-3.5 w-3.5" />
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
