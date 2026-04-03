import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2 } from "lucide-react";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import type { CreateInvestmentFromTransactionDTO } from "@/modules/finance/services/investmentReconciliationService";
import { suggestInvestmentType, suggestInstitution } from "@/modules/finance/services/investmentDetectionService";
import { format } from "date-fns";

const TIPOS_INVESTIMENTO = [
  "CDB",
  "LCI",
  "LCA",
  "Tesouro Selic",
  "Tesouro IPCA+",
  "Tesouro Prefixado",
  "Poupança",
  "Fundo DI",
  "Fundo Multimercado",
  "Fundo Imobiliário",
  "Ações",
  "Debênture",
  "Previdência Privada",
  "Criptomoedas",
  "Outro",
];

const INDEXADORES = ["CDI", "IPCA", "SELIC", "Prefixado", "IGP-M", "Outro"];

interface CreateInvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransactionRow;
  onConfirm: (dto: CreateInvestmentFromTransactionDTO) => void;
  isLoading?: boolean;
}

export function CreateInvestmentDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
  isLoading,
}: CreateInvestmentDialogProps) {
  const suggestedTypes = suggestInvestmentType(transaction.descricao ?? "");
  const suggestedInstitutions = suggestInstitution(transaction.descricao ?? "");

  // Pre-fill from detection
  const [form, setForm] = useState<{
    nome: string;
    tipo: string;
    instituicao: string;
    taxa_contratada: string;
    indexador: string;
    percentual_indexador: string;
    data_vencimento: string;
    status: string;
    notas: string;
  }>({
    nome: suggestedTypes[0] ? `${suggestedTypes[0]} - ${format(new Date(transaction.data_transacao), "MM/yyyy")}` : "",
    tipo: suggestedTypes[0] || "CDB",
    instituicao: suggestedInstitutions[0] || "",
    taxa_contratada: "",
    indexador: "CDI",
    percentual_indexador: "100",
    data_vencimento: "",
    status: "ativo",
    notas: "",
  });

  const handleSubmit = () => {
    onConfirm({
      nome: form.nome,
      tipo: form.tipo,
      instituicao: form.instituicao || undefined,
      taxa_contratada: form.taxa_contratada
        ? parseFloat(form.taxa_contratada)
        : undefined,
      indexador: form.indexador,
      percentual_indexador: form.percentual_indexador
        ? parseFloat(form.percentual_indexador)
        : 100,
      data_vencimento: form.data_vencimento || undefined,
      status: form.status,
      notas: form.notas || undefined,
    });
  };

  const isValid = form.nome.trim().length > 0 && form.tipo.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Nova Aplicação de Investimento
          </DialogTitle>
        </DialogHeader>

        {/* Transaction info */}
        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
          <p className="font-medium">Transação vinculada:</p>
          <p className="text-muted-foreground">
            {format(new Date(transaction.data_transacao), "dd/MM/yyyy")} •{" "}
            <span className={transaction.valor < 0 ? "text-red-600" : "text-green-600"}>
              {formatBRL(Math.abs(transaction.valor))}
            </span>
          </p>
          {transaction.descricao && (
            <p className="text-muted-foreground truncate">{transaction.descricao}</p>
          )}
        </div>

        {/* Type suggestions */}
        {suggestedTypes.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tipos sugeridos:</p>
            <div className="flex flex-wrap gap-1">
              {suggestedTypes.slice(0, 5).map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs"
                  onClick={() => setForm((p) => ({ ...p, tipo: t }))}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Nome */}
          <div>
            <Label>Nome / Descrição *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: CDB Nubank 120% CDI"
            />
          </div>

          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_INVESTIMENTO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Instituição */}
            <div>
              <Label>Instituição</Label>
              <Input
                value={form.instituicao}
                onChange={(e) =>
                  setForm((p) => ({ ...p, instituicao: e.target.value }))
                }
                placeholder="Nubank, XP, Itaú..."
                list="institutions-list"
              />
              <datalist id="institutions-list">
                {suggestedInstitutions.map((inst) => (
                  <option key={inst} value={inst} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Taxa / Indexador */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Taxa Contratada (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.taxa_contratada}
                onChange={(e) =>
                  setForm((p) => ({ ...p, taxa_contratada: e.target.value }))
                }
                placeholder="12.5"
              />
            </div>
            <div>
              <Label>Indexador</Label>
              <Select
                value={form.indexador}
                onValueChange={(v) => setForm((p) => ({ ...p, indexador: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDEXADORES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* % do Indexador */}
          {form.indexador !== "Prefixado" && (
            <div>
              <Label>% do Indexador</Label>
              <Input
                type="number"
                step="1"
                value={form.percentual_indexador}
                onChange={(e) =>
                  setForm((p) => ({ ...p, percentual_indexador: e.target.value }))
                }
                placeholder="100"
              />
            </div>
          )}

          {/* Data Vencimento */}
          <div>
            <Label>Data de Vencimento</Label>
            <Input
              type="date"
              value={form.data_vencimento}
              onChange={(e) =>
                setForm((p) => ({ ...p, data_vencimento: e.target.value }))
              }
            />
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="resgatado">Resgatado</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notas */}
          <div>
            <Label>Notas</Label>
            <Textarea
              value={form.notas}
              onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
              placeholder='Ex: "CDB a juros fixos, renovável"'
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar e Vincular
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
