import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Database, HardDrive, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const EXPORT_TABLES = [
  { key: "pacientes", label: "Pacientes", icon: "👤" },
  { key: "agendamentos", label: "Agendamentos", icon: "📅" },
  { key: "pagamentos", label: "Pagamentos", icon: "💰" },
  { key: "matriculas", label: "Matrículas", icon: "📋" },
  { key: "profiles", label: "Profissionais", icon: "👨‍⚕️" },
  { key: "audit_logs", label: "Logs de Auditoria", icon: "🔒" },
];

export function BackupExport() {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportTable = async (table: string) => {
    setExporting(table);
    try {
      const { data, error } = await (supabase.from(table as any) as any).select("*");
      if (error) throw error;
      if (!data?.length) {
        toast({ title: "Tabela vazia", description: `Nenhum dado encontrado em ${table}.` });
        return;
      }

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(","),
        ...data.map((row: any) =>
          headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            const str = typeof val === "object" ? JSON.stringify(val) : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          }).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${table}_backup_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Exportação concluída! ✅", description: `${data.length} registros exportados de ${table}.` });
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const exportAll = async () => {
    for (const t of EXPORT_TABLES) {
      await exportTable(t.key);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Backup e Exportação de Dados
          </CardTitle>
          <CardDescription>
            Exporte os dados da clínica em formato CSV para backup ou migração.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXPORT_TABLES.map((t) => (
              <Button
                key={t.key}
                variant="outline"
                className="justify-start gap-3 h-auto py-3"
                disabled={exporting !== null}
                onClick={() => exportTable(t.key)}
              >
                <span className="text-lg">{t.icon}</span>
                <div className="text-left">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">Exportar CSV</div>
                </div>
                {exporting === t.key ? (
                  <Badge variant="secondary" className="ml-auto text-[10px]">Exportando...</Badge>
                ) : (
                  <Download className="h-4 w-4 ml-auto text-muted-foreground" />
                )}
              </Button>
            ))}
          </div>
          <Button onClick={exportAll} className="w-full gap-2" disabled={exporting !== null}>
            <HardDrive className="h-4 w-4" />
            Exportar Tudo
          </Button>
        </CardContent>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Boas Práticas de Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p><strong>Frequência:</strong> Exporte seus dados pelo menos 1x por semana.</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p><strong>Armazenamento:</strong> Salve os arquivos em um local seguro (Google Drive, nuvem, HD externo).</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p><strong>Versionamento:</strong> Mantenha versões por data para poder voltar a qualquer ponto.</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p><strong>Auditoria:</strong> Use a aba "Logs" para verificar quem alterou dados críticos.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
