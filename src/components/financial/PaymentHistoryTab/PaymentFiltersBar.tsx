import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterState } from "./types";

interface PaymentFiltersBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function PaymentFiltersBar({
  filters,
  onChange,
  hasActiveFilters,
  onClearFilters,
}: PaymentFiltersBarProps) {
  const periodOptions = useMemo(() => {
    const options = [{ value: "todos", label: "Todos os períodos" }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = format(d, "yyyy-MM");
      const label = format(d, "MMMM/yyyy", { locale: ptBR });
      options.push({
        value,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      });
    }
    return options;
  }, []);

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição..."
                className="pl-8"
                value={filters.searchText}
                onChange={(e) => onChange({ ...filters, searchText: e.target.value })}
              />
            </div>
          </div>

          <Select
            value={filters.filterPeriodo}
            onValueChange={(v) => onChange({ ...filters, filterPeriodo: v })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ultimos3">Últimos 3 meses</SelectItem>
              {periodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.filterStatus}
            onValueChange={(v) => onChange({ ...filters, filterStatus: v })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aberto">Em Aberto</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="nao_iniciado">Não Pago</SelectItem>
              <SelectItem value="parcialmente_pago">Parcialmente Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
              <SelectItem value="reembolsado">Reembolsado</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.filterTipo}
            onValueChange={(v) => onChange({ ...filters, filterTipo: v })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              <SelectItem value="matricula">Matrícula</SelectItem>
              <SelectItem value="mensalidade">Mensalidade</SelectItem>
              <SelectItem value="plano">Plano / Pacote</SelectItem>
              <SelectItem value="sessao_avulsa">Sessão Avulsa</SelectItem>
              <SelectItem value="manual">Pagamento Manual</SelectItem>
              <SelectItem value="ajuste">Ajuste</SelectItem>
              <SelectItem value="reembolso">Reembolso</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="gap-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
