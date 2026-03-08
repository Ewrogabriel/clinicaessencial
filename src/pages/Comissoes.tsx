import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Download, Calculator, Plus, Pencil, Trash2, Filter, Settings2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

// Removed hardcoded TIPOS_ATENDIMENTO — now loaded from modalidades table

const Comissoes = () => {
  const { user, isAdmin, isGestor, isProfissional } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isGestor;

  // State
  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));
  const [filterProf, setFilterProf] = useState("todos");
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [ruleForm, setRuleForm] = useState({
    profissional_id: "",
    tipo_atendimento: "geral",
    percentual: "",
    valor_fixo: "",
    observacoes: "",
    ativo: true,
  });

  // Queries
  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-comissoes"],
    queryFn: async () => {
      const { data } = await supabase.from("modalidades").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const tiposAtendimento = [
    { value: "geral", label: "Geral (Todos)" },
    ...modalidades.map((m: any) => ({ value: m.nome.toLowerCase(), label: m.nome })),
  ];

  const { data: profissionais = [] } = useQuery({
    queryKey: ["prof-for-comissoes"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids).order("nome");
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos-comissoes", mesRef],
    queryFn: async () => {
      const startDate = `${mesRef}-01T00:00:00`;
      const endMonth = new Date(parseInt(mesRef.split("-")[0]), parseInt(mesRef.split("-")[1]), 0);
      const endDate = `${mesRef}-${endMonth.getDate()}T23:59:59`;
      const { data } = await (supabase.from("agendamentos") as any)
        .select("*, pacientes(nome)")
        .eq("status", "realizado")
        .gte("data_horario", startDate)
        .lte("data_horario", endDate);
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: regrasComissao = [] } = useQuery({
    queryKey: ["regras-comissao"],
    queryFn: async () => {
      const { data } = await (supabase.from("regras_comissao" as any) as any)
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: canManage,
  });

  // Planos data for commission calculation (plan value / total sessions)
  const { data: planosData = [] } = useQuery({
    queryKey: ["planos-comissoes", mesRef],
    queryFn: async () => {
      const { data } = await (supabase.from("planos") as any).select("id, valor, total_sessoes");
      return data ?? [];
    },
    enabled: canManage,
  });

  const { data: minhasComissoes = [] } = useQuery({
    queryKey: ["my-commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase.from("commissions") as any)
        .select("*")
        .eq("professional_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isProfissional,
  });

  const { data: minhasRegras = [] } = useQuery({
    queryKey: ["my-commission-rules", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase.from("regras_comissao" as any) as any)
        .select("*")
        .eq("profissional_id", user.id)
        .eq("ativo", true);
      return data ?? [];
    },
    enabled: isProfissional,
  });

  // Mutations
  const saveRule = useMutation({
    mutationFn: async () => {
      if (!user || !ruleForm.profissional_id) throw new Error("Selecione um profissional");
      if (!ruleForm.percentual && !ruleForm.valor_fixo) throw new Error("Informe percentual ou valor fixo");

      const payload = {
        profissional_id: ruleForm.profissional_id,
        tipo_atendimento: ruleForm.tipo_atendimento,
        percentual: ruleForm.percentual ? parseFloat(ruleForm.percentual) : 0,
        valor_fixo: ruleForm.valor_fixo ? parseFloat(ruleForm.valor_fixo) : 0,
        observacoes: ruleForm.observacoes || null,
        ativo: ruleForm.ativo,
      };

      if (editingRule) {
        const { error } = await (supabase.from("regras_comissao" as any) as any)
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("regras_comissao" as any) as any)
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingRule ? "Regra atualizada!" : "Regra criada com sucesso!" });
      closeRuleDialog();
      queryClient.invalidateQueries({ queryKey: ["regras-comissao"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("regras_comissao" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Regra removida!" });
      queryClient.invalidateQueries({ queryKey: ["regras-comissao"] });
    },
  });

  // Helpers
  const closeRuleDialog = () => {
    setRuleDialogOpen(false);
    setEditingRule(null);
    setRuleForm({ profissional_id: "", tipo_atendimento: "geral", percentual: "", valor_fixo: "", observacoes: "", ativo: true });
  };

  const openEditRule = (regra: any) => {
    setEditingRule(regra);
    setRuleForm({
      profissional_id: regra.profissional_id,
      tipo_atendimento: regra.tipo_atendimento || "geral",
      percentual: regra.percentual ? String(regra.percentual) : "",
      valor_fixo: regra.valor_fixo ? String(regra.valor_fixo) : "",
      observacoes: regra.observacoes || "",
      ativo: regra.ativo,
    });
    setRuleDialogOpen(true);
  };

  const openCreateRule = (profId?: string) => {
    setEditingRule(null);
    setRuleForm({
      profissional_id: profId || "",
      tipo_atendimento: "geral",
      percentual: "",
      valor_fixo: "",
      observacoes: "",
      ativo: true,
    });
    setRuleDialogOpen(true);
  };

  const getProfName = (id: string) => profissionais.find((p: any) => p.user_id === id)?.nome || "—";
  const getTipoLabel = (v: string) => tiposAtendimento.find(t => t.value === v)?.label || v;

  const filteredRegras = filterProf === "todos"
    ? regrasComissao
    : regrasComissao.filter((r: any) => r.profissional_id === filterProf);

  // Commission calculation using rules
  const calcSummary = () => {
    const summary: Record<string, { nome: string; userId: string; totalAtendimentos: number; totalValor: number; comissao: number; regras: any[] }> = {};
    profissionais.forEach((p: any) => {
      const profRegras = regrasComissao.filter((r: any) => r.profissional_id === p.user_id && r.ativo);
      const atendimentos = agendamentos.filter((a: any) => a.profissional_id === p.user_id);

      let comissaoTotal = 0;
      let totalValor = 0;

      for (const a of atendimentos) {
        // For plan sessions, calculate average value (plan value / total sessions)
        let valorSessao = Number(a.valor_sessao || 0);
        if (valorSessao === 0 && a.observacoes && typeof a.observacoes === "string" && a.observacoes.startsWith("plano:")) {
          const planoId = a.observacoes.replace("plano:", "").trim();
          // Look up plan to get average value — we fetch planos in a separate query
          const plano = (planosData || []).find((pl: any) => pl.id === planoId);
          if (plano && plano.total_sessoes > 0) {
            valorSessao = Number(plano.valor) / plano.total_sessoes;
          }
        }
        totalValor += valorSessao;

        if (profRegras.length > 0) {
          const tipoRegra = profRegras.find((r: any) => r.tipo_atendimento === a.tipo_atendimento)
            || profRegras.find((r: any) => r.tipo_atendimento === "geral");
          if (tipoRegra) {
            const pct = Number(tipoRegra.percentual || 0);
            const fix = Number(tipoRegra.valor_fixo || 0);
            comissaoTotal += (valorSessao * pct / 100) + fix;
          }
        }
      }

      if (profRegras.length === 0) {
        // Fallback to profile rates
        const rate = Number(p.commission_rate || 0);
        const fixed = Number(p.commission_fixed || 0);
        comissaoTotal = (totalValor * rate / 100) + (fixed * atendimentos.length);
      }

      summary[p.user_id] = {
        nome: p.nome,
        userId: p.user_id,
        totalAtendimentos: atendimentos.length,
        totalValor,
        comissao: comissaoTotal,
        regras: profRegras,
      };
    });
    return Object.values(summary).filter(s => s.totalAtendimentos > 0);
  };

  const summary = calcSummary();

  const generateCommissionReceipt = (prof: typeof summary[0]) => {
    const doc = new jsPDF();
    const mesLabel = format(new Date(`${mesRef}-01`), "MMMM 'de' yyyy", { locale: ptBR });
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE COMISSÃO", 105, 25, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Essencial Fisio Pilates", 105, 35, { align: "center" });
    doc.setDrawColor(200);
    doc.line(20, 43, 190, 43);
    let y = 53;
    doc.setFontSize(11);
    doc.text(`Profissional: ${prof.nome}`, 20, y); y += 8;
    doc.text(`Referência: ${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}`, 20, y); y += 8;
    doc.text(`Total de Atendimentos: ${prof.totalAtendimentos}`, 20, y); y += 8;
    doc.text(`Valor Total Atendimentos: R$ ${prof.totalValor.toFixed(2)}`, 20, y); y += 8;
    doc.line(20, y, 190, y); y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`COMISSÃO: R$ ${prof.comissao.toFixed(2)}`, 20, y); y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy")}`, 20, y); y += 20;
    doc.line(20, y, 90, y);
    doc.text("Profissional", 55, y + 6, { align: "center" });
    doc.line(110, y, 190, y);
    doc.text("Clínica", 150, y + 6, { align: "center" });
    doc.save(`Comissao_${prof.nome.replace(/\s+/g, "_")}_${mesRef}.pdf`);
    toast({ title: "Recibo gerado!" });
  };

  // Professional-only view
  if (isProfissional && !canManage) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Minhas Comissões</h1>

        {minhasRegras.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Minhas Regras de Comissão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {minhasRegras.map((r: any) => (
                  <div key={r.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{getTipoLabel(r.tipo_atendimento)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {Number(r.percentual) > 0 && <p>{r.percentual}% sobre valor</p>}
                      {Number(r.valor_fixo) > 0 && <p>R$ {Number(r.valor_fixo).toFixed(2)} fixo/atend.</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {minhasComissoes.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">Nenhuma comissão registrada.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {minhasComissoes.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{format(new Date(c.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>R$ {Number(c.valor).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={c.status === "pago" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin/Gestor view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Comissões</h1>
          <p className="text-muted-foreground">Configure regras e calcule comissões por profissional</p>
        </div>
      </div>

      <Tabs defaultValue="regras" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regras" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Regras de Comissão
          </TabsTrigger>
          <TabsTrigger value="calculo" className="gap-2">
            <Calculator className="h-4 w-4" />
            Cálculo Mensal
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: Regras ===== */}
        <TabsContent value="regras" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterProf} onValueChange={setFilterProf}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filtrar por profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os profissionais</SelectItem>
                  {profissionais.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => openCreateRule(filterProf !== "todos" ? filterProf : undefined)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </div>

          {filteredRegras.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium">Nenhuma regra configurada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie regras para definir como cada profissional recebe comissão.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Tipo Atendimento</TableHead>
                      <TableHead>Percentual</TableHead>
                      <TableHead>Valor Fixo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegras.map((regra: any) => (
                      <TableRow key={regra.id}>
                        <TableCell className="font-medium">{getProfName(regra.profissional_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getTipoLabel(regra.tipo_atendimento)}</Badge>
                        </TableCell>
                        <TableCell>
                          {Number(regra.percentual) > 0 ? `${regra.percentual}%` : "—"}
                        </TableCell>
                        <TableCell>
                          {Number(regra.valor_fixo) > 0 ? `R$ ${Number(regra.valor_fixo).toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={regra.ativo ? "default" : "secondary"}>
                            {regra.ativo ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-muted-foreground text-sm">
                          {regra.observacoes || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditRule(regra)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteRule.mutate(regra.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Quick overview: professionals without rules */}
          {profissionais.length > 0 && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Profissionais sem regra configurada
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const profsWithRules = new Set(regrasComissao.map((r: any) => r.profissional_id));
                  const withoutRules = profissionais.filter((p: any) => !profsWithRules.has(p.user_id));
                  if (withoutRules.length === 0) return <p className="text-sm text-muted-foreground">Todos os profissionais possuem regras.</p>;
                  return (
                    <div className="flex flex-wrap gap-2">
                      {withoutRules.map((p: any) => (
                        <Button key={p.user_id} variant="outline" size="sm" onClick={() => openCreateRule(p.user_id)} className="gap-1">
                          <Plus className="h-3 w-3" />
                          {p.nome}
                        </Button>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== TAB: Cálculo ===== */}
        <TabsContent value="calculo" className="space-y-4 mt-4">
          <div className="flex gap-3 items-center">
            <Label className="text-sm whitespace-nowrap">Mês de referência:</Label>
            <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="w-auto" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Resumo — {format(new Date(`${mesRef}-01`), "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                Comissões calculadas com base nas regras configuradas. Profissionais sem regra usam taxa do perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {summary.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  Nenhum atendimento realizado neste mês.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-center">Atendimentos</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((s) => (
                      <TableRow key={s.userId}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell className="text-center">{s.totalAtendimentos}</TableCell>
                        <TableCell>R$ {s.totalValor.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-primary">R$ {s.comissao.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={s.regras.length > 0 ? "default" : "secondary"}>
                            {s.regras.length > 0 ? "Regra" : "Perfil"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => generateCommissionReceipt(s)} className="gap-1">
                            <Download className="h-3.5 w-3.5" /> Recibo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog nova/editar regra */}
      <Dialog open={ruleDialogOpen} onOpenChange={(o) => { if (!o) closeRuleDialog(); else setRuleDialogOpen(true); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra de Comissão" : "Nova Regra de Comissão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Profissional *</Label>
              <Select value={ruleForm.profissional_id} onValueChange={(v) => setRuleForm({ ...ruleForm, profissional_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Atendimento</Label>
              <Select value={ruleForm.tipo_atendimento} onValueChange={(v) => setRuleForm({ ...ruleForm, tipo_atendimento: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposAtendimento.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">"Geral" aplica a todos os tipos, a menos que haja regra específica.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Percentual (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={ruleForm.percentual}
                  onChange={(e) => setRuleForm({ ...ruleForm, percentual: e.target.value })}
                  placeholder="Ex: 30"
                />
              </div>
              <div>
                <Label>Valor Fixo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ruleForm.valor_fixo}
                  onChange={(e) => setRuleForm({ ...ruleForm, valor_fixo: e.target.value })}
                  placeholder="Ex: 25.00"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Percentual é aplicado sobre o valor da sessão. Valor fixo é somado por atendimento.
            </p>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={ruleForm.observacoes}
                onChange={(e) => setRuleForm({ ...ruleForm, observacoes: e.target.value })}
                placeholder="Notas sobre esta regra..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="rule-active">Regra ativa</Label>
              <Switch
                id="rule-active"
                checked={ruleForm.ativo}
                onCheckedChange={(c) => setRuleForm({ ...ruleForm, ativo: c })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={closeRuleDialog}>Cancelar</Button>
              <Button onClick={() => saveRule.mutate()} disabled={!ruleForm.profissional_id || saveRule.isPending}>
                {saveRule.isPending ? "Salvando..." : editingRule ? "Atualizar" : "Criar Regra"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Comissoes;
