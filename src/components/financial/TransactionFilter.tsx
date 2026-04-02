import { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import type { ReconciliationFilters } from "@/modules/finance/services/reconciliationService";

interface TransactionFilterProps {
  filters: ReconciliationFilters;
  onChange: (filters: ReconciliationFilters) => void;
}

export function TransactionFilter({
  filters,
  onChange,
}: TransactionFilterProps) {
  const [search, setSearch] = useState(filters.pacienteSearch ?? "");

  const update = (partial: Partial<ReconciliationFilters>) => {
    onChange({ ...filters, ...partial });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    // Debounce: update parent after brief pause
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      update({ pacienteSearch: value });
    }, 300);
  };

  const reset = () => {
    setSearch("");
    onChange({});
  };

  const hasFilters =
    filters.dateFrom ||
    filters.dateTo ||
    (filters.status && filters.status !== "all") ||
    (filters.paymentMethod && filters.paymentMethod !== "all") ||
    filters.pacienteSearch;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {/* Date from */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => update({ dateFrom: e.target.value || undefined })}
              className="h-8 text-sm"
            />
          </div>

          {/* Date to */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => update({ dateTo: e.target.value || undefined })}
              className="h-8 text-sm"
            />
          </div>

          {/* Payment method */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Forma de Pagamento
            </Label>
            <Select
              value={filters.paymentMethod ?? "all"}
              onValueChange={(v) =>
                update({ paymentMethod: v === "all" ? undefined : v })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) =>
                update({ status: v === "all" ? undefined : v })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Patient search */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Descrição..."
                className="h-8 text-sm pl-7"
              />
            </div>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="h-7 gap-1 text-xs text-muted-foreground"
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
