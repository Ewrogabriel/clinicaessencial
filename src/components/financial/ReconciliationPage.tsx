import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckSquare,
  XSquare,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Landmark,
  Plus,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReconciliation } from "@/modules/finance/hooks/useReconciliation";
import { TransactionFilter } from "./TransactionFilter";
import { BulkApprovalDialog } from "./BulkApprovalDialog";
import { TransactionDetailDrawer } from "./TransactionDetailDrawer";
import { BankAccountDialog } from "./BankAccountDialog";
import { ImportStatementDialog } from "./ImportStatementDialog";
import {
  getStatusConfig,
  formatBRL,
  formatTransactionDate,
  sortTransactions,
  canUndo,
} from "@/modules/finance/utils/reconciliationHelpers";
import type { BankTransaction } from "@/modules/finance/services/reconciliationService";
import { toast } from "@/modules/shared/hooks/use-toast";

export function ReconciliationPage() {
  const {
    transactions,
    isLoading,
    stats,
    filters,
    setFilters,
    selectedIds,
    toggleSelect,
    selectAll,
    selectNone,
    approve,
    reject,
    bulkApprove,
    bulkReject,
    undo,
    isApproving,
    isRejecting,
    isBulkApproving,
    isBulkRejecting,
  } = useReconciliation();

  const [bulkDialog, setBulkDialog] = useState<{
    open: boolean;
    action: "approve" | "reject";
  }>({ open: false, action: "approve" });
  const [detailTx, setDetailTx] = useState<BankTransaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [bankAccountDialogOpen, setBankAccountDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const sorted = sortTransactions(transactions);
  const allSelected =
    sorted.length > 0 && selectedIds.length === sorted.length;
  const someSelected = selectedIds.length > 0;

  const handleBulkConfirm = async (note: string) => {
    try {
      const result =
        bulkDialog.action === "approve"
          ? await bulkApprove({ ids: selectedIds, note })
          : await bulkReject({ ids: selectedIds, reason: note });

      toast({
        title:
          bulkDialog.action === "approve"
            ? "Aprovação em lote"
            : "Rejeição em lote",
        description: `${result.success} processada(s) com sucesso${result.failed > 0 ? `, ${result.failed} falharam` : ""}.`,
      });
    } catch {
      toast({ title: "Erro ao processar lote", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Conciliação Bancária
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setBankAccountDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Cadastrar Conta
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Importar Extrato
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      <div>
        <button
          onClick={() => setShowStats((p) => !p)}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors"
        >
          {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Resumo da Conciliação
        </button>

        {showStats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total", value: stats?.total ?? 0, cls: "" },
              { label: "Pendentes", value: stats?.pending ?? 0, cls: "text-yellow-600" },
              { label: "Aprovadas", value: stats?.approved ?? 0, cls: "text-green-600" },
              { label: "Rejeitadas", value: stats?.rejected ?? 0, cls: "text-red-600" },
            ].map(({ label, value, cls }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("text-2xl font-bold", cls)}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <TransactionFilter filters={filters} onChange={setFilters} />

      {/* Bulk actions toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={allSelected ? selectNone : selectAll}
          className="gap-1 h-8 text-xs"
        >
          <Checkbox
            checked={allSelected}
            className="h-3 w-3 pointer-events-none"
          />
          {allSelected ? "Desmarcar todos" : "Selecionar todos"}
        </Button>

        {someSelected && (
          <>
            <Badge variant="secondary" className="h-7 px-2 text-xs">
              {selectedIds.length} selecionada{selectedIds.length !== 1 ? "s" : ""}
            </Badge>
            <Button
              size="sm"
              className="gap-1 h-8 text-xs"
              onClick={() => setBulkDialog({ open: true, action: "approve" })}
              disabled={isBulkApproving}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Aprovar selecionadas
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1 h-8 text-xs"
              onClick={() => setBulkDialog({ open: true, action: "reject" })}
              disabled={isBulkRejecting}
            >
              <XSquare className="h-3.5 w-3.5" />
              Rejeitar selecionadas
            </Button>
          </>
        )}
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4" />
            Transações Bancárias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma transação encontrada com os filtros atuais.
            </div>
          ) : (
            <div className="divide-y">
              {sorted.map((tx) => {
                const selected = selectedIds.includes(tx.id);
                const statusCfg = getStatusConfig(tx.status);
                const undoable = canUndo(tx) && !(!tx.status || tx.status === "pendente");

                return (
                  <div
                    key={tx.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer",
                      selected && "bg-blue-50/50 dark:bg-blue-900/10"
                    )}
                    onClick={() => {
                      setDetailTx(tx);
                      setDetailOpen(true);
                    }}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(tx.id);
                      }}
                    >
                      <Checkbox
                        checked={selected}
                        className="h-4 w-4"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {tx.descricao}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTransactionDate(tx.data_transacao)}
                        {tx.documento ? ` · ${tx.documento}` : ""}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          Number(tx.valor) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {formatBRL(Number(tx.valor))}
                      </p>
                      <Badge className={cn("text-xs", statusCfg.className)}>
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {undoable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Desfazer revisão"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await undo(tx.id);
                            toast({ title: "Revisão desfeita com sucesso." });
                          } catch {
                            toast({ title: "Erro ao desfazer", variant: "destructive" });
                          }
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk dialog */}
      <BulkApprovalDialog
        open={bulkDialog.open}
        onOpenChange={(o) => setBulkDialog((p) => ({ ...p, open: o }))}
        selectedCount={selectedIds.length}
        action={bulkDialog.action}
        onConfirm={handleBulkConfirm}
        isLoading={isBulkApproving || isBulkRejecting}
      />

      {/* Detail drawer */}
      <TransactionDetailDrawer
        transaction={detailTx}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onApprove={async (id, note) => {
          await approve({ id, note });
          toast({ title: "Transação aprovada." });
        }}
        onReject={async (id, reason) => {
          await reject({ id, reason });
          toast({ title: "Transação rejeitada." });
        }}
        onUndo={async (id) => {
          await undo(id);
          toast({ title: "Revisão desfeita." });
        }}
        isApproving={isApproving}
        isRejecting={isRejecting}
      />

      {/* Bank account dialog */}
      <BankAccountDialog
        open={bankAccountDialogOpen}
        onOpenChange={setBankAccountDialogOpen}
      />

      {/* Import statement dialog */}
      <ImportStatementDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}
