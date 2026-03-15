import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subMonths, addDays, isBefore, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, DollarSign, TrendingUp, AlertCircle, CheckCircle, Download, Filter, CalendarClock, Clock } from "lucide-react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
  aberto: { label: "Aberto", variant: "destructive" },
  anulado: { label: "Anulado", variant: "outline" },
};

const formaLabel: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

/** Unified payment row for display */
interface UnifiedPayment {
  id: string;
  valor: number;
  data_pagamento: string | null;
  data_vencimento: string | null;
  status: string;
  forma_pagamento: string | null;
  descricao: string | null;
  created_at: string;
  paciente_nome: string;
  origem_tipo: "plano" | "mensalidade" | "sessao" | "manual";
  source_table: "pagamentos" | "pagamentos_mensalidade" | "pagamentos_sessoes";
}

const origemConfig: Record<string, { label: string; className: string }> = {
  mensalidade: { label: "Mensalidade", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200" },
  plano: { label: "Plano", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200" },
  sessao: { label: "Sessão", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200" },
  manual: { label: "Manual", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

const Financeiro = () => {
  const { user, isPatient } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [filterMes, setFilterMes] = useState(format(new Date(), "yyyy-MM"));
  const [filterForma, setFilterForma] = useState("all");
  const [filterOrigem, setFilterOrigem] = useState("all");
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; source: string; open: boolean } | null>(null);
  const [confirmData, setConfirmData] = useState({ data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento_id: "" });
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

  // ── Formas de pagamento lookup (for mensalidade/sessoes that use FK) ──
  const { data: formasPagamentoList = [] } = useQuery({
    queryKey: ["formas-pagamento-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("formas_pagamento").select("id, nome, tipo").eq("ativo", true);
      return data ?? [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const formasPagamentoMap = useMemo(() => {
    const map: Record<string, string> = {};
    formasPagamentoList.forEach((f) => { map[f.id] = f.nome; });
    return map;
  }, [formasPagamentoList]);

  // ── Fetch all 3 payment tables in parallel ──
  const { data: allPayments = [], isLoading } = useQuery<UnifiedPayment[]>({
    queryKey: ["all-payments-unified", activeClinicId],
    queryFn: async () => {
      const results: UnifiedPayment[] = [];

      // 1. pagamentos (manual / plano / sessao_avulsa / matricula)
      let q1 = supabase
        .from("pagamentos")
        .select("id, valor, data_pagamento, data_vencimento, status, forma_pagamento, descricao, created_at, paciente_id, plano_id, origem_tipo, pacientes(nome)")
        .order("created_at", { ascending: false });
      if (activeClinicId) q1 = q1.eq("clinic_id", activeClinicId);
      const { data: pgtos } = await q1;

      (pgtos || []).forEach((p: any) => {
        let origemTipo: UnifiedPayment["origem_tipo"];
        if (p.origem_tipo === "plano") origemTipo = "plano";
        else if (p.origem_tipo === "matricula") origemTipo = "mensalidade";
        else if (p.origem_tipo === "sessao_avulsa") origemTipo = "sessao";
        else if (p.origem_tipo === "manual") origemTipo = "manual";
        else origemTipo = p.plano_id ? "plano" : "manual";

        results.push({
          id: p.id,
          valor: Number(p.valor),
          data_pagamento: p.data_pagamento,
          data_vencimento: p.data_vencimento,
          status: p.status,
          forma_pagamento: p.forma_pagamento ? (formaLabel[p.forma_pagamento] || p.forma_pagamento) : null,
          descricao: p.descricao,
          created_at: p.created_at,
          paciente_nome: p.pacientes?.nome ?? "—",
          origem_tipo: origemTipo,
          source_table: "pagamentos",
        });
      });

      // 2. pagamentos_mensalidade
      let q2 = supabase
        .from("pagamentos_mensalidade")
        .select("id, valor, data_pagamento, status, mes_referencia, forma_pagamento_id, observacoes, created_at, paciente_id, pacientes(nome)")
        .order("created_at", { ascending: false });
      if (activeClinicId) q2 = q2.eq("clinic_id", activeClinicId);
      const { data: mensalidades } = await q2;

      (mensalidades || []).forEach((m: any) => {
        results.push({
          id: m.id,
          valor: Number(m.valor),
          data_pagamento: m.data_pagamento,
          data_vencimento: m.mes_referencia ?? null,
          status: m.status ?? "aberto",
          forma_pagamento: m.forma_pagamento_id ? (formasPagamentoMap[m.forma_pagamento_id] || null) : null,
          descricao: `Mensalidade - ${m.mes_referencia}`,
          created_at: m.created_at ?? "",
          paciente_nome: m.pacientes?.nome ?? "—",
          origem_tipo: "mensalidade",
          source_table: "pagamentos_mensalidade",
        });
      });

      // 3. pagamentos_sessoes
      let q3 = supabase
        .from("pagamentos_sessoes")
        .select("id, valor, data_pagamento, status, observacoes, created_at, paciente_id, forma_pagamento_id, pacientes(nome)")
        .order("created_at", { ascending: false });
      if (activeClinicId) q3 = q3.eq("clinic_id", activeClinicId);
      const { data: sessoes } = await q3;

      (sessoes || []).forEach((s: any) => {
        results.push({
          id: s.id,
          valor: Number(s.valor),
          data_pagamento: s.data_pagamento,
          data_vencimento: null,
          status: s.status ?? "aberto",
          forma_pagamento: s.forma_pagamento_id ? (formasPagamentoMap[s.forma_pagamento_id] || null) : null,
          descricao: s.observacoes || "Sessão avulsa",
          created_at: s.created_at ?? "",
          paciente_nome: s.pacientes?.nome ?? "—",
          origem_tipo: "sessao",
          source_table: "pagamentos_sessoes",
        });
      });

      // Sort by date desc
      results.sort((a, b) => {
        const da = a.data_pagamento || a.created_at || "";
        const db = b.data_pagamento || b.created_at || "";
        return db.localeCompare(da);
      });

      return results;
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
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      setFormOpen(false);
      setFormData({ paciente_id: "", plano_id: "", valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), data_vencimento: "", forma_pagamento: "", status: "pendente", descricao: "", observacoes: "" });
      toast({ title: "Pagamento registrado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const kpis = useMemo(() => {
    const paid = allPayments.filter((p) => p.status === "pago");
    const pending = allPayments.filter((p) => p.status === "pendente" || p.status === "aberto");
    const totalRecebido = paid.reduce((sum, p) => sum + p.valor, 0);
    const totalPendente = pending.reduce((sum, p) => sum + p.valor, 0);
    const totalDespesas = (despesasForDre || []).filter((d) => d.status === "pago").reduce((sum, d) => sum + Number(d.valor), 0);
    const totalComissoes = (comissoesForDre || []).reduce((sum, c) => sum + Number(c.valor), 0);
    const lucroLiquido = totalRecebido - totalDespesas - totalComissoes;
    return { totalRecebido, totalPendente, totalDespesas, totalComissoes, countPagos: paid.length, countPendentes: pending.length, lucroLiquido };
  }, [allPayments, despesasForDre, comissoesForDre]);

  const { totalRecebido, totalPendente, totalDespesas, totalComissoes, countPagos, countPendentes, lucroLiquido } = kpis;

  const filteredPagamentos = useMemo(() => {
    let filtered = allPayments;
    if (filterMes && filterMes !== "all") {
      filtered = filtered.filter((p) => {
        const datePago = p.data_pagamento?.substring(0, 7);
        const dateVenc = p.data_vencimento?.substring(0, 7);
        const dateCreated = p.created_at?.substring(0, 7);
        return datePago === filterMes || dateVenc === filterMes || dateCreated === filterMes;
      });
    }
    if (filterForma && filterForma !== "all") {
      filtered = filtered.filter((p) => {
        const fp = p.forma_pagamento?.toLowerCase() ?? "";
        return fp.includes(filterForma);
      });
    }
    if (filterOrigem && filterOrigem !== "all") {
      filtered = filtered.filter((p) => p.origem_tipo === filterOrigem);
    }
    return filtered;
  }, [allPayments, filterMes, filterForma, filterOrigem]);

  const previsaoPagamentos = useMemo(() => {
    return allPayments
      .filter((p) => p.status === "pendente" || p.status === "aberto")
      .sort((a, b) => {
        const dateA = a.data_vencimento ? new Date(a.data_vencimento).getTime() : (a.data_pagamento ? new Date(a.data_pagamento).getTime() : Infinity);
        const dateB = b.data_vencimento ? new Date(b.data_vencimento).getTime() : (b.data_pagamento ? new Date(b.data_pagamento).getTime() : Infinity);
        return dateA - dateB;
      });
  }, [allPayments]);

  const previsaoKpis = useMemo(() => {
    const today = startOfDay(new Date());
    const in30Days = addDays(today, 30);
    const totalPrevisto = previsaoPagamentos.reduce((sum, p) => sum + p.valor, 0);
    const vencidos = previsaoPagamentos.filter(
      (p) => p.data_vencimento && isBefore(startOfDay(new Date(p.data_vencimento)), today)
    );
    const aVencer30 = previsaoPagamentos.filter((p) => {
      if (!p.data_vencimento) return false;
      const d = startOfDay(new Date(p.data_vencimento));
      return !isBefore(d, today) && !isAfter(d, in30Days);
    });
    return {
      totalPrevisto,
      countVencidos: vencidos.length,
      valorVencidos: vencidos.reduce((sum, p) => sum + p.valor, 0),
      countAVencer30: aVencer30.length,
      valorAVencer30: aVencer30.reduce((sum, p) => sum + p.valor, 0),
    };
  }, [previsaoPagamentos]);

  // Maps formas_pagamento.tipo (free-text) to the pagamentos.forma_pagamento enum values.
  // Note: 'cartao' is the legacy tipo used in formas_pagamento seed data and maps to the
  // most common card type ('cartao_credito'). 'cheque' is not in the pagamentos enum,
  // so it falls back to 'transferencia' as the closest equivalent.
  const TIPO_TO_FORMA_ENUM: Record<string, string> = {
    pix: "pix",
    dinheiro: "dinheiro",
    boleto: "boleto",
    transferencia: "transferencia",
    cartao: "cartao_credito",
    cartao_credito: "cartao_credito",
    cartao_debito: "cartao_debito",
    cheque: "transferencia",
  };

  const confirmPayment = useMutation({
    mutationFn: async ({ id, source, data_pagamento, forma_pagamento_id }: { id: string; source: string; data_pagamento: string; forma_pagamento_id: string }) => {
      const table = source as "pagamentos" | "pagamentos_mensalidade" | "pagamentos_sessoes";
      if (table === "pagamentos") {
        const tipo = formasPagamentoList.find(f => f.id === forma_pagamento_id)?.tipo ?? "pix";
        const formaEnum = TIPO_TO_FORMA_ENUM[tipo] ?? "pix";
        const { error } = await supabase.from("pagamentos").update({ status: "pago" as any, data_pagamento, forma_pagamento: formaEnum } as any).eq("id", id);
        if (error) throw error;
      } else if (table === "pagamentos_mensalidade") {
        const { error } = await supabase.from("pagamentos_mensalidade").update({ status: "pago", data_pagamento, forma_pagamento_id: forma_pagamento_id || null }).eq("id", id);
        if (error) throw error;
      } else if (table === "pagamentos_sessoes") {
        const { error } = await supabase.from("pagamentos_sessoes").update({ status: "pago", data_pagamento, forma_pagamento_id: forma_pagamento_id || null }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      setConfirmDialog(null);
      toast({ title: "Pagamento confirmado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "—"; }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold font-[Plus_Jakarta_Sans]">{isPatient ? "Meus Pagamentos" : "Financeiro"}</h1>
        <div className="flex gap-2 flex-wrap">
          {!isPatient && <FinanceExportButton pagamentos={allPayments as any} />}
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
            <TabsTrigger value="previsao">Previsão</TabsTrigger>
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
              <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="mensalidade">Mensalidade</SelectItem>
                  <SelectItem value="plano">Plano</SelectItem>
                  <SelectItem value="sessao">Sessão</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              {(filterMes !== format(new Date(), "yyyy-MM") || filterOrigem !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterMes(format(new Date(), "yyyy-MM")); setFilterOrigem("all"); }}>Limpar filtros</Button>
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
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="flex items-center px-4 py-3 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {!isPatient && <div className="flex-1 pr-4">Paciente</div>}
                      <div className="w-[100px] pr-2">Tipo</div>
                      <div className="w-[180px] pr-4">Descrição</div>
                      <div className="w-[100px] pr-4">Valor</div>
                      <div className="w-[120px] pr-4">Forma Pgto</div>
                      <div className="w-[100px] pr-4">Data</div>
                      <div className="w-[90px] pr-4">Status</div>
                      <div className="w-[80px] text-right">Ação</div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                      {filteredPagamentos.map((pagamento) => {
                        const origemInfo = origemConfig[pagamento.origem_tipo] ?? origemConfig.manual;
                        const isPaid = pagamento.status === "pago";
                        return (
                          <div key={`${pagamento.source_table}-${pagamento.id}`} className="border-b border-border/50 flex items-center px-4 py-3 hover:bg-muted/50 transition-colors">
                            {!isPatient && <div className="flex-1 font-medium truncate pr-4">{pagamento.paciente_nome}</div>}
                            <div className="w-[100px] pr-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${origemInfo.className}`}>
                                {origemInfo.label}
                              </span>
                            </div>
                            <div className="w-[180px] text-sm truncate pr-4" title={pagamento.descricao || ""}>{pagamento.descricao || "—"}</div>
                            <div className="w-[100px] text-sm font-semibold pr-4">R$ {pagamento.valor.toFixed(2)}</div>
                            <div className="w-[120px] text-sm truncate pr-4">{pagamento.forma_pagamento || "—"}</div>
                            <div className="w-[100px] text-xs pr-4">{formatDate(isPaid ? pagamento.data_pagamento : pagamento.data_vencimento ?? pagamento.data_pagamento)}</div>
                            <div className="w-[90px] pr-4">
                              <Badge variant={statusBadge[pagamento.status]?.variant ?? "secondary"} className="text-[10px] py-0">
                                {statusBadge[pagamento.status]?.label || pagamento.status}
                              </Badge>
                            </div>
                            <div className="w-[80px] text-right flex justify-end gap-1">
                              {isPaid && pagamento.source_table === "pagamentos" && (
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => {
                                  const numero = getReceiptNumber(pagamento.id, pagamento.created_at);
                                  const dataPgto = formatDate(pagamento.data_pagamento);
                                  const ref = pagamento.descricao || "Serviço";
                                  const pdf = await generateReceiptPDF({ numero, pacienteNome: pagamento.paciente_nome, cpf: "", descricao: pagamento.descricao || "Serviço", valor: pagamento.valor, formaPagamento: pagamento.forma_pagamento || "", dataPagamento: dataPgto, referencia: ref });
                                  pdf.save(`Recibo_${numero}.pdf`);
                                  toast({ title: "Recibo gerado!" });
                                }}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              {!isPaid && !isPatient && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setConfirmData({ data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento_id: "" });
                                    setConfirmDialog({ id: pagamento.id, source: pagamento.source_table, open: true });
                                  }}
                                >
                                  Confirmar
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="previsao" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Previsto</CardTitle>
                <CalendarClock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">R$ {previsaoKpis.totalPrevisto.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{previsaoPagamentos.length} pagamento(s) pendente(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">R$ {previsaoKpis.valorVencidos.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{previsaoKpis.countVencidos} pagamento(s) em atraso</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">A Vencer (30 dias)</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">R$ {previsaoKpis.valorAVencer30.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{previsaoKpis.countAVencer30} pagamento(s) nos próximos 30 dias</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
              ) : previsaoPagamentos.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-lg font-medium">Nenhum pagamento pendente</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="flex items-center px-4 py-3 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {!isPatient && <div className="flex-1 pr-4">Paciente</div>}
                      <div className="w-[100px] pr-2">Tipo</div>
                      <div className="w-[180px] pr-4">Descrição</div>
                      <div className="w-[100px] pr-4">Valor</div>
                      <div className="w-[120px] pr-4">Forma Pgto</div>
                      <div className="w-[110px] pr-4">Vencimento</div>
                      <div className="w-[110px] pr-4">Situação</div>
                      <div className="w-[100px] text-right">Ação</div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                      {previsaoPagamentos.map((pagamento) => {
                        const origemInfo = origemConfig[pagamento.origem_tipo] ?? origemConfig.manual;
                        const today = startOfDay(new Date());
                        const isOverdue = pagamento.data_vencimento
                          ? isBefore(startOfDay(new Date(pagamento.data_vencimento)), today)
                          : false;
                        return (
                          <div key={`${pagamento.source_table}-${pagamento.id}`} className={`border-b border-border/50 flex items-center px-4 py-3 hover:bg-muted/50 transition-colors ${isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}>
                            {!isPatient && <div className="flex-1 font-medium truncate pr-4">{pagamento.paciente_nome}</div>}
                            <div className="w-[100px] pr-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${origemInfo.className}`}>
                                {origemInfo.label}
                              </span>
                            </div>
                            <div className="w-[180px] text-sm truncate pr-4">{pagamento.descricao || "—"}</div>
                            <div className="w-[100px] text-sm font-semibold pr-4">R$ {pagamento.valor.toFixed(2)}</div>
                            <div className="w-[120px] text-sm truncate pr-4">{pagamento.forma_pagamento || "—"}</div>
                            <div className={`w-[110px] text-xs pr-4 ${isOverdue ? "text-destructive font-semibold" : ""}`}>
                              {formatDate(pagamento.data_vencimento)}
                            </div>
                            <div className="w-[110px] pr-4">
                              {isOverdue ? (
                                <Badge variant="destructive" className="text-[10px] py-0">Vencido</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] py-0">A vencer</Badge>
                              )}
                            </div>
                            <div className="w-[100px] text-right">
                              {!isPatient && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setConfirmData({ data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento_id: "" });
                                    setConfirmDialog({ id: pagamento.id, source: pagamento.source_table, open: true });
                                  }}
                                >
                                  Confirmar
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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

      {/* Confirm Payment Dialog */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data do Pagamento</Label>
              <Input type="date" value={confirmData.data_pagamento} onChange={(e) => setConfirmData(p => ({ ...p, data_pagamento: e.target.value }))} />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={confirmData.forma_pagamento_id} onValueChange={(v) => setConfirmData(p => ({ ...p, forma_pagamento_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
                <SelectContent>
                  {formasPagamentoList.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
              <Button
                disabled={!confirmData.data_pagamento || !confirmData.forma_pagamento_id || confirmPayment.isPending}
                onClick={() => confirmDialog && confirmPayment.mutate({
                  id: confirmDialog.id,
                  source: confirmDialog.source,
                  data_pagamento: confirmData.data_pagamento,
                  forma_pagamento_id: confirmData.forma_pagamento_id,
                })}
              >
                {confirmPayment.isPending ? "Confirmando..." : "Confirmar Pagamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financeiro;
