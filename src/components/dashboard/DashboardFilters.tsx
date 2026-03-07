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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Filter, X, Download } from "lucide-react";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface FilterState {
  periodo: "7d" | "30d" | "90d" | "mes" | "custom";
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  profissionalId: string;
  modalidade: string;
  status: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface DashboardFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  profissionais?: FilterOption[];
  modalidades?: FilterOption[];
  statusOptions?: FilterOption[];
  showProfissional?: boolean;
  showModalidade?: boolean;
  showStatus?: boolean;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

const PERIODO_OPTIONS = [
  { value: "7d", label: "Ultimos 7 dias" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "90d", label: "Ultimos 90 dias" },
  { value: "mes", label: "Este mes" },
  { value: "custom", label: "Personalizado" },
];

export function DashboardFilters({
  filters,
  onFiltersChange,
  profissionais = [],
  modalidades = [],
  statusOptions = [],
  showProfissional = true,
  showModalidade = true,
  showStatus = false,
  onExportCSV,
  onExportPDF,
}: DashboardFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePeriodoChange = (periodo: FilterState["periodo"]) => {
    const now = new Date();
    let dataInicio: Date | undefined;
    let dataFim: Date | undefined = now;

    switch (periodo) {
      case "7d":
        dataInicio = subDays(now, 7);
        break;
      case "30d":
        dataInicio = subDays(now, 30);
        break;
      case "90d":
        dataInicio = subDays(now, 90);
        break;
      case "mes":
        dataInicio = startOfMonth(now);
        dataFim = endOfMonth(now);
        break;
      case "custom":
        dataInicio = filters.dataInicio;
        dataFim = filters.dataFim;
        break;
    }

    onFiltersChange({
      ...filters,
      periodo,
      dataInicio,
      dataFim,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      periodo: "30d",
      dataInicio: subDays(new Date(), 30),
      dataFim: new Date(),
      profissionalId: "all",
      modalidade: "all",
      status: "all",
    });
  };

  const activeFiltersCount = [
    filters.profissionalId !== "all",
    filters.modalidade !== "all",
    filters.status !== "all",
    filters.periodo === "custom",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Periodo Quick Select */}
      <div className="flex items-center gap-2">
        {PERIODO_OPTIONS.slice(0, 4).map((opt) => (
          <Button
            key={opt.value}
            variant={filters.periodo === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => handlePeriodoChange(opt.value as FilterState["periodo"])}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Custom Date Range */}
      {filters.periodo === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !filters.dataInicio && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dataInicio
                  ? format(filters.dataInicio, "dd/MM/yyyy")
                  : "Data inicio"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dataInicio}
                onSelect={(date) =>
                  onFiltersChange({ ...filters, dataInicio: date })
                }
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">ate</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !filters.dataFim && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dataFim
                  ? format(filters.dataFim, "dd/MM/yyyy")
                  : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dataFim}
                onSelect={(date) =>
                  onFiltersChange({ ...filters, dataFim: date })
                }
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Advanced Filters Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filtros Avancados</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 px-2 text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>

            {showProfissional && profissionais.length > 0 && (
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select
                  value={filters.profissionalId}
                  onValueChange={(value) =>
                    onFiltersChange({ ...filters, profissionalId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {profissionais.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showModalidade && modalidades.length > 0 && (
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select
                  value={filters.modalidade}
                  onValueChange={(value) =>
                    onFiltersChange({ ...filters, modalidade: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {modalidades.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showStatus && statusOptions.length > 0 && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    onFiltersChange({ ...filters, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              className="w-full"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Aplicar Filtros
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Export Buttons */}
      {(onExportCSV || onExportPDF) && (
        <div className="flex items-center gap-2 ml-auto">
          {onExportCSV && (
            <Button variant="outline" size="sm" onClick={onExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          )}
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF}>
              <Download className="h-4 w-4 mr-1" />
              PDF
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook para gerenciar estado de filtros
 */
export function useFilters(initialFilters?: Partial<FilterState>): {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  getDateRange: () => { start: Date; end: Date };
} {
  const defaultFilters: FilterState = {
    periodo: "30d",
    dataInicio: subDays(new Date(), 30),
    dataFim: new Date(),
    profissionalId: "all",
    modalidade: "all",
    status: "all",
    ...initialFilters,
  };

  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const getDateRange = () => ({
    start: filters.dataInicio || subDays(new Date(), 30),
    end: filters.dataFim || new Date(),
  });

  return { filters, setFilters, getDateRange };
}
