import { useState, useMemo } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/modules/shared/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2, Plus, Upload, Check, X, Pencil, Loader2, FileSpreadsheet,
  Landmark, CreditCard, RefreshCw, Sparkles, Trash2
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

export default function ConciliacaoBancaria() {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [accountForm, setAccountForm] = useState({ banco_codigo: "", agencia: "", conta: "", apelido: "" });
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch bank accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["bank-accounts", activeClinicId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_accounts") as any)
        .select("*")
        .eq("clinic_id", activeClinicId)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  // Fetch transactions for selected account
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ["bank-transactions", selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const { data, error } = await (supabase.from("bank_transactions") as any)
        .select("*, pacientes(nome)")
        .eq("bank_account_id", selectedAccountId)
        .order("data_transacao", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAccountId,
  });

  // Fetch pending payments for matching
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

  // Create bank account
  const createAccount = useMutation({
    mutationFn: async () => {
      const bank = BANKS.find(b => b.codigo === accountForm.banco_codigo);
      const { error } = await (supabase.from("bank_accounts") as any).insert({
        clinic_id: activeClinicId,
        banco_codigo: accountForm.banco_codigo,
        banco_nome: bank?.nome || accountForm.banco_codigo,
        agencia: accountForm.agencia,
        conta: accountForm.conta,
        apelido: accountForm.apelido || bank?.nome,
        created_by: user?.id,
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

  // Delete bank account
  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("bank_accounts") as any)
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conta removida!" });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      if (selectedAccountId) setSelectedAccountId("");
    },
  });

  // Import statement file
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAccountId) return;

    setUploading(true);
    setAnalyzing(true);

    try {
      // Upload file
      const ext = file.name.split('.').pop()?.toLowerCase();
      const path = `statements/${activeClinicId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("clinic-uploads").upload(path, file);
      if (uploadError) throw uploadError;

      // Read file content for AI analysis
      const text = await file.text();
      
      // Create import log
      const { data: importLog, error: logError } = await (supabase.from("statement_imports") as any)
        .insert({
          bank_account_id: selectedAccountId,
          clinic_id: activeClinicId,
          file_name: file.name,
          file_type: ext,
          status: "processing",
          created_by: user?.id,
        })
        .select()
        .single();
      if (logError) throw logError;

      // Use AI to parse statement
      const account = accounts.find((a: any) => a.id === selectedAccountId);
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: "parse_statement",
          context: {
            file_content: text.substring(0, 50000), // Limit for AI
            file_type: ext,
            bank_name: account?.banco_nome,
            import_id: importLog.id,
          },
        },
      });

      if (aiError) {
        // Fallback: try basic CSV/text parsing
        const lines = text.split("\n").filter(l => l.trim());
        const transactions: any[] = [];
        
        for (const line of lines.slice(1)) { // skip header
          const parts = line.split(/[,;\t]/);
          if (parts.length >= 3) {
            const dateStr = parts[0]?.trim();
            const desc = parts[1]?.trim();
            const valorStr = parts[parts.length - 1]?.trim()?.replace(/[R$\s.]/g, "").replace(",", ".");
            const valor = parseFloat(valorStr);
            if (!isNaN(valor) && desc) {
              transactions.push({
                bank_account_id: selectedAccountId,
                clinic_id: activeClinicId,
                data_transacao: parseDateBR(dateStr),
                descricao: desc,
                valor: valor,
                tipo: valor >= 0 ? "credito" : "debito",
                import_batch_id: importLog.id,
                dados_originais: { raw: line },
              });
            }
          }
        }

        if (transactions.length > 0) {
          await (supabase.from("bank_transactions") as any).insert(transactions);
          await (supabase.from("statement_imports") as any)
            .update({ total_transactions: transactions.length, status: "completed" })
            .eq("id", importLog.id);
        }
      } else if (aiResult?.transactions) {
        const parsedTransactions = aiResult.transactions.map((t: any) => ({
          bank_account_id: selectedAccountId,
          clinic_id: activeClinicId,
          data_transacao: t.date,
          descricao: t.description,
          valor: t.amount,
          tipo: t.amount >= 0 ? "credito" : "debito",
          import_batch_id: importLog.id,
          dados_originais: t.raw || {},
        }));

        if (parsedTransactions.length > 0) {
          await (supabase.from("bank_transactions") as any).insert(parsedTransactions);
        }
        await (supabase.from("statement_imports") as any)
          .update({
            total_transactions: parsedTransactions.length,
            status: "completed",
            ai_analysis: aiResult.analysis || {},
          })
          .eq("id", importLog.id);
      }

      // Auto-match with pending payments
      await autoMatchTransactions(importLog.id);

      toast({ title: "Extrato importado!", description: "Transações foram analisadas e comparadas com pagamentos pendentes." });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setAnalyzing(false);
      setImportDialogOpen(false);
    }
  };

  const parseDateBR = (str: string): string => {
    if (!str) return new Date().toISOString().split("T")[0];
    // Try DD/MM/YYYY
    const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (brMatch) {
      const [, d, m, y] = brMatch;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // Try YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    return new Date().toISOString().split("T")[0];
  };

  const autoMatchTransactions = async (importBatchId: string) => {
    const { data: newTxs } = await (supabase.from("bank_transactions") as any)
      .select("*")
      .eq("import_batch_id", importBatchId)
      .eq("status", "pendente");

    if (!newTxs?.length || !pendingPayments.length) return;

    for (const tx of newTxs) {
      if (tx.valor <= 0) continue; // Only match credits
      
      // Find matching payment by value
      const matches = pendingPayments.filter((p: any) => {
        const diff = Math.abs(Number(p.valor) - Math.abs(tx.valor));
        return diff < 0.01; // Exact match
      });

      if (matches.length === 1) {
        const match = matches[0] as any;
        await (supabase.from("bank_transactions") as any)
          .update({
            matched_payment_id: match.id,
            matched_paciente_id: match.paciente_id,
            matched_confidence: 0.9,
            status: "matched",
          })
          .eq("id", tx.id);
      }
    }
  };

  // Confirm/reject transaction match
  const confirmMatch = useMutation({
    mutationFn: async ({ txId, action, paymentId }: { txId: string; action: "confirm" | "reject" | "edit"; paymentId?: string }) => {
      if (action === "confirm") {
        const tx = transactions.find((t: any) => t.id === txId);
        if (tx?.matched_payment_id) {
          // Update payment status to pago
          await supabase.from("pagamentos")
            .update({
              status: "pago" as any,
              data_pagamento: tx.data_transacao,
            })
            .eq("id", tx.matched_payment_id);
        }
        await (supabase.from("bank_transactions") as any)
          .update({ status: "confirmado", reviewed: true, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
          .eq("id", txId);
      } else if (action === "reject") {
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

  const pendingReview = useMemo(() => transactions.filter((t: any) => t.status === "matched" && !t.reviewed), [transactions]);
  const allReviewed = useMemo(() => transactions.filter((t: any) => t.reviewed), [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conciliação Bancária</h1>
          <p className="text-muted-foreground">Importe extratos, compare com pagamentos e confirme recebimentos.</p>
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

      {/* Selected Account Content */}
      {selectedAccountId && (
        <Tabs defaultValue="importar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="importar">Importar Extrato</TabsTrigger>
            <TabsTrigger value="pendentes">
              Pendentes de Revisão
              {pendingReview.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">{pendingReview.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="integracao">Integração API</TabsTrigger>
          </TabsList>

          <TabsContent value="importar">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" /> Importar Extrato
                </CardTitle>
                <CardDescription>
                  Envie o extrato bancário em PDF, Excel ou CSV. O sistema vai analisar e comparar com pagamentos pendentes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Arraste o arquivo ou clique para selecionar. Formatos: PDF, Excel (.xlsx), CSV
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <label className="cursor-pointer">
                      <Button variant="outline" className="gap-2" disabled={uploading} asChild>
                        <span>
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {analyzing ? "Analisando com IA..." : uploading ? "Enviando..." : "Selecionar Arquivo"}
                        </span>
                      </Button>
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv,.xlsx,.xls,.pdf,.txt,.ofx"
                        onChange={handleImportFile}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2 justify-center mt-4">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">IA auxilia na leitura e mapeamento automático</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-sm">{tx.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.data_transacao), "dd/MM/yyyy")} •{" "}
                              <span className={tx.valor >= 0 ? "text-emerald-600" : "text-destructive"}>
                                R$ {Math.abs(tx.valor).toFixed(2)}
                              </span>
                            </p>
                          </div>
                        </div>
                        {tx.matched_paciente_id && (
                          <div className="mt-2 p-2 rounded-md bg-muted/50">
                            <p className="text-xs font-medium">
                              <Badge variant="secondary" className="mr-2">Match {Math.round((tx.matched_confidence || 0) * 100)}%</Badge>
                              Paciente: {tx.pacientes?.nome || "—"}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
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
                      <div key={tx.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{tx.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.data_transacao), "dd/MM/yyyy")}
                            {tx.pacientes?.nome && ` • ${tx.pacientes.nome}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-semibold ${tx.valor >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            R$ {Math.abs(tx.valor).toFixed(2)}
                          </span>
                          <Badge variant={tx.status === "confirmado" ? "default" : tx.status === "rejeitado" ? "outline" : "secondary"}>
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

          <TabsContent value="integracao">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" /> Integração API / Open Finance
                </CardTitle>
                <CardDescription>
                  Configure a integração automática com seu banco para sincronização de extratos.
                </CardDescription>
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
                <p className="text-xs text-muted-foreground text-center mt-4">
                  A integração via API e Open Finance está em desenvolvimento. Enquanto isso, utilize a importação manual de extratos.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

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
                  {BANKS.map(b => (
                    <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} - {b.nome}</SelectItem>
                  ))}
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
