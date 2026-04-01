import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/modules/shared/hooks/use-toast";
import { format } from "date-fns";
import {
  Building2, Plus, Upload, Check, X, Loader2, FileSpreadsheet,
  Landmark, RefreshCw, Sparkles, Trash2, Tag, ArrowRightLeft, Brain
} from "lucide-react";

const BANKS = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "341", nome: "Itaú Unibanco" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "033", nome: "Santander Brasil" },
  { codigo: "260", nome: "Nubank (Nu Pagamentos)" },
  { codigo: "077", nome: "Banco Inter" },
  { codigo: "336", nome: "C6 Bank" },
  { codigo: "335", nome: "Banco Digio" },
];

const CATEGORIES = [
  "mensalidade", "sessao_avulsa", "imposto", "fornecedor", "salario",
  "aluguel", "servico", "equipamento", "marketing", "taxa_bancaria",
  "transferencia", "investimento", "outros"
];

const CATEGORY_LABELS: Record<string, string> = {
  mensalidade: "Mensalidade", sessao_avulsa: "Sessão Avulsa", imposto: "Imposto",
  fornecedor: "Fornecedor", salario: "Salário", aluguel: "Aluguel",
  servico: "Serviço", equipamento: "Equipamento", marketing: "Marketing",
  taxa_bancaria: "Taxa Bancária", transferencia: "Transferência",
  investimento: "Investimento", outros: "Outros"
};

interface ImportColumn {
  key: string;
  label: string;
  required: boolean;
}

const EXPECTED_COLUMNS: ImportColumn[] = [
  { key: "data", label: "Data", required: true },
  { key: "descricao", label: "Descrição", required: true },
  { key: "valor", label: "Valor", required: true },
  { key: "saldo", label: "Saldo", required: false },
  { key: "documento", label: "Documento/Nº", required: false },
];

export default function ConciliacaoBancaria() {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [accountForm, setAccountForm] = useState({ banco_codigo: "", agencia: "", conta: "", apelido: "" });

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "preview" | "importing">("upload");
  const [useAI, setUseAI] = useState(false);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [importing, setImporting] = useState(false);

  // AI categorization state
  const [categorizingAI, setCategorizingAI] = useState(false);

  // Fetch bank accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["bank-accounts", activeClinicId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_accounts") as any)
        .select("*").eq("clinic_id", activeClinicId).eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ["bank-transactions", selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const { data, error } = await (supabase.from("bank_transactions") as any)
        .select("*, pacientes(nome)")
        .eq("bank_account_id", selectedAccountId)
        .order("data_transacao", { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAccountId,
  });

  // Fetch pending payments
  const { data: pendingPayments = [] } = useQuery({
    queryKey: ["pending-payments-for-match", activeClinicId],
    queryFn: async () => {
      let q = supabase.from("pagamentos")
        .select("id, paciente_id, valor, data_vencimento, descricao, status, pacientes(nome)")
        .in("status", ["pendente"] as any);
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  // Fetch patients for AI matching
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-for-match", activeClinicId],
    queryFn: async () => {
      let q = supabase.from("pacientes").select("id, nome, cpf").eq("status", "ativo" as any);
      if (activeClinicId) {
        const { data: cp } = await (supabase.from("clinic_pacientes") as any).select("paciente_id").eq("clinic_id", activeClinicId);
        if (cp?.length) q = q.in("id", cp.map((c: any) => c.paciente_id));
      }
      const { data } = await q;
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  // Create bank account
  const createAccount = useMutation({
    mutationFn: async () => {
      const bank = BANKS.find(b => b.codigo === accountForm.banco_codigo);
      const { error } = await (supabase.from("bank_accounts") as any).insert({
        clinic_id: activeClinicId, banco_codigo: accountForm.banco_codigo,
        banco_nome: bank?.nome || accountForm.banco_codigo,
        agencia: accountForm.agencia, conta: accountForm.conta,
        apelido: accountForm.apelido || bank?.nome, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conta cadastrada!" });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      setAccountDialogOpen(false);
      setAccountForm({ banco_codigo: "", agencia: "", conta: "", apelido: "" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("bank_accounts") as any).update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conta removida!" });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      if (selectedAccountId) setSelectedAccountId("");
    },
  });

  // ---- IMPORT LOGIC ----
  const parseDateBR = (str: string): string => {
    if (!str) return new Date().toISOString().split("T")[0];
    const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (brMatch) {
      const [, d, m, y] = brMatch;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const isoMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    return new Date().toISOString().split("T")[0];
  };

  const parseValue = (str: string): number => {
    if (!str) return 0;
    const clean = str.replace(/[R$\s]/g, "").trim();
    // Handle BR format: 1.234,56
    if (clean.includes(",") && clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
      return parseFloat(clean.replace(/\./g, "").replace(",", "."));
    }
    return parseFloat(clean.replace(/,/g, ""));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    let rows: string[][] = [];

    if (ext === "csv" || ext === "txt") {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      rows = lines.map(line => {
        // Detect delimiter
        const tab = line.split("\t");
        const semi = line.split(";");
        const comma = line.split(",");
        if (tab.length >= 3) return tab.map(c => c.trim());
        if (semi.length >= 3) return semi.map(c => c.trim());
        return comma.map(c => c.trim());
      });
    } else if (ext === "xlsx" || ext === "xls") {
      try {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
        rows = json.filter(r => r.some(c => c != null && String(c).trim()));
      } catch {
        toast({ title: "Erro ao ler arquivo Excel", variant: "destructive" });
        return;
      }
    } else if (ext === "ofx") {
      const text = await file.text();
      const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
      let match;
      rows = [["Data", "Descrição", "Valor", "Documento"]];
      while ((match = txRegex.exec(text)) !== null) {
        const block = match[1];
        const dtPosted = block.match(/<DTPOSTED>(\d{8})/)?.[1] || "";
        const trnAmt = block.match(/<TRNAMT>([^\n<]+)/)?.[1]?.trim() || "0";
        const memo = block.match(/<MEMO>([^\n<]+)/)?.[1]?.trim() || "";
        const fitId = block.match(/<FITID>([^\n<]+)/)?.[1]?.trim() || "";
        const dateFormatted = dtPosted ? `${dtPosted.slice(6, 8)}/${dtPosted.slice(4, 6)}/${dtPosted.slice(0, 4)}` : "";
        rows.push([dateFormatted, memo, trnAmt, fitId]);
      }
    } else {
      toast({ title: "Formato não suportado", description: "Use CSV, XLSX, TXT ou OFX.", variant: "destructive" });
      return;
    }

    if (rows.length < 2) {
      toast({ title: "Arquivo vazio ou sem dados suficientes", variant: "destructive" });
      return;
    }

    setRawRows(rows);
    const headers = rows[0].map(h => String(h || "").trim());
    setFileHeaders(headers);

    // Auto-map columns
    const mapping: Record<string, string> = {};
    headers.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (lower.includes("data") || lower.includes("date")) mapping["data"] = String(i);
      else if (lower.includes("descri") || lower.includes("memo") || lower.includes("histori")) mapping["descricao"] = String(i);
      else if (lower.includes("valor") || lower.includes("amount") || lower.includes("quantia")) mapping["valor"] = String(i);
      else if (lower.includes("saldo") || lower.includes("balance")) mapping["saldo"] = String(i);
      else if (lower.includes("doc") || lower.includes("numero") || lower.includes("nº")) mapping["documento"] = String(i);
    });
    setColumnMapping(mapping);
    setImportStep("mapping");
  };

  const getMappedPreview = useCallback(() => {
    const dataRows = hasHeaderRow ? rawRows.slice(1) : rawRows;
    return dataRows.slice(0, 5).map(row => ({
      data: columnMapping.data != null ? String(row[Number(columnMapping.data)] || "") : "",
      descricao: columnMapping.descricao != null ? String(row[Number(columnMapping.descricao)] || "") : "",
      valor: columnMapping.valor != null ? String(row[Number(columnMapping.valor)] || "") : "",
      saldo: columnMapping.saldo != null ? String(row[Number(columnMapping.saldo)] || "") : "",
      documento: columnMapping.documento != null ? String(row[Number(columnMapping.documento)] || "") : "",
    }));
  }, [rawRows, columnMapping, hasHeaderRow]);

  const handleImportConfirm = async () => {
    if (!columnMapping.data || !columnMapping.descricao || !columnMapping.valor) {
      toast({ title: "Mapeie ao menos Data, Descrição e Valor", variant: "destructive" });
      return;
    }

    setImporting(true);
    setImportStep("importing");

    try {
      const dataRows = hasHeaderRow ? rawRows.slice(1) : rawRows;
      const transactions: any[] = [];

      for (const row of dataRows) {
        const dateStr = String(row[Number(columnMapping.data)] || "");
        const desc = String(row[Number(columnMapping.descricao)] || "").trim();
        const valorStr = String(row[Number(columnMapping.valor)] || "");
        const saldoStr = columnMapping.saldo ? String(row[Number(columnMapping.saldo)] || "") : "";
        const docStr = columnMapping.documento ? String(row[Number(columnMapping.documento)] || "") : "";
        const valor = parseValue(valorStr);

        if (!desc || isNaN(valor)) continue;

        transactions.push({
          bank_account_id: selectedAccountId,
          clinic_id: activeClinicId,
          data_transacao: parseDateBR(dateStr),
          descricao: desc,
          valor,
          tipo: valor >= 0 ? "credito" : "debito",
          saldo: saldoStr ? parseValue(saldoStr) : null,
          documento: docStr || null,
          status: "pendente",
          dados_originais: { raw: row },
        });
      }

      if (transactions.length === 0) {
        toast({ title: "Nenhuma transação válida encontrada", variant: "destructive" });
        setImporting(false);
        setImportStep("mapping");
        return;
      }

      // Insert in batches of 100
      for (let i = 0; i < transactions.length; i += 100) {
        const batch = transactions.slice(i, i + 100);
        await (supabase.from("bank_transactions") as any).insert(batch);
      }

      // Auto-match by value
      await autoMatchByValue(transactions);

      // If AI enabled, run categorization
      if (useAI) {
        await runAICategorization(transactions.map(t => ({ descricao: t.descricao, valor: t.valor })));
      }

      toast({ title: `${transactions.length} transações importadas!`, description: useAI ? "IA está categorizando..." : "Pronto para revisão." });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      resetImportState();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
      setImporting(false);
      setImportStep("mapping");
    }
  };

  const autoMatchByValue = async (txs: any[]) => {
    if (!pendingPayments.length) return;
    for (const tx of txs) {
      if (tx.valor <= 0) continue;
      const matches = pendingPayments.filter((p: any) => Math.abs(Number(p.valor) - Math.abs(tx.valor)) < 0.01);
      if (matches.length === 1) {
        const m = matches[0] as any;
        await (supabase.from("bank_transactions") as any)
          .update({ matched_payment_id: m.id, matched_paciente_id: m.paciente_id, matched_confidence: 0.9, status: "matched" })
          .eq("descricao", tx.descricao).eq("data_transacao", tx.data_transacao).eq("bank_account_id", selectedAccountId);
      }
    }
  };

  const runAICategorization = async (items: { descricao: string; valor: number }[]) => {
    try {
      const patientNames = patients.map((p: any) => p.nome).slice(0, 200);
      const { data: aiResult } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: "categorize_transactions",
          context: {
            transactions: items.slice(0, 100),
            categories: CATEGORIES,
            patient_names: patientNames,
          },
        },
      });

      if (aiResult?.categorized) {
        for (const item of aiResult.categorized) {
          const update: any = {};
          if (item.categoria) update.categoria = item.categoria;
          if (item.paciente_nome) {
            const found = patients.find((p: any) => p.nome.toLowerCase().includes(item.paciente_nome.toLowerCase()));
            if (found) {
              update.matched_paciente_id = found.id;
              update.matched_confidence = item.confidence || 0.7;
              update.status = "matched";
            }
          }
          if (Object.keys(update).length > 0) {
            await (supabase.from("bank_transactions") as any)
              .update(update)
              .eq("descricao", item.descricao)
              .eq("bank_account_id", selectedAccountId)
              .is("categoria", null);
          }
        }
        queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      }
    } catch {
      // AI categorization is optional, don't block
    }
  };

  const resetImportState = () => {
    setImportDialogOpen(false);
    setImportStep("upload");
    setRawRows([]);
    setFileHeaders([]);
    setColumnMapping({});
    setImporting(false);
  };

  // Manual category update
  const updateCategory = useMutation({
    mutationFn: async ({ txId, categoria }: { txId: string; categoria: string }) => {
      await (supabase.from("bank_transactions") as any).update({ categoria }).eq("id", txId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
    },
  });

  // Confirm/reject match
  const confirmMatch = useMutation({
    mutationFn: async ({ txId, action }: { txId: string; action: "confirm" | "reject" }) => {
      if (action === "confirm") {
        const tx = transactions.find((t: any) => t.id === txId);
        if (tx?.matched_payment_id) {
          await supabase.from("pagamentos")
            .update({ status: "pago" as any, data_pagamento: tx.data_transacao })
            .eq("id", tx.matched_payment_id);
        }
        await (supabase.from("bank_transactions") as any)
          .update({ status: "confirmado", reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
          .eq("id", txId);
      } else {
        await (supabase.from("bank_transactions") as any)
          .update({ status: "rejeitado", reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString(), matched_payment_id: null, matched_paciente_id: null })
          .eq("id", txId);
      }
    },
    onSuccess: () => {
      toast({ title: "Transação atualizada!" });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
    },
  });

  // AI Categorize uncategorized
  const handleAICategorizeAll = async () => {
    const uncategorized = transactions.filter((t: any) => !t.categoria);
    if (!uncategorized.length) {
      toast({ title: "Todas as transações já possuem categoria" });
      return;
    }
    setCategorizingAI(true);
    try {
      await runAICategorization(uncategorized.map((t: any) => ({ descricao: t.descricao, valor: t.valor })));
      toast({ title: "Categorização concluída!" });
    } catch {
      toast({ title: "Erro na categorização", variant: "destructive" });
    } finally {
      setCategorizingAI(false);
    }
  };

  // AI Match
  const handleAIMatchAll = async () => {
    const unmatched = transactions.filter((t: any) => !t.matched_paciente_id && t.valor > 0);
    if (!unmatched.length) {
      toast({ title: "Nenhuma transação sem match" });
      return;
    }
    setCategorizingAI(true);
    try {
      const patientNames = patients.map((p: any) => p.nome).slice(0, 200);
      const paymentDescs = pendingPayments.map((p: any) => ({
        id: p.id, paciente_id: p.paciente_id, valor: p.valor,
        nome: (p as any).pacientes?.nome || ""
      }));

      const { data: aiResult } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: "match_transactions",
          context: {
            transactions: unmatched.slice(0, 100).map((t: any) => ({ id: t.id, descricao: t.descricao, valor: t.valor, data: t.data_transacao })),
            payments: paymentDescs,
            patient_names: patientNames,
          },
        },
      });

      if (aiResult?.matches) {
        for (const m of aiResult.matches) {
          if (m.payment_id || m.paciente_id) {
            await (supabase.from("bank_transactions") as any)
              .update({
                matched_payment_id: m.payment_id || null,
                matched_paciente_id: m.paciente_id || null,
                matched_confidence: m.confidence || 0.6,
                status: "matched",
              })
              .eq("id", m.transaction_id);
          }
        }
        queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      }
      toast({ title: "Matching por IA concluído!" });
    } catch {
      toast({ title: "Erro no matching", variant: "destructive" });
    } finally {
      setCategorizingAI(false);
    }
  };

  const pendingReview = useMemo(() => transactions.filter((t: any) => t.status === "matched" && !t.reviewed), [transactions]);

  const preview = useMemo(() => importStep === "mapping" ? getMappedPreview() : [], [importStep, getMappedPreview]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conciliação Bancária</h1>
          <p className="text-muted-foreground">Importe extratos, categorize transações e confirme pagamentos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setAccountDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Conta
          </Button>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acc: any) => (
          <Card
            key={acc.id}
            className={`cursor-pointer transition-all ${selectedAccountId === acc.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
            onClick={() => setSelectedAccountId(acc.id)}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">{acc.apelido || acc.banco_nome}</CardTitle>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteAccount.mutate(acc.id); }}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {acc.banco_nome} • Ag: {acc.agencia || "—"} • Conta: {acc.conta || "—"}
              </p>
            </CardContent>
          </Card>
        ))}
        {accounts.length === 0 && !loadingAccounts && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma conta bancária cadastrada.</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setAccountDialogOpen(true)}>
                <Plus className="h-4 w-4" /> Cadastrar Conta
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selected Account */}
      {selectedAccountId && (
        <Tabs defaultValue="importar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="importar">Importar Extrato</TabsTrigger>
            <TabsTrigger value="pendentes">
              Pendentes
              {pendingReview.length > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">{pendingReview.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="integracao">Integração API</TabsTrigger>
          </TabsList>

          {/* IMPORT TAB */}
          <TabsContent value="importar">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" /> Importar Extrato
                </CardTitle>
                <CardDescription>
                  Envie o extrato bancário. Você mapeia as colunas antes de importar. A IA é opcional.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Formatos aceitos: CSV, Excel (.xlsx), TXT, OFX
                  </p>
                  <label className="cursor-pointer">
                    <Button variant="outline" className="gap-2" asChild>
                      <span><Upload className="h-4 w-4" /> Selecionar Arquivo</span>
                    </Button>
                    <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.txt,.ofx" onChange={handleFileSelect} />
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* AI Actions */}
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button variant="outline" className="gap-2" onClick={handleAICategorizeAll} disabled={categorizingAI}>
                {categorizingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Categorizar com IA
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleAIMatchAll} disabled={categorizingAI}>
                {categorizingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Relacionar Pacientes com IA
              </Button>
            </div>
          </TabsContent>

          {/* PENDING TAB */}
          <TabsContent value="pendentes" className="space-y-3">
            {pendingReview.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Check className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma transação pendente de revisão.</p>
                </CardContent>
              </Card>
            ) : (
              pendingReview.map((tx: any) => (
                <Card key={tx.id} className="border-l-4 border-l-primary">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{tx.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.data_transacao), "dd/MM/yyyy")} •{" "}
                          <span className={tx.valor >= 0 ? "text-emerald-600" : "text-destructive"}>
                            R$ {Math.abs(tx.valor).toFixed(2)}
                          </span>
                          {tx.categoria && (
                            <Badge variant="outline" className="ml-2 text-[10px]">{CATEGORY_LABELS[tx.categoria] || tx.categoria}</Badge>
                          )}
                        </p>
                        {tx.matched_paciente_id && (
                          <div className="mt-2 p-2 rounded-md bg-muted/50">
                            <p className="text-xs font-medium">
                              <Badge variant="secondary" className="mr-2">Match {Math.round((tx.matched_confidence || 0) * 100)}%</Badge>
                              Paciente: {tx.pacientes?.nome || "—"}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1 text-emerald-600" onClick={() => confirmMatch.mutate({ txId: tx.id, action: "confirm" })}>
                          <Check className="h-3.5 w-3.5" /> Confirmar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => confirmMatch.mutate({ txId: tx.id, action: "reject" })}>
                          <X className="h-3.5 w-3.5" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="historico">
            <Card>
              <CardContent className="p-0">
                {loadingTransactions ? (
                  <div className="py-12 text-center text-muted-foreground">Carregando...</div>
                ) : transactions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">Nenhuma transação importada.</div>
                ) : (
                  <div className="divide-y max-h-[500px] overflow-y-auto">
                    {transactions.map((tx: any) => (
                      <div key={tx.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{tx.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.data_transacao), "dd/MM/yyyy")}
                            {tx.pacientes?.nome && ` • ${tx.pacientes.nome}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Select
                            value={tx.categoria || ""}
                            onValueChange={(v) => updateCategory.mutate({ txId: tx.id, categoria: v })}
                          >
                            <SelectTrigger className="h-7 text-xs w-[120px]">
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map(c => (
                                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className={`text-sm font-semibold whitespace-nowrap ${tx.valor >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            R$ {Math.abs(tx.valor).toFixed(2)}
                          </span>
                          <Badge variant={tx.status === "confirmado" ? "default" : tx.status === "rejeitado" ? "outline" : "secondary"} className="text-[10px]">
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* API TAB */}
          <TabsContent value="integracao">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" /> Integração API / Open Finance
                </CardTitle>
                <CardDescription>Em desenvolvimento. Utilize a importação manual de extratos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {BANKS.map(bank => (
                  <div key={bank.codigo} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Landmark className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{bank.nome}</p>
                        <p className="text-xs text-muted-foreground">Código: {bank.codigo}</p>
                      </div>
                    </div>
                    <Badge variant="outline">Em breve</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Column Mapping Dialog */}
      <Dialog open={importStep === "mapping" || importStep === "importing"} onOpenChange={(open) => { if (!open) resetImportState(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Importação</DialogTitle>
            <DialogDescription>Mapeie as colunas do arquivo para os campos do sistema.</DialogDescription>
          </DialogHeader>

          {importStep === "importing" ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Importando transações...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Options */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={hasHeaderRow} onCheckedChange={setHasHeaderRow} />
                  <Label className="text-sm">Primeira linha é cabeçalho</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={useAI} onCheckedChange={setUseAI} />
                  <Label className="text-sm flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Usar IA para categorizar
                  </Label>
                </div>
              </div>

              {/* Column Mapping */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Mapeamento de colunas</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {EXPECTED_COLUMNS.map(col => (
                    <div key={col.key}>
                      <Label className="text-xs">
                        {col.label} {col.required && <span className="text-destructive">*</span>}
                      </Label>
                      <Select
                        value={columnMapping[col.key] || "__ignore__"}
                        onValueChange={(v) => setColumnMapping(prev => {
                          const next = { ...prev };
                          if (v === "__ignore__") { delete next[col.key]; } else { next[col.key] = v; }
                          return next;
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione a coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">— Ignorar —</SelectItem>
                          {fileHeaders.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>{h || `Coluna ${i + 1}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Prévia dos dados</p>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-3 py-2 text-left">Data</th>
                          <th className="px-3 py-2 text-left">Descrição</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                          <th className="px-3 py-2 text-right">Saldo</th>
                          <th className="px-3 py-2 text-left">Doc</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5">{row.data}</td>
                            <td className="px-3 py-1.5 max-w-[200px] truncate">{row.descricao}</td>
                            <td className="px-3 py-1.5 text-right">{row.valor}</td>
                            <td className="px-3 py-1.5 text-right">{row.saldo}</td>
                            <td className="px-3 py-1.5">{row.documento}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(hasHeaderRow ? rawRows.length - 1 : rawRows.length)} linhas no total
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={resetImportState}>Cancelar</Button>
                <Button className="gap-2" onClick={handleImportConfirm} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Importar {hasHeaderRow ? rawRows.length - 1 : rawRows.length} transações
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta Bancária</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Banco</Label>
              <Select value={accountForm.banco_codigo} onValueChange={(v) => setAccountForm(p => ({ ...p, banco_codigo: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                <SelectContent>
                  {BANKS.map(b => <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} - {b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Agência</Label>
                <Input value={accountForm.agencia} onChange={e => setAccountForm(p => ({ ...p, agencia: e.target.value }))} placeholder="0001" />
              </div>
              <div>
                <Label>Conta</Label>
                <Input value={accountForm.conta} onChange={e => setAccountForm(p => ({ ...p, conta: e.target.value }))} placeholder="12345-6" />
              </div>
            </div>
            <div>
              <Label>Apelido (opcional)</Label>
              <Input value={accountForm.apelido} onChange={e => setAccountForm(p => ({ ...p, apelido: e.target.value }))} placeholder="Conta Principal" />
            </div>
            <Button className="w-full gap-2" onClick={() => createAccount.mutate()} disabled={!accountForm.banco_codigo || createAccount.isPending}>
              {createAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cadastrar Conta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
