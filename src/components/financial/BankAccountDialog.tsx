import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { Loader2, Building2 } from "lucide-react";
import { BANCO_OPTIONS } from "@/modules/finance/types";
import type { BankAccount, CreateBankAccountDTO } from "@/modules/finance/types";

interface BankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dto: Omit<CreateBankAccountDTO, "clinic_id">) => Promise<void>;
  account?: BankAccount | null;
  isLoading?: boolean;
}

const EMPTY: Omit<CreateBankAccountDTO, "clinic_id"> = {
  banco_codigo: "",
  banco_nome: "",
  agencia: "",
  conta: "",
  tipo: "corrente",
  apelido: "",
  ativo: true,
};

export function BankAccountDialog({
  open,
  onOpenChange,
  onSave,
  account,
  isLoading = false,
}: BankAccountDialogProps) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      if (account) {
        setForm({
          banco_codigo: account.banco_codigo ?? "",
          banco_nome: account.banco_nome ?? "",
          agencia: account.agencia ?? "",
          conta: account.conta ?? "",
          tipo: account.tipo ?? "corrente",
          apelido: account.apelido ?? "",
          ativo: account.ativo ?? true,
        });
      } else {
        setForm(EMPTY);
      }
    }
  }, [open, account]);

  const handleBancoChange = (value: string) => {
    const opt = BANCO_OPTIONS.find((b) => b.value === value);
    if (opt) {
      setForm((f) => ({
        ...f,
        banco_codigo: opt.codigo,
        banco_nome: opt.label,
      }));
    } else {
      setForm((f) => ({ ...f, banco_codigo: value, banco_nome: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.banco_codigo || !form.banco_nome) return;
    await onSave(form);
    onOpenChange(false);
  };

  const selectedBanco =
    BANCO_OPTIONS.find((b) => b.codigo === form.banco_codigo)?.value ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {account ? "Editar Conta Bancária" : "Cadastrar Conta Bancária"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da conta para importar extratos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Banco */}
          <div className="space-y-1.5">
            <Label htmlFor="banco">Banco</Label>
            <Select value={selectedBanco} onValueChange={handleBancoChange}>
              <SelectTrigger id="banco">
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                {BANCO_OPTIONS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Apelido */}
          <div className="space-y-1.5">
            <Label htmlFor="apelido">Nome / Apelido</Label>
            <Input
              id="apelido"
              placeholder="Ex.: Conta principal Inter"
              value={form.apelido ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Agência */}
            <div className="space-y-1.5">
              <Label htmlFor="agencia">Agência</Label>
              <Input
                id="agencia"
                placeholder="0001"
                value={form.agencia ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, agencia: e.target.value }))}
              />
            </div>

            {/* Conta */}
            <div className="space-y-1.5">
              <Label htmlFor="conta">Conta</Label>
              <Input
                id="conta"
                placeholder="12345-6"
                value={form.conta ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, conta: e.target.value }))}
              />
            </div>
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de Conta</Label>
            <Select
              value={form.tipo ?? "corrente"}
              onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
            >
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="investimento">Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Ativa para sincronização</p>
              <p className="text-xs text-muted-foreground">
                Conta disponível para importar extratos
              </p>
            </div>
            <Switch
              checked={form.ativo ?? true}
              onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !form.banco_codigo}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
