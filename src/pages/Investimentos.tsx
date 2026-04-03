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
import { Textarea } from "@/components/ui/textarea";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, TrendingUp, Loader2, Wallet, PiggyBank, BarChart3,
  Pencil, Trash2, ArrowDownToLine, Upload, MoreHorizontal
} from "lucide-react";
import {
import { toast } from "sonner";
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TIPOS_INVESTIMENTO = [
  "CDB", "LCI", "LCA", "Tesouro Selic", "Tesouro IPCA+", "Tesouro Prefixado",
  "Poupança", "Fundo DI", "Fundo Multimercado", "Debênture", "Outro"
];

function calcIR(rendimentoBruto: number, dias: number): number {
  if (dias <= 180) return rendimentoBruto * 0.225;
  if (dias <= 360) return rendimentoBruto * 0.20;
  if (dias <= 720) return rendimentoBruto * 0.175;
  return rendimentoBruto * 0.15;
}

function calcIOF(rendimentoBruto: number, dias: number): number {
  if (dias >= 30) return 0;
  const iofTable = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
  const pct = (iofTable[dias] || 0) / 100;
  return rendimentoBruto * pct;
}

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
    rendimentoBruto, rendimentoLiquido, ir, iof,
    rentabilidadeBruta: (rendimentoBruto / valorAplicado) * 100,
    rentabilidadeLiquida: (rendimentoLiquido / valorAplicado) * 100,
  };
}

const defaultForm = {
  nome: "", tipo: "CDB", instituicao: "", valor_aplicado: "",
  data_aplicacao: format(new Date(), "yyyy-MM-dd"), data_vencimento: "",
  indexador: "CDI", percentual_indexador: "100", observacoes: "",
};

export default function Investimentos() {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [redeemTarget, setRedeemTarget] = useState<any>(null);
  const [redeemValue, setRedeemValue] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const CDI_ANUAL = 14.25;
  const IPCA_ANUAL = 4.5;

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["investments", activeClinicId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("investments") as any)
        .select("*")
        .eq("clinic_id", activeClinicId)
        .in("status", ["ativo", "resgatado"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const investmentData = useMemo(() => {
    return investments.filter((i: any) => i.status === "ativo").map((inv: any) => {
      const dias = differenceInDays(new Date(), new Date(inv.data_aplicacao));
      const percCDI = inv.percentual_indexador || 100;
      const sim = simulateInvestment(Number(inv.valor_aplicado), percCDI, CDI_ANUAL, dias);
      return { ...inv, ...sim, dias };
    });
  }, [investments]);

  const totalAplicado = useMemo(() => investmentData.reduce((s: number, i: any) => s + Number(i.valor_aplicado), 0), [investmentData]);
  const totalAtual = useMemo(() => investmentData.reduce((s: number, i: any) => s + i.valorAtual, 0), [investmentData]);
  const totalRendimento = useMemo(() => investmentData.reduce((s: number, i: any) => s + i.rendimentoLiquido, 0), [investmentData]);
  const ranking = useMemo(() => [...investmentData].sort((a: any, b: any) => b.rentabilidadeLiquida - a.rentabilidadeLiquida), [investmentData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
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
      };

      if (editingId) {
        const { error } = await (supabase.from("investments") as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("investments") as any).insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Investimento atualizado!" : "Investimento cadastrado!" });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("investments") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Investimento removido!" });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async () => {
      if (!redeemTarget) throw new Error("Selecione um investimento");
      const valor = parseFloat(redeemValue) || redeemTarget.valorAtual;
      const { error } = await (supabase.from("investments") as any).update({
        status: "resgatado",
        valor_resgate: valor,
        data_resgate: new Date().toISOString().split("T")[0],
      }).eq("id", redeemTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Investimento resgatado!" });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      setRedeemDialogOpen(false);
      setRedeemTarget(null);
      setRedeemValue("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const openEdit = (inv: any) => {
    setEditingId(inv.id);
    setForm({
      nome: inv.nome, tipo: inv.tipo, instituicao: inv.instituicao || "",
      valor_aplicado: String(inv.valor_aplicado),
      data_aplicacao: inv.data_aplicacao, data_vencimento: inv.data_vencimento || "",
      indexador: inv.indexador || "CDI", percentual_indexador: String(inv.percentual_indexador || 100),
      observacoes: inv.observacoes || "",
    });
    setDialogOpen(true);
  };

  const openRedeem = (inv: any) => {
    setRedeemTarget(inv);
    setRedeemValue(inv.valorAtual?.toFixed(2) || "");
    setRedeemDialogOpen(true);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      let imported = 0;
      for (const line of lines.slice(1)) {
        const parts = line.split(/[,;\t]/);
        if (parts.length >= 4) {
          const nome = parts[0]?.trim();
          const tipo = parts[1]?.trim() || "CDB";
          const valor = parseFloat(parts[2]?.trim()?.replace(/[R$\s.]/g, "").replace(",", "."));
          const data = parts[3]?.trim();
          if (nome && !isNaN(valor) && data) {
            await (supabase.from("investments") as any).insert({
              clinic_id: activeClinicId,
              nome, tipo, valor_aplicado: valor,
              data_aplicacao: data.includes("/") ? data.split("/").reverse().join("-") : data,
              indexador: "CDI", percentual_indexador: 100,
              created_by: user?.id,
            });
            imported++;
          }
        }
      }
      toast({ title: `${imported} investimento(s) importado(s)!` });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      setImportDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-muted-foreground">Gestão de aplicações financeiras com cálculo automático.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button className="gap-2" onClick={() => { setEditingId(null); setForm(defaultForm); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
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
            <p className="text-xs text-muted-foreground">{investmentData.length} aplicação(ões) ativas</p>
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
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg font-bold text-muted-foreground w-8">#{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inv.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.tipo} • {inv.instituicao || "—"} • {inv.percentual_indexador}% CDI • {inv.dias} dias
                      </p>
                    </div>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-sm font-semibold text-emerald-600">{inv.rentabilidadeLiquida.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground">R$ {inv.rendimentoLiquido.toFixed(2)} líquido</p>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>IR: R$ {inv.ir.toFixed(2)}</span>
                      <span>IOF: R$ {inv.iof.toFixed(2)}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(inv)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openRedeem(inv)}>
                        <ArrowDownToLine className="h-4 w-4 mr-2" /> Resgatar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(inv.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resgatados */}
      {investments.filter((i: any) => i.status === "resgatado").length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Investimentos Resgatados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {investments.filter((i: any) => i.status === "resgatado").map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{inv.nome}</p>
                    <p className="text-xs text-muted-foreground">{inv.tipo} • Resgatado em {inv.data_resgate ? format(new Date(inv.data_resgate), "dd/MM/yyyy") : "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">Aplicado: R$ {Number(inv.valor_aplicado).toFixed(2)}</p>
                    {inv.valor_resgate && <p className="text-sm text-emerald-600 font-medium">Resgatado: R$ {Number(inv.valor_resgate).toFixed(2)}</p>}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Investimento" : "Novo Investimento"}</DialogTitle>
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
                <Input type="number" value={form.valor_aplicado} onChange={e => setForm(p => ({ ...p, valor_aplicado: e.target.value }))} />
              </div>
              <div>
                <Label>% do Indexador</Label>
                <Input type="number" value={form.percentual_indexador} onChange={e => setForm(p => ({ ...p, percentual_indexador: e.target.value }))} />
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
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
            </div>
            <Button className="w-full gap-2" onClick={() => saveMutation.mutate()} disabled={!form.nome || !form.valor_aplicado || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Salvar Alterações" : "Cadastrar Investimento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redeem Dialog */}
      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resgatar Investimento</DialogTitle>
          </DialogHeader>
          {redeemTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
                <p><strong>{redeemTarget.nome}</strong></p>
                <p>Aplicado: R$ {Number(redeemTarget.valor_aplicado).toFixed(2)}</p>
                <p>Valor estimado atual: R$ {redeemTarget.valorAtual?.toFixed(2)}</p>
              </div>
              <div>
                <Label>Valor do Resgate (R$)</Label>
                <Input type="number" value={redeemValue} onChange={(e) => setRedeemValue(e.target.value)} />
              </div>
              <Button className="w-full gap-2" onClick={() => redeemMutation.mutate()} disabled={redeemMutation.isPending}>
                {redeemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                Confirmar Resgate
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Extrato de Investimentos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie um arquivo CSV ou Excel com as colunas: <strong>Nome, Tipo, Valor, Data Aplicação</strong> (separados por vírgula, ponto-e-vírgula ou tab).
            </p>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <label className="cursor-pointer">
                <Button variant="outline" className="gap-2" asChild>
                  <span><Upload className="h-4 w-4" /> Selecionar Arquivo</span>
                </Button>
                <input type="file" className="hidden" accept=".csv,.xlsx,.txt" onChange={handleImportFile} />
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
