import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, DollarSign, TrendingUp, AlertCircle, CheckCircle, Download, Send, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { generateReceiptPDF, getReceiptNumber } from "@/lib/generateReceiptPDF";
import Despesas from "./Despesas";
import { CommissionExtract } from "@/components/profissionais/CommissionExtract";

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

const Financeiro = () => {
  const { user, isPatient, clinicId } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [filterMes, setFilterMes] = useState("");
  const [filterForma, setFilterForma] = useState("all");
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
    pacientes: { nome: string } | null;
  }

  const { data: pagamentos = [], isLoading } = useQuery<PagamentoRow[]>({
    queryKey: ["pagamentos"],
    queryFn: async () => {
      const query = supabase
        .from("pagamentos")
        .select("*, pacientes(nome)");

      const { data, error } = await query.order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("pacientes").select("id, nome").eq("status", "ativo").order("nome");
      return data ?? [];
    },
  });

  const { data: despesasForDre = [] } = useQuery({
    queryKey: ["despesas-dre"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("valor, status");
      if (error) throw error;
      return data;
    },
    enabled: !isPatient,
  });

  const { data: comissoesForDre = [] } = useQuery({
    queryKey: ["comissoes-dre"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commissions").select("valor");
      if (error) throw error;
      return data;
    },
    enabled: !isPatient,
  });

  const createPagamento = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("pagamentos") as any).insert({
        paciente_id: formData.paciente_id,
        profissional_id: user.id,
        plano_id: formData.plano_id || null,
        valor: parseFloat(formData.valor) || 0,
        data_pagamento: formData.data_pagamento,
        data_vencimento: formData.data_vencimento || null,
        forma_pagamento: formData.forma_pagamento,
        status: formData.status,
        descricao: formData.descricao || null,
        observacoes: formData.observacoes || null,
        created_by: user.id,
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

  const totalRecebido = pagamentos.filter((p) => p.status === "pago").reduce((sum, p) => sum + Number(p.valor), 0);
  const totalPendente = pagamentos.filter((p) => p.status === "pendente").reduce((sum, p) => sum + Number(p.valor), 0);
  const totalDespesas = (despesasForDre || []).filter((d) => d.status === "pago").reduce((sum, d) => sum + Number(d.valor), 0);
  const totalComissoes = (comissoesForDre || []).reduce((sum, c) => sum + Number(c.valor), 0);
  
  const countPagos = pagamentos.filter((p) => p.status === 'pago').length;
  const countPendentes = pagamentos.filter((p) => p.status === 'pendente').length;

  const lucroLiquido = totalRecebido - totalDespesas - totalComissoes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-[Plus_Jakarta_Sans]">{isPatient ? "Meus Pagamentos" : "Financeiro"}</h1>
        {!isPatient && (
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Pagamento
              </Button>
            </DialogTrigger>
            {/* DialogContent is rendered below */}
          </Dialog>
        )}
      </div>

      {/* KPI */}
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

      {/* Tabs */}
      <Tabs defaultValue="fluxo" className="space-y-4">
        {!isPatient && (
          <TabsList className="grid w-full grid-cols-4 lg:w-[560px]">
            <TabsTrigger value="fluxo">Pagamentos</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
            <TabsTrigger value="comissoes">Extrato Comissões</TabsTrigger>
            <TabsTrigger value="dre">DRE Simples</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="fluxo" className="space-y-4">
          {/* Filters */}
          {!isPatient && (
            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterMes} onValueChange={setFilterMes}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => {
                    const d = subMonths(new Date(), i);
                    return (
                      <SelectItem key={i} value={format(d, "yyyy-MM")}>
                        {format(d, "MMMM yyyy", { locale: ptBR })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={filterForma} onValueChange={setFilterForma}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas as formas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as formas</SelectItem>
                  {Object.entries(formaLabel).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filterMes || filterForma !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterMes(""); setFilterForma("all"); }}>
                  Limpar filtros
                </Button>
              )}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {(() => {
                let filtered = pagamentos || [];
                if (filterMes && filterMes !== "all") {
                  filtered = filtered.filter((p) => p.data_pagamento?.startsWith(filterMes));
                }
                if (filterForma && filterForma !== "all") {
                  filtered = filtered.filter((p) => p.forma_pagamento === filterForma);
                }
                
                if (isLoading) {
                  return <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>;
                }
                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center py-16 text-muted-foreground">
                      <DollarSign className="h-12 w-12 mb-4 opacity-40" />
                      <p className="text-lg font-medium">Nenhum pagamento encontrado</p>
                      {!isPatient && !filterMes && filterForma === "all" && (
                        <Button className="mt-4" onClick={() => setFormOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" /> Registrar pagamento
                        </Button>
                      )}
                    </div>
                  );
                }
                return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!isPatient && <TableHead>Paciente</TableHead>}
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Data Pgto</TableHead>
                       <TableHead>Status</TableHead>
                       <TableHead className="text-right">Recibo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((pagamento) => (
                      <TableRow key={pagamento.id}>
                        {!isPatient && <TableCell className="font-medium">{pagamento.pacientes?.nome ?? "—"}</TableCell>}
                        <TableCell>{pagamento.descricao || "—"}</TableCell>
                        <TableCell>R$ {Number(pagamento.valor).toFixed(2)}</TableCell>
                        <TableCell>{pagamento.forma_pagamento ? formaLabel[pagamento.forma_pagamento] || pagamento.forma_pagamento : "—"}</TableCell>
                        <TableCell>
                          {pagamento.data_vencimento ? format(new Date(pagamento.data_vencimento), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          {pagamento.status === 'pago' ? format(new Date(pagamento.data_pagamento), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pagamento.status === 'pago' ? 'default' : 'destructive'}>
                            {statusBadge[pagamento.status]?.label || pagamento.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {pagamento.status === "pago" && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" className="h-8" onClick={async () => {
                                const numero = getReceiptNumber(pagamento.id, pagamento.created_at);
                                const dataPgto = format(new Date(pagamento.data_pagamento), "dd/MM/yyyy");
                                const ref = pagamento.data_vencimento
                                  ? format(new Date(pagamento.data_vencimento), "MMMM/yyyy", { locale: ptBR })
                                  : pagamento.descricao || "Serviço";
                                const pdf = await generateReceiptPDF({
                                  numero,
                                  pacienteNome: pagamento.pacientes?.nome || "—",
                                  cpf: "",
                                  descricao: pagamento.descricao || "Serviço de Pilates/Fisioterapia",
                                  valor: Number(pagamento.valor),
                                  formaPagamento: pagamento.forma_pagamento || "",
                                  dataPagamento: dataPgto,
                                  referencia: ref.charAt(0).toUpperCase() + ref.slice(1),
                                });
                                pdf.save(`Recibo_${numero}.pdf`);
                                toast({ title: "Recibo gerado!" });
                              }}>
                                <Download className="h-3.5 w-3.5 mr-1" /> PDF
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dre" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demonstrativo de Resultados (DRE)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-green-600">(+) Receita Operacional (Pagamentos Recebidos)</span>
                  <span className="font-bold text-green-600">R$ {totalRecebido.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-red-600">(-) Despesas Operacionais (Custos Fixos/Variáveis)</span>
                  <span className="font-bold text-red-600">R$ {totalDespesas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-red-600">(-) Comissões Profissionais</span>
                  <span className="font-bold text-red-600">R$ {totalComissoes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-4 bg-muted/50 px-4 rounded-lg">
                  <span className="text-lg font-bold">(=) LUCRO LÍQUIDO NO PERÍODO</span>
                  <span className={`text-xl font-black ${lucroLiquido >= 0 ? "text-primary" : "text-destructive"}`}>
                    R$ {lucroLiquido.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-4 italic">
                  * Este DRE é baseado em contas pagas (regime de caixa). Pagamentos pendentes não são contabilizados aqui.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="despesas" className="space-y-4">
          <Despesas />
        </TabsContent>

        <TabsContent value="comissoes" className="space-y-4">
          <CommissionExtract />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Novo Pagamento</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-hidden">
          <div className="space-y-4 pr-4">
            <div>
              <Label>Paciente</Label>
              <Select value={formData.paciente_id} onValueChange={(v) => setFormData(p => ({ ...p, paciente_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(pacientes || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
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
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
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
              <div>
                <Label>Data Pagamento</Label>
                <Input type="date" value={formData.data_pagamento} onChange={(e) => setFormData(p => ({ ...p, data_pagamento: e.target.value }))} />
              </div>
              <div>
                <Label>Vencimento (opcional)</Label>
                <Input type="date" value={formData.data_vencimento} onChange={(e) => setFormData(p => ({ ...p, data_vencimento: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input placeholder="Ex: Pacote 10 sessões Pilates" value={formData.descricao} onChange={(e) => setFormData(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea placeholder="Observações..." value={formData.observacoes} onChange={(e) => setFormData(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
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
