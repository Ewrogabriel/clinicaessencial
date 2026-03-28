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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/modules/shared/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, TrendingUp, Loader2, Wallet, PiggyBank, BarChart3, Calculator
} from "lucide-react";

const TIPOS_INVESTIMENTO = [
  "CDB", "LCI", "LCA", "Tesouro Selic", "Tesouro IPCA+", "Tesouro Prefixado",
  "Poupança", "Fundo DI", "Fundo Multimercado", "Debênture", "Outro"
];

// IR regressivo: 22.5% (até 180d), 20% (181-360), 17.5% (361-720), 15% (>720)
function calcIR(rendimentoBruto: number, dias: number): number {
  if (dias <= 180) return rendimentoBruto * 0.225;
  if (dias <= 360) return rendimentoBruto * 0.20;
  if (dias <= 720) return rendimentoBruto * 0.175;
  return rendimentoBruto * 0.15;
}

// IOF regressivo (0% após 30 dias, tabela decrescente)
function calcIOF(rendimentoBruto: number, dias: number): number {
  if (dias >= 30) return 0;
  const iofTable = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
  const pct = (iofTable[dias] || 0) / 100;
  return rendimentoBruto * pct;
}

// Simulate CDI-based investment
function simulateInvestment(valorAplicado: number, percCDI: number, cdiAnual: number, diasCorridos: number) {
  const taxaDiaria = Math.pow(1 + cdiAnual / 100, 1 / 252) - 1;
  const taxaEfetiva = taxaDiaria * (percCDI / 100);
  const diasUteis = Math.round(diasCorridos * 252 / 365);
  const montanteBruto = valorAplicado * Math.pow(1 + taxaEfetiva, diasUteis);
  const rendimentoBruto = montanteBruto - valorAplicado;
  const ir = calcIR(rendimentoBruto, diasCorridos);
  const iof = calcIOF(rendimentoBruto, diasCorridos);
  const rendimentoLiquido = rendimentoBruto - ir - iof;
  return {
    valorAtual: valorAplicado + rendimentoLiquido,
    rendimentoBruto,
    rendimentoLiquido,
    ir,
    iof,
    rentabilidadeBruta: (rendimentoBruto / valorAplicado) * 100,
    rentabilidadeLiquida: (rendimentoLiquido / valorAplicado) * 100,
  };
}

export default function Investimentos() {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "", tipo: "CDB", instituicao: "", valor_aplicado: "",
    data_aplicacao: format(new Date(), "yyyy-MM-dd"), data_vencimento: "",
    indexador: "CDI", percentual_indexador: "100", observacoes: "",
  });

  // CDI atual (default fallback)
  const CDI_ANUAL = 14.25; // Rate approx Q1 2026
  const IPCA_ANUAL = 4.5;

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["investments", activeClinicId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("investments") as any)
        .select("*")
        .eq("clinic_id", activeClinicId)
        .eq("status", "ativo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  // Calculated data for each investment
  const investmentData = useMemo(() => {
    return investments.map((inv: any) => {
      const dias = differenceInDays(new Date(), new Date(inv.data_aplicacao));
      const percCDI = inv.percentual_indexador || 100;
      const sim = simulateInvestment(Number(inv.valor_aplicado), percCDI, CDI_ANUAL, dias);
      return { ...inv, ...sim, dias };
    });
  }, [investments]);

  const totalAplicado = useMemo(() => investmentData.reduce((s: number, i: any) => s + Number(i.valor_aplicado), 0), [investmentData]);
  const totalAtual = useMemo(() => investmentData.reduce((s: number, i: any) => s + i.valorAtual, 0), [investmentData]);
  const totalRendimento = useMemo(() => investmentData.reduce((s: number, i: any) => s + i.rendimentoLiquido, 0), [investmentData]);

  // Ranking by rentabilidade líquida
  const ranking = useMemo(() => [...investmentData].sort((a: any, b: any) => b.rentabilidadeLiquida - a.rentabilidadeLiquida), [investmentData]);

  const createInvestment = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("investments") as any).insert({
        clinic_id: activeClinicId,
        nome: form.nome,
        tipo: form.tipo,
        instituicao: form.instituicao,
        valor_aplicado: parseFloat(form.valor_aplicado),
        data_aplicacao: form.data_aplicacao,
        data_vencimento: form.data_vencimento || null,
        indexador: form.indexador,
        percentual_indexador: parseFloat(form.percentual_indexador),
        observacoes: form.observacoes,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Investimento cadastrado!" });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      setDialogOpen(false);
      setForm({ nome: "", tipo: "CDB", instituicao: "", valor_aplicado: "", data_aplicacao: format(new Date(), "yyyy-MM-dd"), data_vencimento: "", indexador: "CDI", percentual_indexador: "100", observacoes: "" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-muted-foreground">Gestão de aplicações financeiras com cálculo automático.</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Novo Investimento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Total Aplicado</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {totalAplicado.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{investments.length} aplicação(ões)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Valor Atual</CardTitle>
            <PiggyBank className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">R$ {totalAtual.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">CDI: {CDI_ANUAL}% a.a. | IPCA: {IPCA_ANUAL}% a.a.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Rendimento Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">R$ {totalRendimento.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Após IR e IOF</p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking */}
      {ranking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Ranking de Aplicações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {ranking.map((inv: any, idx: number) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-8">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{inv.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.tipo} • {inv.instituicao || "—"} • {inv.percentual_indexador}% CDI • {inv.dias} dias
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">{inv.rentabilidadeLiquida.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground">R$ {inv.rendimentoLiquido.toFixed(2)} líquido</p>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>IR: R$ {inv.ir.toFixed(2)}</span>
                      <span>IOF: R$ {inv.iof.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="text-center py-8 text-muted-foreground">Carregando...</div>}
      {!isLoading && investments.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <PiggyBank className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum investimento cadastrado.</p>
          </CardContent>
        </Card>
      )}

      {/* New Investment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Investimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Aplicação</Label>
              <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="CDB Banco Inter 120%" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_INVESTIMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Instituição</Label>
                <Input value={form.instituicao} onChange={e => setForm(p => ({ ...p, instituicao: e.target.value }))} placeholder="Nubank" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Aplicado (R$)</Label>
                <Input type="number" value={form.valor_aplicado} onChange={e => setForm(p => ({ ...p, valor_aplicado: e.target.value }))} placeholder="10000" />
              </div>
              <div>
                <Label>% do Indexador</Label>
                <Input type="number" value={form.percentual_indexador} onChange={e => setForm(p => ({ ...p, percentual_indexador: e.target.value }))} placeholder="100" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da Aplicação</Label>
                <Input type="date" value={form.data_aplicacao} onChange={e => setForm(p => ({ ...p, data_aplicacao: e.target.value }))} />
              </div>
              <div>
                <Label>Vencimento (opcional)</Label>
                <Input type="date" value={form.data_vencimento} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full gap-2" onClick={() => createInvestment.mutate()} disabled={!form.nome || !form.valor_aplicado || createInvestment.isPending}>
              {createInvestment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cadastrar Investimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
