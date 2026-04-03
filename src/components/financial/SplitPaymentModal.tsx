import { useState, useEffect } from "react";
import { Plus, Trash2, Check } from "lucide-react";
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
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import { splitService, SplitEntry } from "@/modules/finance/services/splitService";
import { toast } from "@/modules/shared/hooks/use-toast";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";

interface SplitPaymentModalProps {
  open: boolean;
  transaction: BankTransactionRow | null;
  clinicId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SplitPaymentModal({
  open,
  transaction,
  clinicId,
  onClose,
  onSaved,
}: SplitPaymentModalProps) {
  const [splits, setSplits] = useState<SplitEntry[]>([
    { amount: 0, description: "" },
    { amount: 0, description: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const totalAmount = transaction ? Math.abs(transaction.valor) : 0;
  const splitSum = splits.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const remaining = totalAmount - splitSum;
  const isValid = Math.abs(remaining) < 0.01 && splits.length >= 2 && splits.every((s) => Number(s.amount) > 0);

  useEffect(() => {
    if (open && transaction) {
      setSplits([
        { amount: 0, description: "" },
        { amount: 0, description: "" },
      ]);
    }
  }, [open, transaction]);

  const addSplit = () => {
    if (splits.length < 10) {
      setSplits((prev) => [...prev, { amount: 0, description: "" }]);
    }
  };

  const removeSplit = (idx: number) => {
    if (splits.length > 2) {
      setSplits((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const updateSplit = (idx: number, field: keyof SplitEntry, value: string) => {
    setSplits((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, [field]: field === "amount" ? parseFloat(value) || 0 : value }
          : s
      )
    );
  };

  const distributeEvenly = () => {
    const perItem = Math.floor((totalAmount / splits.length) * 100) / 100;
    const last = totalAmount - perItem * (splits.length - 1);
    setSplits((prev) =>
      prev.map((s, i) => ({ ...s, amount: i === prev.length - 1 ? last : perItem }))
    );
  };

  const handleSave = async () => {
    if (!transaction || !clinicId) return;
    try {
      setIsSaving(true);
      await splitService.createSplits(clinicId, transaction.id, transaction.valor, splits);
      toast({ title: "✓ Splits criados com sucesso" });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: err?.message ?? "Erro ao criar splits", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Split de Pagamento</DialogTitle>
          <DialogDescription>
            Divida {transaction ? formatBRL(Math.abs(transaction.valor)) : ""} entre múltiplos pagamentos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total da transação:</span>
            <span className="font-semibold">{formatBRL(totalAmount)}</span>
          </div>

          {splits.map((split, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1">
                <Label className="text-xs">Descrição {idx + 1}</Label>
                <Input
                  value={split.description ?? ""}
                  onChange={(e) => updateSplit(idx, "description", e.target.value)}
                  placeholder={`Parte ${idx + 1}`}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div className="w-32">
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={split.amount || ""}
                  onChange={(e) => updateSplit(idx, "amount", e.target.value)}
                  placeholder="0,00"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSplit(idx)}
                disabled={splits.length <= 2}
                className="mt-5"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addSplit} className="gap-1">
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
            <Button variant="outline" size="sm" onClick={distributeEvenly}>
              Distribuir igualmente
            </Button>
          </div>

          <div
            className={`flex items-center justify-between text-sm font-medium p-2 rounded ${
              Math.abs(remaining) < 0.01
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <span>Restante:</span>
            <span>{formatBRL(remaining)}</span>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!isValid || isSaving} className="gap-2">
              <Check className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar Split"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
