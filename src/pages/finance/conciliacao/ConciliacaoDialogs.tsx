import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Link, Plus, Lightbulb, User, History } from "lucide-react";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import { PatientCombobox } from "@/components/ui/patient-combobox";
import { ImportStatementDialog } from "@/components/financial/ImportStatementDialog";
import { BankAccountDialog } from "@/components/financial/BankAccountDialog";
import { SplitPaymentModal } from "@/components/financial/SplitPaymentModal";
import { AdjustmentDialog } from "@/components/financial/AdjustmentDialog";
import { RefundDialog } from "@/components/financial/RefundDialog";
import { ExportModal } from "@/components/financial/ExportModal";
import { AutoReconcileSettings } from "@/components/financial/AutoReconcileSettings";
import { AuditTrail } from "@/components/financial/AuditTrail";
import { TransactionDetailModal } from "@/components/financial/TransactionDetailModal";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "./types";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import type { PossibleMatch } from "@/modules/finance/services/matchingService";
import type { Anomaly } from "@/modules/finance/services/anomalyDetectionService";

interface ConciliacaoDialogsProps {
  state: any; // useConciliacaoState return type
}

const confidenceColor = (c: number) => {
  if (c >= 0.8) return "text-green-600 font-semibold";
  if (c >= 0.6) return "text-yellow-600 font-semibold";
  return "text-muted-foreground";
};

export function ConciliacaoDialogs({ state: s }: ConciliacaoDialogsProps) {
  return (
    <>
      {/* Match Dialog */}
      <Dialog open={s.showMatchDialog} onOpenChange={(open: boolean) => { if (!open) s.setShowMatchDialog(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conciliar Transação</DialogTitle>
            <DialogDescription>Vincule esta transação a um pagamento ou crie uma nova despesa</DialogDescription>
          </DialogHeader>
          {s.selectedTransaction && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Transação selecionada</p>
                <p className="font-medium text-sm mt-0.5">{s.selectedTransaction.descricao}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-sm font-semibold ${s.selectedTransaction.tipo === "credito" ? "text-green-600" : "text-red-600"}`}>
                    {s.selectedTransaction.tipo === "credito" ? "+" : "-"}{formatBRL(Math.abs(s.selectedTransaction.valor))}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(s.selectedTransaction.data_transacao).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5"><User className="h-4 w-4 text-muted-foreground" /><Label>Vincular Paciente (opcional)</Label></div>
                <PatientCombobox value={s.linkedPatientId} onValueChange={s.setLinkedPatientId} placeholder="Selecionar paciente..." />
              </div>
              <div>
                <Label className="mb-2 block">Opção de Pagamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button className={`p-3 rounded-lg border text-sm text-left transition-colors ${s.reconcileMode === "existing" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"}`} onClick={() => s.setReconcileMode("existing")}>
                    <Link className="h-4 w-4 mb-1" /><p className="font-medium">Conciliar Pagamento</p><p className="text-xs text-muted-foreground">Vincular a pagamento registrado</p>
                  </button>
                  <button className={`p-3 rounded-lg border text-sm text-left transition-colors ${s.reconcileMode === "create_expense" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"}`} onClick={() => s.setReconcileMode("create_expense")}>
                    <Plus className="h-4 w-4 mb-1" /><p className="font-medium">Criar Despesa</p><p className="text-xs text-muted-foreground">Registrar nova despesa</p>
                  </button>
                </div>
              </div>
              {s.reconcileMode === "existing" && (
                <div className="space-y-3">
                  {s.suggestionsLoading[s.selectedTransaction.id] ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Buscando sugestões de pagamento...</p>
                  ) : (s.suggestions[s.selectedTransaction.id] ?? []).length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3 text-blue-500" /> Sugestões ({(s.suggestions[s.selectedTransaction.id] ?? []).length})
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {(s.suggestions[s.selectedTransaction.id] ?? []).map((sg: PossibleMatch) => (
                          <div key={sg.paymentId} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded p-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{sg.descricao}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">{formatBRL(sg.valor)}</span>
                                <span className={`text-xs ${confidenceColor(sg.confianca)}`}>• {Math.round(sg.confianca * 100)}% compatível</span>
                              </div>
                            </div>
                            <Button size="sm" className="ml-2 h-7 text-xs gap-1 shrink-0" onClick={() => s.handleAcceptSuggestion(s.selectedTransaction.id, sg.paymentId)}>
                              <Check className="h-3 w-3" /> Aceitar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">Nenhum pagamento sugerido para o período desta transação.</p>
                  )}
                  <div>
                    <Label>Notas (opcional)</Label>
                    <Input placeholder="Adicione observações..." value={s.matchNotes} onChange={(e) => s.setMatchNotes(e.target.value)} className="mt-1.5" />
                  </div>
                  <Button className="w-full" onClick={() => s.handleManualMatch(s.selectedTransaction.id)} disabled={s.isReconciling}>
                    {s.isReconciling ? "Processando..." : "Conciliar Transação"}
                  </Button>
                </div>
              )}
              {s.reconcileMode === "create_expense" && (
                <div className="space-y-3">
                  <div>
                    <Label>Descrição da Despesa</Label>
                    <Input value={s.expenseForm.descricao} onChange={(e) => s.setExpenseForm((p: any) => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Aluguel, Material..." className="mt-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Categoria</Label>
                      <Select value={s.expenseForm.categoria} onValueChange={(v) => s.setExpenseForm((p: any) => ({ ...p, categoria: v }))}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>{EXPENSE_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c] ?? c}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={s.expenseForm.status} onValueChange={(v) => s.setExpenseForm((p: any) => ({ ...p, status: v }))}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="pago">Pago</SelectItem><SelectItem value="pendente">Pendente</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Data de Vencimento</Label>
                    <Input type="date" value={s.expenseForm.data_vencimento} onChange={(e) => s.setExpenseForm((p: any) => ({ ...p, data_vencimento: e.target.value }))} className="mt-1.5" />
                  </div>
                  <div className="bg-muted rounded p-2 text-xs text-muted-foreground">
                    Valor: <span className="font-semibold text-foreground">{formatBRL(Math.abs(s.selectedTransaction.valor))}</span>
                  </div>
                  <Button className="w-full gap-2" onClick={s.handleCreateExpense} disabled={s.isSavingExpense}>
                    <Plus className="h-4 w-4" /> {s.isSavingExpense ? "Criando despesa..." : "Criar Despesa e Conciliar"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={s.showEditDialog} onOpenChange={(open: boolean) => { if (!open) s.setShowEditDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
            <DialogDescription>Altere os dados desta transação bancária</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição</Label><Input value={s.editForm.descricao} onChange={(e) => s.setEditForm((p: any) => ({ ...p, descricao: e.target.value }))} placeholder="Descrição da transação" className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" min="0" step="0.01" value={s.editForm.valor} onChange={(e) => s.setEditForm((p: any) => ({ ...p, valor: e.target.value }))} placeholder="0,00" className="mt-1.5" /></div>
              <div><Label>Data</Label><Input type="date" value={s.editForm.data_transacao} onChange={(e) => s.setEditForm((p: any) => ({ ...p, data_transacao: e.target.value }))} className="mt-1.5" /></div>
            </div>
            {s.accounts.length > 0 && (
              <div>
                <Label>Conta Bancária</Label>
                <Select value={s.editForm.bank_account_id} onValueChange={(v) => s.setEditForm((p: any) => ({ ...p, bank_account_id: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                  <SelectContent>{s.accounts.map((acc: any) => (<SelectItem key={acc.id} value={acc.id}>{acc.apelido || acc.banco_nome}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => s.setShowEditDialog(false)}>Cancelar</Button>
              <Button onClick={s.handleSaveEdit} disabled={s.isUpdating}>{s.isUpdating ? "Salvando..." : "Salvar Alterações"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={s.showDeleteConfirm} onOpenChange={s.setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir Transação?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não poderá ser desfeita. A transação <strong>{s.selectedTransaction?.descricao}</strong> ({s.selectedTransaction ? formatBRL(Math.abs(s.selectedTransaction.valor)) : ""}) será permanentemente removida.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={s.handleConfirmDelete} disabled={s.isDeleting} className="bg-red-600 hover:bg-red-700">
              {s.isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={s.showRejectDialog} onOpenChange={s.setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Rejeitar Transação?</AlertDialogTitle>
          <AlertDialogDescription>Adicione um motivo para rejeição</AlertDialogDescription>
          <Input placeholder="Motivo da rejeição..." value={s.rejectMotivo} onChange={(e) => s.setRejectMotivo(e.target.value)} />
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={s.handleReject} disabled={s.isRejecting} className="bg-red-600 hover:bg-red-700">
              {s.isRejecting ? "Rejeitando..." : "Rejeitar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import / Bank Account */}
      <ImportStatementDialog open={s.showImportDialog} onOpenChange={s.setShowImportDialog} />
      <BankAccountDialog open={s.showBankAccountDialog} onOpenChange={s.setShowBankAccountDialog} />

      {/* Enterprise dialogs */}
      <SplitPaymentModal open={s.showSplitModal} transaction={s.selectedTransaction} clinicId={s.activeClinicId ?? ""} onClose={() => s.setShowSplitModal(false)} onSaved={() => { s.setShowSplitModal(false); s.setSelectedTransaction(null); }} />
      <AdjustmentDialog open={s.showAdjustmentDialog} clinicId={s.activeClinicId ?? ""} transactionId={s.selectedTransaction?.id} onClose={() => s.setShowAdjustmentDialog(false)} onSaved={() => s.setShowAdjustmentDialog(false)} />
      <RefundDialog open={s.showRefundDialog} transaction={s.selectedTransaction} clinicId={s.activeClinicId ?? ""} onClose={() => s.setShowRefundDialog(false)} onSaved={() => { s.setShowRefundDialog(false); s.setSelectedTransaction(null); }} />
      <ExportModal open={s.showExportModal} clinicId={s.activeClinicId ?? ""} onClose={() => s.setShowExportModal(false)} />
      <AutoReconcileSettings open={s.showAutoReconcileSettings} clinicId={s.activeClinicId ?? ""} onClose={() => s.setShowAutoReconcileSettings(false)} />

      {/* Audit Trail */}
      <Dialog open={s.showAuditTrail} onOpenChange={s.setShowAuditTrail}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Histórico de Auditoria</DialogTitle>
            <DialogDescription>Registro imutável de todas as ações realizadas</DialogDescription>
          </DialogHeader>
          <AuditTrail clinicId={s.activeClinicId ?? ""} resourceId={s.selectedTransaction?.id} limit={50} />
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <TransactionDetailModal
        transaction={s.detailModalTransaction}
        transactions={s.filtered}
        open={s.showDetailModal}
        onOpenChange={(open) => { s.setShowDetailModal(open); if (!open) s.setDetailModalTransaction(null); }}
        suggestions={s.detailModalTransaction ? (s.suggestions[s.detailModalTransaction.id] ?? []) : []}
        suggestionsLoading={s.detailModalTransaction ? (s.suggestionsLoading[s.detailModalTransaction.id] ?? false) : false}
        anomalies={s.detailModalTransaction ? (s.anomalies[s.detailModalTransaction.id] ?? []) : []}
        clinicId={s.activeClinicId ?? undefined}
        onEdit={(tx) => s.handleOpenEditDialog(tx)}
        onReconcile={(tx) => s.handleOpenMatchDialog(tx)}
        onReject={(tx) => s.handleOpenRejectDialog(tx)}
        onSplit={(tx) => { s.setSelectedTransaction(tx); s.setShowSplitModal(true); }}
        onRefund={(tx) => { s.setSelectedTransaction(tx); s.setShowRefundDialog(true); }}
        onAdjust={(tx) => { s.setSelectedTransaction(tx); s.setShowAdjustmentDialog(true); }}
        onUndo={(tx) => s.handleUndoReconcile(tx)}
        onDelete={(tx) => s.handleOpenDeleteConfirm(tx)}
        onAcceptSuggestion={(transactionId, paymentId) => s.handleAcceptSuggestion(transactionId, paymentId)}
        onNavigate={(tx) => { s.setDetailModalTransaction(tx); s.setSelectedTransaction(tx); s.loadSuggestions(tx.id); }}
      />
    </>
  );
}
