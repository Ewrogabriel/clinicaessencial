import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Download, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAuditLogs, AuditLog } from "@/modules/master/services/masterService";
import { format, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  INSERT: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  SELECT: "outline",
};

function exportToCsv(logs: AuditLog[]) {
  const headers = ["ID", "Data", "Usuário", "Ação", "Tabela", "Registro"];
  const rows = logs.map((l) => [
    l.id,
    l.created_at,
    l.user_id ?? "",
    l.action,
    l.table_name ?? "",
    l.record_id ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_logs_${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs"],
    queryFn: () => getAuditLogs(500),
    staleTime: 60 * 1000,
  });

  const tables = useMemo(
    () => ["all", ...Array.from(new Set(logs.map((l) => l.table_name ?? "").filter(Boolean)))],
    [logs],
  );
  const actions = useMemo(
    () => ["all", ...Array.from(new Set(logs.map((l) => l.action).filter(Boolean)))],
    [logs],
  );

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return logs.filter((l) => {
      const matchSearch =
        !search ||
        l.action.toLowerCase().includes(lower) ||
        (l.table_name ?? "").toLowerCase().includes(lower) ||
        (l.user_id ?? "").includes(lower) ||
        (l.record_id ?? "").includes(lower);
      const matchAction = actionFilter === "all" || l.action === actionFilter;
      const matchTable = tableFilter === "all" || l.table_name === tableFilter;
      const matchFrom = !dateFrom || new Date(l.created_at) >= new Date(dateFrom);
      const matchTo = !dateTo || new Date(l.created_at) <= endOfDay(new Date(dateTo));
      return matchSearch && matchAction && matchTable && matchFrom && matchTo;
    });
  }, [logs, search, actionFilter, tableFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Logs de Auditoria</h1>
            <p className="text-muted-foreground text-sm">
              Histórico de todas as ações na plataforma
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => exportToCsv(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === "all" ? "Todas as ações" : a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "all" ? "Todas as tabelas" : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1"
              title="De"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1"
              title="Até"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-10 text-center text-muted-foreground text-sm">Carregando logs…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANT[log.action] ?? "outline"}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.table_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[120px] truncate">
                        {log.record_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[120px] truncate">
                        {log.user_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(log.old_values || log.new_values) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDetail(log)}
                          >
                            Ver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-10"
                      >
                        Nenhum log encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {filtered.length > 200 && (
            <p className="text-xs text-center text-muted-foreground py-2">
              Exibindo 200 de {filtered.length} resultados. Use os filtros para refinar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
            <DialogDescription>
              {detail &&
                format(new Date(detail.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Ação</p>
                  <Badge variant={ACTION_VARIANT[detail.action] ?? "outline"}>
                    {detail.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tabela</p>
                  <p>{detail.table_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Registro</p>
                  <p className="font-mono text-xs">{detail.record_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Usuário</p>
                  <p className="font-mono text-xs">{detail.user_id ?? "—"}</p>
                </div>
              </div>
              {detail.old_values && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Valores anteriores</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-auto">
                    {JSON.stringify(detail.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {detail.new_values && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Novos valores</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-auto">
                    {JSON.stringify(detail.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
