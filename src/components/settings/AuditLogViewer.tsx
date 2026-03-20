import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Search } from "lucide-react";

const acaoColors: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function AuditLogViewer() {
  const [filterTable, setFilterTable] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", filterTable, filterAction],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterTable !== "all") query = query.eq("tabela", filterTable);
      if (filterAction !== "all") query = query.eq("acao", filterAction);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filteredLogs = (logs as any[]).filter((log: any) => {
    if (!search) return true;
    const str = JSON.stringify(log).toLowerCase();
    return str.includes(search.toLowerCase());
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Registro de Alterações (Audit Trail)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={filterTable} onValueChange={setFilterTable}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tabelas</SelectItem>
              <SelectItem value="agendamentos">Agendamentos</SelectItem>
              <SelectItem value="pacientes">Pacientes</SelectItem>
              <SelectItem value="pagamentos">Pagamentos</SelectItem>
              <SelectItem value="matriculas">Matrículas</SelectItem>
              <SelectItem value="profiles">Profissionais</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              <SelectItem value="INSERT">Criação</SelectItem>
              <SelectItem value="UPDATE">Atualização</SelectItem>
              <SelectItem value="DELETE">Exclusão</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nos registros..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Carregando logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhum registro encontrado.
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredLogs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card text-sm">
                <Badge className={`text-[10px] shrink-0 ${acaoColors[log.acao] || ""}`}>
                  {log.acao}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium capitalize">{log.tabela}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                  {log.acao === "UPDATE" && log.dados_anteriores && log.dados_novos && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {getChangedFields(log.dados_anteriores, log.dados_novos)}
                    </div>
                  )}
                  {log.acao === "DELETE" && (
                    <div className="mt-1 text-xs text-destructive">Registro removido</div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {log.registro_id?.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getChangedFields(old: any, newData: any): string {
  const changes: string[] = [];
  const ignore = ["updated_at", "created_at"];
  for (const key of Object.keys(newData)) {
    if (ignore.includes(key)) continue;
    if (JSON.stringify(old[key]) !== JSON.stringify(newData[key])) {
      changes.push(key);
    }
  }
  return changes.length > 0 ? `Campos alterados: ${changes.join(", ")}` : "Sem alterações visíveis";
}
