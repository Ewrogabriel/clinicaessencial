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
import { toast } from "sonner";
interface AdjustmentDialogProps {
  open: boolean;
  clinicId: string;
  transactionId?: string;
  onClose: () => void;
  onSaved: () => void;
}

type AdjustmentType = "ajuste" | "provisao" | "contra_partida";

const TYPE_LABELS: Record<AdjustmentType, string> = {
  ajuste: "Ajuste (arredondamento, diferença)",
  provisao: "Provisão (valor futuro)",
  contra_partida: "Contra-partida (outra conta)",
};

export function AdjustmentDialog({
  open,
  clinicId,
  transactionId,
  onClose,
  onSaved,
}: AdjustmentDialogProps) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    type: "ajuste" as AdjustmentType,
    reason: "",
    exclude_fiscal: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount || !form.reason.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount === 0) {
      toast.error("Valor inválido");
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await (supabase as any).from("adjustments").insert({
        clinic_id: clinicId,
        bank_transaction_id: transactionId ?? null,
        description: form.description,
        amount,
        type: form.type,
        reason: form.reason,
        exclude_fiscal: form.exclude_fiscal,
      });
      if (error) throw error;
      toast.success("✓ Ajuste criado com sucesso");
      onSaved();
      onClose();
      setForm({ description: "", amount: "", type: "ajuste", reason: "", exclude_fiscal: false });
    } catch {
      toast.error("Erro ao criar ajuste");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Ajuste</DialogTitle>
          <DialogDescription>
            Registre ajustes, provisões ou contra-partidas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo *</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((p) => ({ ...p, type: v as AdjustmentType }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição *</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Ex: Diferença de arredondamento"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0,00"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Motivo / Justificativa *</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Motivo obrigatório para auditoria"
              className="mt-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="exclude_fiscal"
              checked={form.exclude_fiscal}
              onChange={(e) => setForm((p) => ({ ...p, exclude_fiscal: e.target.checked }))}
              className="h-4 w-4"
            />
            <Label htmlFor="exclude_fiscal" className="text-sm font-normal cursor-pointer">
              Excluir de relatórios fiscais
            </Label>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Criar Ajuste"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
