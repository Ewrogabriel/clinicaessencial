import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { TransactionTimeline } from "./TransactionTimeline";
import { getStatusConfig, formatBRL, formatTransactionDate, canUndo } from "@/modules/finance/utils/reconciliationHelpers";
import type { BankTransaction } from "@/modules/finance/services/reconciliationService";

interface TransactionDetailDrawerProps {
  transaction: BankTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string, note?: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onUndo: (id: string) => Promise<void>;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export function TransactionDetailDrawer({
  transaction,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onUndo,
  isApproving,
  isRejecting,
}: TransactionDetailDrawerProps) {
  const [note, setNote] = useState("");

  if (!transaction) return null;

  const statusCfg = getStatusConfig(transaction.status);
  const isPending = !transaction.status || transaction.status === "pendente";
  const undoable = canUndo(transaction) && !isPending;

  const handleApprove = async () => {
    await onApprove(transaction.id, note || undefined);
    setNote("");
    onOpenChange(false);
  };

  const handleReject = async () => {
    await onReject(transaction.id, note || undefined);
    setNote("");
    onOpenChange(false);
  };

  const handleUndo = async () => {
    await onUndo(transaction.id);
    onOpenChange(false);
  };

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Data", value: formatTransactionDate(transaction.data_transacao, "dd/MM/yyyy") },
    { label: "Valor", value: <span className={Number(transaction.valor) >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{formatBRL(Number(transaction.valor))}</span> },
    { label: "Tipo", value: transaction.tipo ?? "—" },
    { label: "Categoria", value: transaction.categoria ?? "—" },
    { label: "Documento", value: transaction.documento ?? "—" },
    { label: "Saldo Pós-Tx", value: transaction.saldo != null ? formatBRL(Number(transaction.saldo)) : "—" },
    { label: "Confiança Match", value: transaction.matched_confidence != null ? `${(transaction.matched_confidence * 100).toFixed(0)}%` : "—" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Detalhe da Transação
            <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
          </SheetTitle>
          <SheetDescription className="text-sm">
            {transaction.descricao}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Fields */}
          <div className="rounded-lg border bg-muted/30 divide-y">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right">{value}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Actions */}
          {isPending && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Observação / Motivo</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opcional..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-1"
                  onClick={handleApprove}
                  disabled={isApproving || isRejecting}
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Aprovar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1"
                  onClick={handleReject}
                  disabled={isApproving || isRejecting}
                >
                  {isRejecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Rejeitar
                </Button>
              </div>
            </div>
          )}

          {undoable && (
            <Button
              variant="outline"
              className="w-full gap-1"
              onClick={handleUndo}
            >
              <RotateCcw className="h-4 w-4" />
              Desfazer revisão
            </Button>
          )}

          <Separator />

          {/* Timeline */}
          <TransactionTimeline transaction={transaction} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
