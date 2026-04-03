import { useState } from "react";
import { Search, X, Filter, ChevronDown } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

export interface AdvancedFilters {
  search: string;
  tipo: string;
  status: string;
  dataInicio: string;
  dataFim: string;
  conta: string;
  anomalyType: string;
  daysUnreconciled: string;
  minScore: string;
}

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  search: "",
  tipo: "todos",
  status: "todos",
  dataInicio: "",
  dataFim: "",
  conta: "todos",
  anomalyType: "todos",
  daysUnreconciled: "todos",
  minScore: "",
};

interface AdvancedFiltersPanelProps {
  filters: AdvancedFilters;
  onChange: (filters: AdvancedFilters) => void;
  accounts: Array<{ id: string; banco_nome: string; apelido?: string | null }>;
}

function countActiveFilters(filters: AdvancedFilters): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.tipo !== "todos") count++;
  if (filters.status !== "todos") count++;
  if (filters.dataInicio) count++;
  if (filters.dataFim) count++;
  if (filters.conta !== "todos") count++;
  if (filters.anomalyType !== "todos") count++;
  if (filters.daysUnreconciled !== "todos") count++;
  if (filters.minScore) count++;
  return count;
}

export function AdvancedFiltersPanel({
  filters,
  onChange,
  accounts,
}: AdvancedFiltersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const update = (field: keyof AdvancedFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  const reset = () => onChange(DEFAULT_ADVANCED_FILTERS);

  return (
    <div className="space-y-3">
      {/* Quick search always visible */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, CPF, documento..."
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filters.status} onValueChange={(v) => update("status", v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="conciliado">Conciliadas</SelectItem>
            <SelectItem value="rejeitado">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros avançados
              {activeCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1 text-xs">
                  {activeCount}
                </Badge>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
            <X className="h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      {/* Advanced filters collapsible */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={filters.tipo} onValueChange={(v) => update("tipo", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Data início</Label>
              <Input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => update("dataInicio", e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Data fim</Label>
              <Input
                type="date"
                value={filters.dataFim}
                onChange={(e) => update("dataFim", e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Conta bancária</Label>
              <Select value={filters.conta} onValueChange={(v) => update("conta", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as contas</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.apelido || acc.banco_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Tipo de anomalia</Label>
              <Select value={filters.anomalyType} onValueChange={(v) => update("anomalyType", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="duplicate">Duplicadas</SelectItem>
                  <SelectItem value="orphan">Órfãs</SelectItem>
                  <SelectItem value="discrepancy">Discrepâncias</SelectItem>
                  <SelectItem value="unreconciled">Pendentes longa data</SelectItem>
                  <SelectItem value="negative">Reembolsos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Dias sem conciliar</Label>
              <Select value={filters.daysUnreconciled} onValueChange={(v) => update("daysUnreconciled", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Qualquer</SelectItem>
                  <SelectItem value="30">{">"} 30 dias</SelectItem>
                  <SelectItem value="60">{">"} 60 dias</SelectItem>
                  <SelectItem value="90">{">"} 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
