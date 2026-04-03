import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { ReconciliationDashboard } from "@/components/financial/ReconciliationDashboard";
import { AdvancedFiltersPanel } from "@/components/financial/AdvancedFiltersPanel";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";

import { useConciliacaoState } from "./conciliacao/useConciliacaoState";
import { ConciliacaoHeader } from "./conciliacao/ConciliacaoHeader";
import { TransactionRow } from "./conciliacao/TransactionRow";
import { ConciliacaoDialogs } from "./conciliacao/ConciliacaoDialogs";

export default function ConciliacaoBancaria() {
  const state = useConciliacaoState();

  return (
    <div className="space-y-6">
      <ConciliacaoHeader
        isRunningAutoReconcile={state.isRunningAutoReconcile}
        isAutoMatching={state.isAutoMatching}
        unreconciledCount={state.unreconciledTransactions.length}
        onAutoReconcile={state.handleRunAutoReconcile}
        onAutoMatch={state.handleAutoMatch}
        onImport={() => state.setShowImportDialog(true)}
        onExport={() => state.setShowExportModal(true)}
        onAuditTrail={() => state.setShowAuditTrail(true)}
        onSettings={() => state.setShowAutoReconcileSettings(true)}
        onNewBankAccount={() => state.setShowBankAccountDialog(true)}
      />

      <ReconciliationDashboard
        transactions={state.transactions}
        anomalies={state.anomalies}
        autoStats={state.autoStats}
      />

      <Card>
        <CardContent className="p-4">
          <AdvancedFiltersPanel
            filters={state.filters}
            onChange={state.setFilters}
            accounts={state.accounts}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Transações ({state.filtered.length})</CardTitle>
          {state.filtered.some((tx: BankTransactionRow) => !tx.status || tx.status === "pendente") && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
              {state.filtered.filter((tx: BankTransactionRow) => !tx.status || tx.status === "pendente").length} pendentes
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[700px] overflow-y-auto">
            {state.filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma transação encontrada</div>
            ) : (
              state.filtered.map((tx: BankTransactionRow) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  isExpanded={state.expandedIds.has(tx.id)}
                  suggestions={state.suggestions[tx.id] ?? []}
                  suggestionsLoading={state.suggestionsLoading[tx.id] ?? false}
                  anomalies={state.anomalies[tx.id] ?? []}
                  linkedPatientId={state.linkedPatientId}
                  onPatientChange={state.setLinkedPatientId}
                  onToggleExpand={state.handleToggleExpand}
                  onOpenDetail={state.handleOpenDetailModal}
                  onEdit={state.handleOpenEditDialog}
                  onDelete={state.handleOpenDeleteConfirm}
                  onReconcile={state.handleOpenMatchDialog}
                  onSplit={(tx) => { state.setSelectedTransaction(tx); state.setShowSplitModal(true); }}
                  onRefund={(tx) => { state.setSelectedTransaction(tx); state.setShowRefundDialog(true); }}
                  onUndo={state.handleUndoReconcile}
                  onReject={state.handleOpenRejectDialog}
                  onAcceptSuggestion={state.handleAcceptSuggestion}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {state.summary && state.summary.pendentes > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-amber-900">{state.summary.pendentes} transação(ões) pendente(s)</h4>
            <p className="text-sm text-amber-700 mt-1">
              Use o auto-matching para encontrar correspondências automáticas ou concilie manualmente clicando em "Conciliar".
            </p>
          </div>
        </div>
      )}

      <ConciliacaoDialogs state={state} />
    </div>
  );
}
