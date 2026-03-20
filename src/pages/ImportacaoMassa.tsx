import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/modules/shared/hooks/use-toast";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Users, Calendar, DollarSign, Sparkles, ArrowRight, RotateCcw, ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import { format } from "date-fns";

type ImportType = "pacientes" | "agendamentos" | "pagamentos";
type Step = "upload" | "mapping" | "preview" | "result";

interface ImportRow {
  [key: string]: any;
}

interface ImportResult {
  success: number;
  errors: number;
  batchId: string;
  timestamp: Date;
}

const REQUIRED_FIELDS: Record<ImportType, string[]> = {
  pacientes: ["nome", "telefone"],
  agendamentos: ["paciente_nome", "data_horario", "profissional_nome"],
  pagamentos: ["paciente_nome", "valor", "data_pagamento"],
};

const EXAMPLE_HEADERS: Record<ImportType, string[]> = {
  pacientes: ["nome", "telefone", "email", "cpf", "data_nascimento", "tipo_atendimento", "observacoes", "cep", "rua", "numero", "bairro", "cidade", "estado", "complemento"],
  agendamentos: ["paciente_nome", "profissional_nome", "data_horario", "duracao_minutos", "tipo_atendimento", "observacoes"],
  pagamentos: ["paciente_nome", "valor", "data_pagamento", "forma_pagamento", "descricao", "status"],
};

function generateAccessCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

interface CEPData {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ddd?: string;
}

// Validate CEP via ViaCEP API
async function validateCEP(cep: string): Promise<CEPData | null> {
  if (!cep || String(cep).trim().length === 0) return null;
  
  const cleanCEP = String(cep).replace(/\D/g, "");
  if (cleanCEP.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const data = await response.json();
    
    if (data.erro) return null; // CEP not found
    
    return {
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      localidade: data.localidade || "",
      uf: data.uf || "",
      ddd: data.ddd || "",
    };
  } catch (error) {
    console.error("CEP validation error:", error);
    return null;
  }
}

// Enrich row with address data from CEP
async function enrichRowWithCEP(row: ImportRow): Promise<ImportRow> {
  if (!row.cep || !String(row.cep).trim()) return row;
  
  const cepData = await validateCEP(row.cep);
  if (!cepData) return row;
  
  // Only fill if not already provided
  return {
    ...row,
    rua: row.rua || cepData.logradouro,
    bairro: row.bairro || cepData.bairro,
    cidade: row.cidade || cepData.localidade,
    estado: row.estado || cepData.uf,
  };
}

const ImportacaoMassa = () => {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ImportType>("pacientes");
  const [step, setStep] = useState<Step>("upload");
  const [rawRows, setRawRows] = useState<ImportRow[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileFormat, setFileFormat] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const resetState = () => {
    setStep("upload");
    setRawRows([]);
    setFileHeaders([]);
    setMapping({});
    setRows([]);
    setFileName("");
    setFileFormat("");
    setErrors([]);
    setResult(null);
  };

  // --- Step 1: Parse file ---
  const parseFile = (file: File): Promise<ImportRow[]> => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      setFileName(file.name);

      if (ext === "json") {
        setFileFormat("json");
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const text = evt.target?.result as string;
            const parsed = JSON.parse(text);
            const data = Array.isArray(parsed) ? parsed : parsed.data || parsed.rows || parsed.pacientes || [];
            if (!Array.isArray(data) || data.length === 0) {
              reject(new Error("JSON inválido ou sem dados. Esperado array de objetos."));
              return;
            }
            resolve(data);
          } catch (e: any) {
            reject(new Error("Erro ao parsear JSON: " + e.message));
          }
        };
        reader.readAsText(file);
      } else {
        setFileFormat(ext === "csv" ? "csv" : "xlsx");
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "" });
            if (json.length === 0) {
              reject(new Error("Arquivo vazio ou sem dados."));
              return;
            }
            resolve(json);
          } catch (e: any) {
            reject(new Error("Erro ao ler arquivo: " + e.message));
          }
        };
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetState();
    setFileName(file.name);

    try {
      const data = await parseFile(file);
      setRawRows(data);
      const headers = Object.keys(data[0] || {});
      setFileHeaders(headers);

      // Auto-map columns by name similarity
      const autoMap: Record<string, string> = {};
      const expected = EXAMPLE_HEADERS[activeTab];
      for (const expectedField of expected) {
        const match = headers.find(
          (h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === expectedField.toLowerCase().replace(/[^a-z0-9]/g, "")
            || h.toLowerCase().includes(expectedField.toLowerCase().split("_")[0])
        );
        if (match) autoMap[expectedField] = match;
      }
      setMapping(autoMap);
      setStep("mapping");
      toast({ title: `${data.length} registro(s) carregados. Configure o mapeamento de colunas.` });
    } catch (err: any) {
      setErrors([err.message]);
    }
  };

  // --- Step 2: Apply mapping to produce normalized rows ---
  const applyMapping = () => {
    const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));
    const normalized = rawRows.map((row) => {
      const out: ImportRow = {};
      for (const [field, header] of Object.entries(mapping)) {
        if (header) out[field] = row[header] ?? "";
      }
      // Keep columns that were not mapped (using original key) without overwriting mapped fields
      for (const [k, v] of Object.entries(row)) {
        if (!mappedHeaders.has(k) && !(k in out)) out[k] = v;
      }
      return out;
    });
    setRows(normalized);
    setStep("preview");
  };

  // --- AI analysis ---
  const handleAnalyzeAI = async () => {
    setAnalyzingAI(true);
    setErrors([]);
    try {
      const context: any = {
        expectedFields: EXAMPLE_HEADERS[activeTab],
        rows: (step === "mapping" ? rawRows : rows).slice(0, 50),
      };

      // Add address extraction context for patient imports
      if (activeTab === "pacientes") {
        context.extractAddressData = true;
        context.instructions = `Ao analisar dados de pacientes:
1. Procure por CEP em QUALQUER campo de texto (observações, notas, campos não estruturados)
2. Separe o endereço em componentes: rua, número, bairro, cidade, estado
3. Normalize os dados: remova acentos de campos de endereço onde necessário
4. Complete campos faltantes com base em contexto (ex: CEP → buscar cidade/estado)
5. Mapeie corretamente para: cep, rua, numero, complemento, bairro, cidade, estado`;
      }

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: "analyze_import",
          context,
        },
      });
      if (error) throw error;
      if (data && data.corrected_rows) {
        const corrected: ImportRow[] = data.corrected_rows;
        // Update mapping from the corrected rows' keys
        if (step === "mapping") {
          const newHeaders = Object.keys(corrected[0] || {});
          const autoMap: Record<string, string> = {};
          for (const f of EXAMPLE_HEADERS[activeTab]) {
            if (newHeaders.includes(f)) autoMap[f] = f;
          }
          setRawRows(corrected);
          setFileHeaders(newHeaders);
          setMapping(autoMap);
        } else {
          setRows(corrected);
        }
        toast({ title: "IA mapeou e corrigiu os dados com sucesso!" });
        if (step === "mapping") setStep("preview");
      } else {
        throw new Error("Resposta inválida da IA");
      }
    } catch (err: any) {
      setErrors(["Erro na análise por IA: " + err.message]);
    } finally {
      setAnalyzingAI(false);
    }
  };

  // --- Step 3: Import ---
  const handleImport = async () => {
    if (!user || rows.length === 0) return;
    setImporting(true);
    setErrors([]);
    let success = 0;
    let errorCount = 0;
    const importErrors: string[] = [];
    const batchId = crypto.randomUUID();

    const required = REQUIRED_FIELDS[activeTab];
    const firstRow = rows[0];
    const missing = required.filter(
      (f) =>
        !(f in firstRow) &&
        !Object.keys(firstRow).some((k) => k.toLowerCase().includes(f.toLowerCase()))
    );
    if (missing.length > 0) {
      setErrors([
        `Colunas obrigatórias ausentes: ${missing.join(", ")}. Use "Corrigir com IA" ou ajuste o mapeamento.`,
      ]);
      setImporting(false);
      return;
    }

    if (activeTab === "pacientes") {
      for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        const nomeKey = Object.keys(row).find((k) => k.toLowerCase().includes("nome")) || "nome";
        const telefoneKey = Object.keys(row).find((k) => k.toLowerCase().includes("tele")) || "telefone";
        const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes("email")) || "email";
        const cpfKey = Object.keys(row).find((k) => k.toLowerCase().includes("cpf")) || "cpf";

        try {
          // Enrich with CEP data if present
          if (row.cep) {
            row = await enrichRowWithCEP(row);
          }

          const { error } = await (supabase.from("pre_cadastros") as any).insert({
            nome: String(row[nomeKey] || "").trim(),
            telefone: String(row[telefoneKey] || "").trim(),
            email: row[emailKey] ? (String(row[emailKey]).trim() || null) : null,
            cpf: row[cpfKey] ? (String(row[cpfKey]).trim() || null) : null,
            data_nascimento: row.data_nascimento || null,
            cep: row.cep || null,
            rua: row.rua || null,
            numero: row.numero || null,
            bairro: row.bairro || null,
            cidade: row.cidade || null,
            estado: row.estado || null,
            complemento: row.complemento || null,
            tipo_atendimento: row.tipo_atendimento || "fisioterapia",
            observacoes: row.observacoes || "Importado em lote",
            status: "pendente",
            clinic_id: activeClinicId,
            importacao_batch_id: batchId,
          });
          if (error) throw error;
          success++;
        } catch (err: any) {
          errorCount++;
          importErrors.push(`Linha ${i + 2}: ${err.message}`);
        }
      }
    } else if (activeTab === "agendamentos") {
      const { data: pacientes } = await supabase.from("pacientes").select("id, nome");
      const { data: profs } = await supabase.from("profiles").select("user_id, nome");
      const pacMap = Object.fromEntries((pacientes || []).map((p) => [p.nome.toLowerCase(), p.id]));
      const profMap = Object.fromEntries((profs || []).map((p: any) => [p.nome.toLowerCase(), p.user_id]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const pacId = pacMap[String(row.paciente_nome).toLowerCase().trim()];
          const profId = profMap[String(row.profissional_nome).toLowerCase().trim()];
          if (!pacId) throw new Error(`Paciente "${row.paciente_nome}" não encontrado`);
          if (!profId) throw new Error(`Profissional "${row.profissional_nome}" não encontrado`);

          const { error } = await supabase.from("agendamentos").insert({
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
      const { data: pacientes } = await supabase.from("pacientes").select("id, nome");
      const pacMap = Object.fromEntries((pacientes || []).map((p) => [p.nome.toLowerCase(), p.id]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const pacId = pacMap[String(row.paciente_nome).toLowerCase().trim()];
          if (!pacId) throw new Error(`Paciente "${row.paciente_nome}" não encontrado`);

          const { error } = await supabase.from("pagamentos").insert({
            paciente_id: pacId,
            profissional_id: user.id,
            valor: Number(row.valor),
            data_pagamento: row.data_pagamento
              ? new Date(row.data_pagamento).toISOString()
              : new Date().toISOString(),
            forma_pagamento: row.forma_pagamento || null,
            descricao: row.descricao || "Importado via planilha",
            status: row.status || "pago",
            created_by: user.id,
            clinic_id: activeClinicId,
            origem_tipo: "manual",
          });
          if (error) throw error;
          success++;
        } catch (err: any) {
          errorCount++;
          importErrors.push(`Linha ${i + 2}: ${err.message}`);
        }
      }
    }

    // Log the import
    try {
      await (supabase.from("importacao_logs") as any).insert({
        batch_id: batchId,
        clinic_id: activeClinicId,
        created_by: user.id,
        tipo: activeTab,
        formato_arquivo: fileFormat,
        total_linhas: rows.length,
        total_sucesso: success,
        total_erros: errorCount,
        erros: importErrors.length > 0 ? importErrors.slice(0, 50) : [],
        status: errorCount === 0 ? "concluido" : success > 0 ? "parcial" : "falhou",
      });
    } catch {
      // log failure is non-fatal
    }

    const importResult: ImportResult = {
      success,
      errors: errorCount,
      batchId,
      timestamp: new Date(),
    };
    setResult(importResult);
    if (importErrors.length > 0) setErrors(importErrors.slice(0, 20));
    setStep("result");
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["pre-cadastros"] });
    if (success > 0) toast({ title: `${success} registro(s) importados com sucesso!` });
  };

  const downloadTemplate = () => {
    const headers = EXAMPLE_HEADERS[activeTab];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, `modelo_${activeTab}.xlsx`);
  };

  const expectedFields = EXAMPLE_HEADERS[activeTab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Importação Inteligente</h1>
        <p className="text-muted-foreground">Importe pacientes, agendamentos e pagamentos via CSV, Excel ou JSON</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as ImportType);
          resetState();
        }}
      >
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

        {(["pacientes", "agendamentos", "pagamentos"] as ImportType[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4 mt-4">

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              {(["upload", "mapping", "preview", "result"] as Step[]).map((s, idx) => {
                const labels = ["Upload", "Mapeamento", "Pré-visualização", "Resultado"];
                const active = step === s;
                const done =
                  (s === "upload" && ["mapping", "preview", "result"].includes(step)) ||
                  (s === "mapping" && ["preview", "result"].includes(step)) ||
                  (s === "preview" && step === "result");
                return (
                  <div key={s} className="flex items-center gap-1">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : done
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? "✓" : idx + 1}
                    </span>
                    <span className={active ? "font-semibold" : "text-muted-foreground"}>{labels[idx]}</span>
                    {idx < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>

            {/* === STEP: UPLOAD === */}
            {step === "upload" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    Selecionar Arquivo
                  </CardTitle>
                  <CardDescription>
                    Formatos suportados: <strong>CSV, Excel (.xlsx/.xls), JSON</strong> — Colunas
                    obrigatórias: <strong>{REQUIRED_FIELDS[tab].join(", ")}</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" onClick={downloadTemplate}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Baixar Modelo Excel
                    </Button>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv,.json"
                      onChange={handleFileUpload}
                      className="max-w-xs"
                    />
                  </div>
                  {errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      {errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive">{e}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* === STEP: MAPPING === */}
            {step === "mapping" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    Mapeamento de Colunas
                  </CardTitle>
                  <CardDescription>
                    Arquivo: <strong>{fileName}</strong> — {rawRows.length} linha(s) detectadas. Associe cada campo esperado à coluna correspondente do seu arquivo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {expectedFields.map((field) => {
                      const isRequired = REQUIRED_FIELDS[tab].includes(field);
                      return (
                        <div key={field} className="space-y-1">
                          <label className="text-sm font-medium">
                            {field}
                            {isRequired && <span className="text-destructive ml-1">*</span>}
                          </label>
                          <Select
                            value={mapping[field] || "__none__"}
                            onValueChange={(v) =>
                              setMapping((prev) => ({ ...prev, [field]: v === "__none__" ? "" : v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar coluna..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Ignorar —</SelectItem>
                              {fileHeaders.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={resetState}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Recomeçar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleAnalyzeAI}
                      disabled={analyzingAI}
                    >
                      {analyzingAI ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {analyzingAI ? "Analisando com IA..." : "Mapear e Corrigir com IA"}
                    </Button>
                    <Button onClick={applyMapping}>
                      Confirmar Mapeamento <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                  {errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      {errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive">{e}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* === STEP: PREVIEW === */}
            {step === "preview" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Pré-visualização e Confirmação
                  </CardTitle>
                  <CardDescription>
                    <Badge variant="secondary" className="mr-2">{rows.length} registro(s)</Badge>
                    Revise os dados abaixo antes de confirmar a importação.
                    {tab === "pacientes" && " Todos irão para Pré-Cadastros (pendente de aprovação)."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preview table */}
                  <div className="border rounded-lg overflow-auto max-h-[300px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">#</th>
                          {Object.keys(rows[0] || {}).map((key) => (
                            <th key={key} className="p-2 text-left font-medium whitespace-nowrap">
                              {key}
                              {REQUIRED_FIELDS[tab].includes(key) && (
                                <span className="text-destructive ml-1">*</span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-t hover:bg-muted/30">
                            <td className="p-2 text-muted-foreground">{i + 1}</td>
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="p-2 max-w-[160px] truncate">
                                {String(val)}
                              </td>
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

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setStep("mapping")}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Voltar ao Mapeamento
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleAnalyzeAI}
                      disabled={analyzingAI || importing}
                    >
                      {analyzingAI ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {analyzingAI ? "Corrigindo com IA..." : "Corrigir com IA"}
                    </Button>
                    <Button onClick={handleImport} disabled={importing || analyzingAI}>
                      {importing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {importing ? "Importando..." : `Confirmar e Importar ${rows.length} registro(s)`}
                    </Button>
                  </div>

                  {errors.length > 0 && (
                    <div className="space-y-1 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                        <AlertCircle className="h-4 w-4" />
                        Erros de validação
                      </div>
                      {errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive/80">{e}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* === STEP: RESULT === */}
            {step === "result" && result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="h-5 w-5 text-emerald-600" />
                    Relatório de Importação
                  </CardTitle>
                  <CardDescription>
                    {format(result.timestamp, "dd/MM/yyyy HH:mm")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <p className="text-2xl font-bold">{result.success + result.errors}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{result.success}</p>
                      <p className="text-xs text-emerald-600 mt-1">Sucesso</p>
                    </div>
                    <div className="rounded-lg bg-destructive/5 p-3 text-center">
                      <p className="text-2xl font-bold text-destructive">{result.errors}</p>
                      <p className="text-xs text-destructive mt-1">Erros</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <p className="text-xs font-mono break-all text-muted-foreground">{result.batchId.slice(0, 8)}...</p>
                      <p className="text-xs text-muted-foreground mt-1">Lote ID</p>
                    </div>
                  </div>

                  {tab === "pacientes" && result.success > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                      <Users className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>{result.success} paciente(s)</strong> foram enviados para Pré-Cadastros (pendente).
                        Acesse <strong>Pré-Cadastros</strong> para aprovar individualmente ou em lote.
                        Lote: <code className="text-xs">{result.batchId.slice(0, 8)}</code>
                      </p>
                    </div>
                  )}

                  {errors.length > 0 && (
                    <div className="space-y-1 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                        <AlertCircle className="h-4 w-4" />
                        Erros ({errors.length}{errors.length === 20 ? "+" : ""})
                      </div>
                      {errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive/80">{e}</p>
                      ))}
                    </div>
                  )}

                  <Button variant="outline" onClick={resetState}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Nova Importação
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ImportacaoMassa;
