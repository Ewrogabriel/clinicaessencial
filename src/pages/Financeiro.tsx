import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, DollarSign, TrendingUp, AlertCircle, CheckCircle, Download, Send, Filter } from "lucide-react";
import { FinanceExportButton } from "@/components/reports/FinanceExportButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/modules/shared/hooks/use-toast";
import { generateReceiptPDF, getReceiptNumber } from "@/lib/generateReceiptPDF";
import Despesas from "./Despesas";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { FinanceDashboard } from "@/components/reports/FinanceDashboard";
import { lazy, Suspense } from "react";
import { LazyLoadFallback } from "@/components/LazyLoadFallback";

const NotasFiscais = lazy(() => import("./NotasFiscais"));
const Comissoes = lazy(() => import("./Comissoes"));

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pago: { label: "Pago", variant: "default" },
  pendente: { label: "Pendente", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

const formaLabel: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

interface PagamentoRow {
  id: string;
  valor: number;
  data_pagamento: string;
  data_vencimento: string | null;
  status: string;
  forma_pagamento: string | null;
  descricao: string | null;
  observacoes: string | null;
  created_at: string;
  paciente_id: string;
  profissional_id: string;
  plano_id: string | null;
  matricula_id: string | null;
  agendamento_id: string | null;
  origem_tipo: "matricula" | "plano" | "sessao_avulsa" | "manual" | null;
  pacientes: { nome: string } | null;
}

const origemConfig: Record<string, { label: string; className: string }> = {
  matricula: { label: "Matrícula", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200" },
  plano: { label: "Plano", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200" },
  sessao_avulsa: { label: "Sess. Avulsa", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200" },
  manual: { label: "Manual", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

const Financeiro = () => {
  const { user, isPatient } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [filterMes, setFilterMes] = useState("");
  const [filterForma, setFilterForma] = useState("all");
  const [filterOrigem, setFilterOrigem] = useState("all");
  const [formData, setFormData] = useState({
    paciente_id: "",
    plano_id: "",
    valor: "",
    data_pagamento: format(new Date(), "yyyy-MM-dd"),
    data_vencimento: "",
    forma_pagamento: "",
    status: "pendente" as string,
    descricao: "",
    observacoes: "",
  });

  const { data: pagamentos = [], isLoading } = useQuery<PagamentoRow[]>({
    queryKey: ["pagamentos", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("pagamentos")
        .select(`
          id, valor, data_pagamento, data_vencimento, status, forma_pagamento,
          descricao, created_at, paciente_id, plano_id, matricula_id,
          agendamento_id, origem_tipo, pacientes (nome)
        `)
        .eq("clinic_id", activeClinicId)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("pacientes").select("id, nome").eq("status", "ativo").order("nome");
      return data ?? [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: despesasForDre = [] } = useQuery({
    queryKey: ["despesas-dre", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase.from("expenses").select("valor, status").eq("clinic_id", activeClinicId);
      if (error) throw error;
      return data;
    },
    enabled: !isPatient,
    staleTime: 1000 * 60 * 5,
  });

  const { data: comissoesForDre = [] } = useQuery({
    queryKey: ["comissoes-dre", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase.from("commissions").select("valor").eq("clinic_id", activeClinicId);
      if (error) throw error;
      return data;
    },
    enabled: !isPatient,
    staleTime: 1000 * 60 * 5,
  });

  const createPagamento = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("pagamentos").insert({
        paciente_id: formData.paciente_id,
        profissional_id: user.id,
        plano_id: formData.plano_id || null,
        valor: parseFloat(formData.valor) || 0,
        data_pagamento: formData.data_pagamento,
        data_vencimento: formData.data_vencimento || null,
        forma_pagamento: formData.forma_pagamento as any,
        status: formData.status as any,
        descricao: formData.descricao || null,
        observacoes: formData.observacoes || null,
        created_by: user.id,
        clinic_id: activeClinicId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      setFormOpen(false);
      setFormData({ paciente_id: "", plano_id: "", valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), data_vencimento: "", forma_pagamento: "", status: "pendente", descricao: "", observacoes: "" });
      toast({ title: "Pagamento registrado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const kpis = useMemo(() => {
    const totalRecebido = pagamentos.filter((p) => p.status === "pago").reduce((sum, p) => sum + Number(p.valor), 0);
    const totalPendente = pagamentos.filter((p) => p.status === "pendente").reduce((sum, p) => sum + Number(p.valor), 0);
    const totalDespesas = (despesasForDre || []).filter((d) => d.status === "pago").reduce((sum, d) => sum + Number(d.valor), 0);
    const totalComissoes = (comissoesForDre || []).reduce((sum, c) => sum + Number(c.valor), 0);
    const countPagos = pagamentos.filter((p) => p.status === 'pago').length;
    const countPendentes = pagamentos.filter((p) => p.status === 'pendente').length;
    const lucroLiquido = totalRecebido - totalDespesas - totalComissoes;
    return { totalRecebido, totalPendente, totalDespesas, totalComissoes, countPagos, countPendentes, lucroLiquido };
  }, [pagamentos, despesasForDre, comissoesForDre]);

  const { totalRecebido, totalPendente, totalDespesas, totalComissoes, countPagos, countPendentes, lucroLiquido } = kpis;

  const filteredPagamentos = useMemo(() => {
    let filtered = pagamentos || [];
    if (filterMes && filterMes !== "all") {
      filtered = filtered.filter((p) => p.data_pagamento?.startsWith(filterMes));
    }
    if (filterForma && filterForma !== "all") {
      filtered = filtered.filter((p) => p.forma_pagamento === filterForma);
    }
    if (filterOrigem && filterOrigem !== "all") {
      filtered = filtered.filter((p) => (p.origem_tipo ?? "manual") === filterOrigem);
    }
    return filtered;
  }, [pagamentos, filterMes, filterForma, filterOrigem]);

  const PaymentRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const pagamento = filteredPagamentos[index];
    const origem = pagamento.origem_tipo ?? "manual";
    const origemInfo = origemConfig[origem] ?? origemConfig.manual;
    return (
      <div style={style} className="border-b border-border/50 flex items-center px-4 hover:bg-muted/50 transition-colors">
        {!isPatient && <div className="flex-1 font-medium truncate pr-4">{pagamento.pacientes?.nome ?? "—"}</div>}
        <div className="w-[90px] pr-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${origemInfo.className}`}>
            {origemInfo.label}
          </span>
        </div>
        <div className="w-[160px] text-sm truncate pr-4">{pagamento.descricao || "—"}</div>
        <div className="w-[100px] text-sm font-semibold pr-4">R$ {Number(pagamento.valor).toFixed(2)}</div>
        <div className="w-[120px] text-sm truncate pr-4">{pagamento.forma_pagamento ? formaLabel[pagamento.forma_pagamento] || pagamento.forma_pagamento : "—"}</div>
        <div className="w-[100px] text-xs pr-4">{pagamento.data_vencimento ? format(new Date(pagamento.data_vencimento), "dd/MM/yyyy") : "—"}</div>
        <div className="w-[100px] text-xs pr-4">{pagamento.status === 'pago' ? format(new Date(pagamento.data_pagamento), "dd/MM/yyyy") : "—"}</div>
        <div className="w-[100px] pr-4">
          <Badge variant={pagamento.status === 'pago' ? 'default' : 'destructive'} className="text-[10px] py-0">
            {statusBadge[pagamento.status]?.label || pagamento.status}
          </Badge>
        </div>
        <div className="w-[80px] text-right">
          {pagamento.status === "pago" && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => {
              const numero = getReceiptNumber(pagamento.id, pagamento.created_at);
              const dataPgto = format(new Date(pagamento.data_pagamento), "dd/MM/yyyy");
              const ref = pagamento.data_vencimento ? format(new Date(pagamento.data_vencimento), "MMMM/yyyy", { locale: ptBR }) : pagamento.descricao || "Serviço";
              const pdf = await generateReceiptPDF({ numero, pacienteNome: pagamento.pacientes?.nome || "—", cpf: "", descricao: pagamento.descricao || "Serviço de Pilates/Fisioterapia", valor: Number(pagamento.valor), formaPagamento: pagamento.forma_pagamento || "", dataPagamento: dataPgto, referencia: ref.charAt(0).toUpperCase() + ref.slice(1) });
              pdf.save(`Recibo_${numero}.pdf`);
              toast({ title: "Recibo gerado!" });
            }}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold font-[Plus_Jakarta_Sans]">{isPatient ? "Meus Pagamentos" : "Financeiro"}</h1>
        <div className="flex gap-2 flex-wrap">
          {!isPatient && <FinanceExportButton pagamentos={pagamentos} />}
          {!isPatient && (
            <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo Pagamento</Button>
          )}
        </div>
      </div>

      {!isPatient && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">R$ {totalRecebido.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-destructive">R$ {totalPendente.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pagos</CardTitle>
              <CheckCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{countPagos}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <DollarSign className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{countPendentes}</p></CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="fluxo" className="space-y-4">
        {!isPatient && (
          <TabsList className="flex flex-wrap w-full max-w-4xl gap-1 h-auto p-1">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="fluxo">Pagamentos</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            <TabsTrigger value="notas-fiscais">Notas Fiscais</TabsTrigger>
            <TabsTrigger value="dre">DRE</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="dashboard"><FinanceDashboard /></TabsContent>

        <TabsContent value="fluxo" className="space-y-4">
          {!isPatient && (
            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => {
                    const d = subMonths(new Date(), i);
                    return <SelectItem key={i} value={format(d, "yyyy-MM")}>{format(d, "MMMM yyyy", { locale: ptBR })}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <Select value={filterForma} onValueChange={setFilterForma}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas as formas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as formas</SelectItem>
                  {Object.entries(formaLabel).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="matricula">Matrícula</SelectItem>
                  <SelectItem value="plano">Plano</SelectItem>
                  <SelectItem value="sessao_avulsa">Sessão Avulsa</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              {(filterMes || filterForma !== "all" || filterOrigem !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterMes(""); setFilterForma("all"); setFilterOrigem("all"); }}>Limpar filtros</Button>
              )}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
              ) : filteredPagamentos.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-lg font-medium">Nenhum pagamento encontrado</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex items-center px-4 py-3 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {!isPatient && <div className="flex-1 pr-4">Paciente</div>}
                    <div className="w-[90px] pr-2">Tipo</div>
                    <div className="w-[160px] pr-4">Descrição</div>
                    <div className="w-[100px] pr-4">Valor</div>
                    <div className="w-[120px] pr-4">Forma</div>
                    <div className="w-[100px] pr-4">Venc.</div>
                    <div className="w-[100px] pr-4">Pagamento</div>
                    <div className="w-[100px] pr-4">Status</div>
                    <div className="w-[80px] text-right">Ação</div>
                  </div>
                  <div className="w-full h-[400px] overflow-auto">
                    {filteredPagamentos.map((_, index) => <PaymentRow key={index} index={index} style={{ height: 56 }} />)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dre" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Demonstrativo de Resultados (DRE)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-green-600">(+) Receita Operacional</span>
                  <span className="font-bold text-green-600">R$ {totalRecebido.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-red-600">(-) Despesas Operacionais</span>
                  <span className="font-bold text-red-600">R$ {totalDespesas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-red-600">(-) Comissões Profissionais</span>
                  <span className="font-bold text-red-600">R$ {totalComissoes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-4 bg-muted/50 px-4 rounded-lg">
                  <span className="text-lg font-bold">(=) LUCRO LÍQUIDO NO PERÍODO</span>
                  <span className={`text-xl font-black ${lucroLiquido >= 0 ? "text-primary" : "text-destructive"}`}>R$ {lucroLiquido.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="despesas"><Despesas /></TabsContent>
        <TabsContent value="comissoes"><Suspense fallback={<LazyLoadFallback />}><Comissoes /></Suspense></TabsContent>
        <TabsContent value="notas-fiscais"><Suspense fallback={<LazyLoadFallback />}><NotasFiscais /></Suspense></TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0"><DialogTitle>Novo Pagamento</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="space-y-4 pr-4">
              <div>
                <Label>Paciente</Label>
                <Select value={formData.paciente_id} onValueChange={(v) => setFormData(p => ({ ...p, paciente_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={formData.valor} onChange={(e) => setFormData(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={formData.forma_pagamento} onValueChange={(v) => setFormData(p => ({ ...p, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Pagamento</Label><Input type="date" value={formData.data_pagamento} onChange={(e) => setFormData(p => ({ ...p, data_pagamento: e.target.value }))} /></div>
                <div><Label>Vencimento (opcional)</Label><Input type="date" value={formData.data_vencimento} onChange={(e) => setFormData(p => ({ ...p, data_vencimento: e.target.value }))} /></div>
              </div>
              <div><Label>Descrição</Label><Input placeholder="Ex: Pacote 10 sessões Pilates" value={formData.descricao} onChange={(e) => setFormData(p => ({ ...p, descricao: e.target.value }))} /></div>
              <div><Label>Observações</Label><Textarea placeholder="Observações..." value={formData.observacoes} onChange={(e) => setFormData(p => ({ ...p, observacoes: e.target.value }))} /></div>
            </div>
          </ScrollArea>
          <div className="shrink-0 flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => createPagamento.mutate()} disabled={!formData.paciente_id || !formData.valor || createPagamento.isPending}>
              {createPagamento.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financeiro;
