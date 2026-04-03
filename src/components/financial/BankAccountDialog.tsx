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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Landmark } from "lucide-react";
import { useBankAccounts } from "@/modules/finance/hooks/useBankAccounts";
import type { BankAccount } from "@/modules/finance/types";
import { toast } from "sonner";

const BANKS = [
  { codigo: "077", nome: "Inter" },
  { codigo: "260", nome: "Nubank" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "341", nome: "Itaú" },
  { codigo: "033", nome: "Santander" },
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "756", nome: "Sicoob" },
  { codigo: "748", nome: "Sicredi" },
  { codigo: "336", nome: "C6 Bank" },
  { codigo: "212", nome: "Banco Original" },
  { codigo: "290", nome: "PagBank" },
  { codigo: "000", nome: "Outro" },
];

const ACCOUNT_TYPES = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Conta Poupança" },
  { value: "investimento", label: "Investimento" },
];

interface BankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BankAccount | null;
}

interface FormData {
  apelido: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  conta: string;
  tipo: string;
  ativo: boolean;
}

const EMPTY_FORM: FormData = {
  apelido: "",
  banco_codigo: "",
  banco_nome: "",
  agencia: "",
  conta: "",
  tipo: "corrente",
  ativo: true,
};

export function BankAccountDialog({
  open,
  onOpenChange,
  account,
}: BankAccountDialogProps) {
  const { createAccount, updateAccount, isCreating, isUpdating } = useBankAccounts();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const isEditing = !!account;
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    if (account) {
      setForm({
        apelido: account.apelido ?? "",
        banco_codigo: account.banco_codigo ?? "",
        banco_nome: account.banco_nome ?? "",
        agencia: account.agencia ?? "",
        conta: account.conta ?? "",
        tipo: account.tipo ?? "corrente",
        ativo: account.ativo ?? true,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [account, open]);

  const update = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleBankChange = (codigo: string) => {
    const bank = BANKS.find((b) => b.codigo === codigo);
    update("banco_codigo", codigo);
    if (bank) update("banco_nome", bank.nome);
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.apelido.trim()) newErrors.apelido = "Nome da conta é obrigatório";
    if (!form.banco_codigo) newErrors.banco_codigo = "Selecione o banco";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (isEditing && account) {
        await updateAccount({
          id: account.id,
          data: {
            apelido: form.apelido,
            banco_nome: form.banco_nome,
            banco_codigo: form.banco_codigo,
            agencia: form.agencia,
            conta: form.conta,
            tipo: form.tipo,
            ativo: form.ativo,
          },
        });
        toast.success("Conta bancária atualizada com sucesso.");
      } else {
        await createAccount({
          apelido: form.apelido,
          banco_nome: form.banco_nome,
          banco_codigo: form.banco_codigo,
          agencia: form.agencia,
          conta: form.conta,
          tipo: form.tipo,
          ativo: form.ativo,
        });
        toast.success("Conta bancária cadastrada com sucesso.");
      }
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? "Erro ao atualizar conta" : "Erro ao cadastrar conta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            {isEditing ? "Editar Conta Bancária" : "Cadastrar Conta Bancária"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados da conta bancária."
              : "Preencha os dados para adicionar uma nova conta bancária."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Account name */}
          <div className="space-y-1.5">
            <Label htmlFor="apelido" className="text-sm">
              Nome da Conta <span className="text-red-500">*</span>
            </Label>
            <Input
              id="apelido"
              placeholder="Ex: Conta Corrente Inter"
              value={form.apelido}
              onChange={(e) => update("apelido", e.target.value)}
              className={errors.apelido ? "border-red-500" : ""}
            />
            {errors.apelido && (
              <p className="text-xs text-red-500">{errors.apelido}</p>
            )}
          </div>

          {/* Bank */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              Banco <span className="text-red-500">*</span>
            </Label>
            <Select value={form.banco_codigo} onValueChange={handleBankChange}>
              <SelectTrigger className={errors.banco_codigo ? "border-red-500" : ""}>
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((bank) => (
                  <SelectItem key={bank.codigo} value={bank.codigo}>
                    {bank.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.banco_codigo && (
              <p className="text-xs text-red-500">{errors.banco_codigo}</p>
            )}
          </div>

          {/* Agency and account */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agencia" className="text-sm">
                Agência
              </Label>
              <Input
                id="agencia"
                placeholder="0000"
                value={form.agencia}
                onChange={(e) => update("agencia", e.target.value)}
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta" className="text-sm">
                Conta
              </Label>
              <Input
                id="conta"
                placeholder="00000-0"
                value={form.conta}
                onChange={(e) => update("conta", e.target.value)}
                maxLength={20}
              />
            </div>
          </div>

          {/* Account type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Tipo de Conta</Label>
            <Select value={form.tipo} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Ativa para sincronização</Label>
              <p className="text-xs text-muted-foreground">
                Conta aparece nos filtros de conciliação
              </p>
            </div>
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => update("ativo", v)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              isEditing ? "Salvar alterações" : "Cadastrar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
