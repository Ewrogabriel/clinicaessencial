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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Link2 } from "lucide-react";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import { useInvestmentSuggestions } from "@/modules/finance/hooks/useInvestmentReconciliation";
import type { Investment } from "@/modules/finance/services/investmentReconciliationService";
import type { InvestmentMovementType } from "@/modules/finance/services/investmentDetectionService";
import { format } from "date-fns";

const MOVEMENT_TYPE_OPTIONS: { value: InvestmentMovementType; label: string }[] = [
  { value: "aplicacao", label: "Aplicação inicial" },
  { value: "aporte", label: "Aporte adicional" },
  { value: "resgate", label: "Resgate" },
  { value: "rendimento", label: "Rendimento/Juros" },
  { value: "taxa", label: "Taxa de administração" },
  { value: "dividendo", label: "Dividendo/JCP" },
];

interface LinkInvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  transactionValue: number;
  defaultMovementType?: InvestmentMovementType;
  onConfirm: (investimentoId: string, movementType: InvestmentMovementType) => void;
  isLoading?: boolean;
}

export function LinkInvestmentDialog({
  open,
  onOpenChange,
  clinicId,
  transactionValue,
  defaultMovementType = "aplicacao",
  onConfirm,
  isLoading,
}: LinkInvestmentDialogProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Investment | null>(null);
  const [movementType, setMovementType] =
    useState<InvestmentMovementType>(defaultMovementType);

  const { data: results = [], isLoading: isSearching } = useInvestmentSuggestions(
    clinicId,
    query
  );

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected.id, movementType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            Vincular a Investimento Existente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div>
            <Label>Buscar investimento</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Nome, tipo ou instituição..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
              />
            </div>
          </div>

          {/* Results */}
          {query.length > 0 && (
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {isSearching ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum investimento encontrado
                </p>
              ) : (
                results.map((inv) => (
                  <div
                    key={inv.id}
                    className={`px-3 py-2 cursor-pointer hover:bg-accent transition-colors ${
                      selected?.id === inv.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelected(inv)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{inv.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.tipo}
                          {inv.instituicao ? ` • ${inv.instituicao}` : ""}
                          {" • "}
                          {formatBRL(Number(inv.valor_aplicado))}
                        </p>
                        {inv.data_vencimento && (
                          <p className="text-xs text-muted-foreground">
                            Venc:{" "}
                            {format(new Date(inv.data_vencimento), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          inv.status === "ativo"
                            ? "border-green-400 text-green-700"
                            : "border-gray-400 text-gray-600"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Selected */}
          {selected && (
            <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm space-y-1">
              <p className="font-medium text-blue-800">Selecionado: {selected.nome}</p>
              <p className="text-blue-700">
                {selected.tipo} • {formatBRL(Number(selected.valor_aplicado))}
              </p>
            </div>
          )}

          {/* Movement type */}
          <div>
            <Label>Tipo de movimentação</Label>
            <Select
              value={movementType}
              onValueChange={(v) => setMovementType(v as InvestmentMovementType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button onClick={handleConfirm} disabled={!selected || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vincular
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
