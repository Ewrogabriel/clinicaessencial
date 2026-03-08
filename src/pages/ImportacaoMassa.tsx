import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Users, Calendar, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

type ImportType = "pacientes" | "agendamentos" | "pagamentos";

interface ImportRow {
  [key: string]: any;
}

const REQUIRED_FIELDS: Record<ImportType, string[]> = {
  pacientes: ["nome", "telefone"],
  agendamentos: ["paciente_nome", "data_horario", "profissional_nome"],
  pagamentos: ["paciente_nome", "valor", "data_pagamento"],
};

const EXAMPLE_HEADERS: Record<ImportType, string[]> = {
  pacientes: ["nome", "telefone", "email", "cpf", "data_nascimento", "tipo_atendimento", "observacoes"],
  agendamentos: ["paciente_nome", "profissional_nome", "data_horario", "duracao_minutos", "tipo_atendimento", "observacoes"],
  pagamentos: ["paciente_nome", "valor", "data_pagamento", "forma_pagamento", "descricao", "status"],
};

const ImportacaoMassa = () => {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ImportType>("pacientes");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "" });

        if (json.length === 0) {
          setErrors(["Arquivo vazio ou sem dados."]);
          return;
        }

        // Validate required fields
        const missing = REQUIRED_FIELDS[activeTab].filter(f => !(f in json[0]));
        if (missing.length > 0) {
          setErrors([`Colunas obrigatórias ausentes: ${missing.join(", ")}`]);
          return;
        }

        setRows(json);
        toast({ title: `${json.length} registro(s) carregados para revisão.` });
      } catch (err: any) {
        setErrors(["Erro ao ler arquivo: " + err.message]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!user || rows.length === 0) return;
    setImporting(true);
    setErrors([]);
    let success = 0;
    let errorCount = 0;
    const importErrors: string[] = [];

    if (activeTab === "pacientes") {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const { error } = await (supabase.from("pacientes") as any).insert({
            nome: String(row.nome).trim(),
            telefone: String(row.telefone).trim(),
            email: row.email ? String(row.email).trim() : null,
            cpf: row.cpf ? String(row.cpf).trim() : null,
            data_nascimento: row.data_nascimento || null,
            tipo_atendimento: row.tipo_atendimento || "fisioterapia",
            observacoes: row.observacoes || null,
            created_by: user.id,
            status: "ativo",
          });
          if (error) throw error;

          // Link to clinic
          if (activeClinicId) {
            const { data: inserted } = await (supabase.from("pacientes") as any)
              .select("id").eq("nome", String(row.nome).trim()).eq("telefone", String(row.telefone).trim())
              .order("created_at", { ascending: false }).limit(1).single();
            if (inserted) {
              await (supabase.from("clinic_pacientes") as any).insert({
                clinic_id: activeClinicId,
                paciente_id: inserted.id,
              });
            }
          }
          success++;
        } catch (err: any) {
          errorCount++;
          importErrors.push(`Linha ${i + 2}: ${err.message}`);
        }
      }
    } else if (activeTab === "agendamentos") {
      // Fetch pacientes and profissionais maps
      const { data: pacientes } = await (supabase.from("pacientes").select("id, nome") as any);
      const { data: profs } = await supabase.from("profiles").select("user_id, nome");
      const pacMap = Object.fromEntries((pacientes || []).map((p: any) => [p.nome.toLowerCase(), p.id]));
      const profMap = Object.fromEntries((profs || []).map((p: any) => [p.nome.toLowerCase(), p.user_id]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const pacId = pacMap[String(row.paciente_nome).toLowerCase().trim()];
          const profId = profMap[String(row.profissional_nome).toLowerCase().trim()];
          if (!pacId) throw new Error(`Paciente "${row.paciente_nome}" não encontrado`);
          if (!profId) throw new Error(`Profissional "${row.profissional_nome}" não encontrado`);

          const { error } = await (supabase.from("agendamentos") as any).insert({
            paciente_id: pacId,
            profissional_id: profId,
            data_horario: new Date(row.data_horario).toISOString(),
            duracao_minutos: row.duracao_minutos ? Number(row.duracao_minutos) : 50,
            tipo_atendimento: row.tipo_atendimento || "fisioterapia",
            observacoes: row.observacoes || null,
            created_by: user.id,
            status: "agendado",
            clinic_id: activeClinicId,
          });
          if (error) throw error;
          success++;
        } catch (err: any) {
          errorCount++;
          importErrors.push(`Linha ${i + 2}: ${err.message}`);
        }
      }
    } else if (activeTab === "pagamentos") {
      const { data: pacientes } = await (supabase.from("pacientes").select("id, nome") as any);
      const pacMap = Object.fromEntries((pacientes || []).map((p: any) => [p.nome.toLowerCase(), p.id]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const pacId = pacMap[String(row.paciente_nome).toLowerCase().trim()];
          if (!pacId) throw new Error(`Paciente "${row.paciente_nome}" não encontrado`);

          const { error } = await (supabase.from("pagamentos") as any).insert({
            paciente_id: pacId,
            profissional_id: user.id,
            valor: Number(row.valor),
            data_pagamento: row.data_pagamento ? new Date(row.data_pagamento).toISOString() : new Date().toISOString(),
            forma_pagamento: row.forma_pagamento || null,
            descricao: row.descricao || "Importado via planilha",
            status: row.status || "pago",
            created_by: user.id,
          });
          if (error) throw error;
          success++;
        } catch (err: any) {
          errorCount++;
          importErrors.push(`Linha ${i + 2}: ${err.message}`);
        }
      }
    }

    setResult({ success, errors: errorCount });
    if (importErrors.length > 0) setErrors(importErrors.slice(0, 20));
    setRows([]);
    setImporting(false);
    queryClient.invalidateQueries();
    if (success > 0) toast({ title: `${success} registro(s) importados com sucesso!` });
  };

  const downloadTemplate = () => {
    const headers = EXAMPLE_HEADERS[activeTab];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, `modelo_${activeTab}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Importação em Massa</h1>
        <p className="text-muted-foreground">Importe pacientes, agendamentos e pagamentos via planilha</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ImportType); setRows([]); setErrors([]); setResult(null); }}>
        <TabsList>
          <TabsTrigger value="pacientes" className="gap-2">
            <Users className="h-4 w-4" /> Pacientes
          </TabsTrigger>
          <TabsTrigger value="agendamentos" className="gap-2">
            <Calendar className="h-4 w-4" /> Agendamentos
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-2">
            <DollarSign className="h-4 w-4" /> Pagamentos
          </TabsTrigger>
        </TabsList>

        {["pacientes", "agendamentos", "pagamentos"].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Importar {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </CardTitle>
                <CardDescription>
                  Colunas obrigatórias: <strong>{REQUIRED_FIELDS[tab as ImportType].join(", ")}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Baixar Modelo Excel
                  </Button>
                  <div>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="max-w-xs"
                    />
                  </div>
                </div>

                {rows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-sm">
                        {rows.length} registro(s) prontos para importar
                      </Badge>
                      <Button onClick={handleImport} disabled={importing}>
                        {importing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {importing ? "Importando..." : "Importar Agora"}
                      </Button>
                    </div>

                    {/* Preview table */}
                    <div className="border rounded-lg overflow-auto max-h-[300px]">
                      <table className="w-full text-xs">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left">#</th>
                            {Object.keys(rows[0]).map((key) => (
                              <th key={key} className="p-2 text-left font-medium">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 10).map((row, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2 text-muted-foreground">{i + 1}</td>
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="p-2 max-w-[200px] truncate">{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {rows.length > 10 && (
                        <p className="text-xs text-muted-foreground p-2 text-center">
                          Mostrando 10 de {rows.length} registros...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {result && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Check className="h-5 w-5 text-primary" />
                    <span className="text-sm">
                      <strong>{result.success}</strong> importados com sucesso
                      {result.errors > 0 && <>, <strong className="text-destructive">{result.errors}</strong> com erro</>}
                    </span>
                  </div>
                )}

                {errors.length > 0 && (
                  <div className="space-y-1 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                      <AlertCircle className="h-4 w-4" />
                      Erros ({errors.length})
                    </div>
                    {errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive/80">{err}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ImportacaoMassa;