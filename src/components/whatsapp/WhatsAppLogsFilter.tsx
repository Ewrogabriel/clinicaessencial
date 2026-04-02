import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { LogFilters } from "@/modules/whatsapp/services/whatsappLogsService";

interface WhatsAppLogsFilterProps {
  filters: LogFilters;
  onChange: (filters: LogFilters) => void;
}

export function WhatsAppLogsFilter({ filters, onChange }: WhatsAppLogsFilterProps) {
  const [patientSearch, setPatientSearch] = useState(filters.patientSearch ?? "");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (partial: Partial<LogFilters>) => {
    onChange({ ...filters, ...partial });
  };

  const handlePatientSearch = (value: string) => {
    setPatientSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      update({ patientSearch: value });
    }, 300);
  };

  const reset = () => {
    setPatientSearch("");
    onChange({ messageType: "all", status: "all", patientSearch: "", errorsOnly: false });
  };

  const hasActiveFilters =
    (filters.messageType && filters.messageType !== "all") ||
    (filters.status && filters.status !== "all") ||
    filters.patientSearch ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.errorsOnly;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {/* Tipo de mensagem */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select
              value={filters.messageType ?? "all"}
              onValueChange={(v) => update({ messageType: v as LogFilters["messageType"] })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="session_confirmation">Confirmação de Sessão</SelectItem>
                <SelectItem value="monthly_reminder">Lembrete de Mensalidade</SelectItem>
                <SelectItem value="overdue_alert">Alerta de Atraso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) => update({ status: v as LogFilters["status"] })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="read">Lido</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Paciente */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Paciente / Telefone</Label>
            <Input
              className="h-9"
              placeholder="Buscar..."
              value={patientSearch}
              onChange={(e) => handlePatientSearch(e.target.value)}
            />
          </div>

          {/* De */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              className="h-9"
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => update({ dateFrom: e.target.value || undefined })}
            />
          </div>

          {/* Até */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              className="h-9"
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => update({ dateTo: e.target.value || undefined })}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="errorsOnly"
              checked={filters.errorsOnly ?? false}
              onCheckedChange={(v) => update({ errorsOnly: v })}
            />
            <Label htmlFor="errorsOnly" className="text-sm cursor-pointer">
              Mostrar apenas erros
            </Label>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={reset} className="h-8 gap-1 text-xs">
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
