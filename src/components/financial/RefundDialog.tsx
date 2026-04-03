import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/modules/shared/hooks/use-toast";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";

interface RefundDialogProps {
  open: boolean;
  transaction: BankTransactionRow | null;
  clinicId: string;
  onClose: () => void;
  onSaved: () => void;
}

const REFUND_REASONS = [
  { value: "cancelamento", label: "Cancelamento" },
  { value: "devolucao", label: "Devolução" },
  { value: "erro", label: "Erro de cobrança" },
  { value: "outro", label: "Outro" },
];

export function RefundDialog({
  open,
  transaction,
  clinicId,
  onClose,
  onSaved,
}: RefundDialogProps) {
  const [reason, setReason] = useState("cancelamento");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!transaction || !clinicId) return;

    try {
      setIsSaving(true);

      // Mark original transaction as having a refund
      const { error: txErr } = await (supabase as any)
        .from("bank_transactions")
        .update({
          refund_reason: reason,
          observacoes: notes || null,
          status: "conciliado",
        })
        .eq("id", transaction.id);

      if (txErr) throw txErr;

      // Create a linked refund transaction entry (negative credit)
      const { error: newTxErr } = await (supabase as any)
        .from("bank_transactions")
        .insert({
          clinic_id: clinicId,
          bank_account_id: transaction.bank_account_id,
          data_transacao: new Date().toISOString().split("T")[0],
          descricao: `REEMBOLSO: ${transaction.descricao}`,
          valor: -Math.abs(transaction.valor),
          tipo: "credito",
          categoria: "reembolso",
          status: "conciliado",
          is_refund: true,
          original_tx_id: transaction.id,
          refund_reason: reason,
          observacoes: notes || `Reembolso de transação ${transaction.id.slice(0, 8)}`,
        });

      if (newTxErr) throw newTxErr;

      toast({ title: "✓ Reembolso registrado com sucesso" });
      onSaved();
      onClose();
      setReason("cancelamento");
      setNotes("");
    } catch {
      toast({ title: "Erro ao registrar reembolso", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Reembolso</DialogTitle>
          <DialogDescription>
            Registre um reembolso/devolução para esta transação
          </DialogDescription>
        </DialogHeader>

        {transaction && (
          <div className="bg-muted rounded p-3 text-sm">
            <div className="font-medium">{transaction.descricao}</div>
            <div className="text-muted-foreground">{formatBRL(Math.abs(transaction.valor))}</div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label>Motivo do Reembolso *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais..."
              className="mt-1.5"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSaving ? "Salvando..." : "Registrar Reembolso"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
