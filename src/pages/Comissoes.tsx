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
import { CommissionExtract } from "@/components/profissionais/CommissionExtract";
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

        <CommissionExtract />
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
          <CommissionExtract />
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
