/**
 * CommissionRulesConfig
 *
 * Tela de configuração completa das regras de comissão.
 * Permite:
 *  - Definir % padrão por profissional
 *  - Criar regras específicas por modalidade / tipo de sessão
 *  - Configurar % pago em faltas do paciente
 *  - Ativar/desativar regras
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Pencil, Trash2, Info, UserCircle2, Percent,
  DollarSign, ShieldCheck, BookOpen, Dumbbell,
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ──────────────────────────────────────────────
interface CommissionRule {
  id: string;
  clinic_id: string | null;
  professional_id: string;
  modalidade: string | null;
  tipo_sessao: string | null;
  tipo_calculo: "percentual" | "fixo";
  percentage: number;
  valor_fixo: number;
  missed_session_pct: number;
  ativo: boolean;
  descricao: string | null;
}

const EMPTY_RULE: Omit<CommissionRule, "id" | "clinic_id"> = {
  professional_id: "",
  modalidade: null,
  tipo_sessao: null,
  tipo_calculo: "percentual",
  percentage: 40,
  valor_fixo: 0,
  missed_session_pct: 0.5,
  ativo: true,
  descricao: null,
};

// ─── Componente ─────────────────────────────────────────
export function CommissionRulesConfig() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<CommissionRule> | null>(null);

  // Buscar profissionais
  const { data: profissionais = [] } = useQuery({
    queryKey: ["prof-for-commission-rules"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, nome_completo, nome, commission_rate").in("user_id", ids).order("nome");
      return data ?? [];
    },
    enabled: !!activeClinicId,
  });

  // Buscar modalidades
  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-for-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  // Buscar regras
  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["commission-rules", activeClinicId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("commission_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CommissionRule[];
    },
    enabled: !!activeClinicId,
  });

  // Buscar política de cancelamento/falta da clínica
  const { data: policy } = useQuery({
    queryKey: ["cancellation-policy", activeClinicId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("cancellation_policies")
        .select("id, missed_session_pct, clinic_id")
        .maybeSingle();
      return data;
    },
    enabled: !!activeClinicId,
  });

  // Upsert de política de falta global
  const savePolicyMutation = useMutation({
    mutationFn: async (missedPct: number) => {
      if (policy?.id) {
        const { error } = await (supabase as any)
          .from("cancellation_policies")
          .update({ missed_session_pct: missedPct, clinic_id: activeClinicId })
          .eq("id", policy.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("cancellation_policies")
          .insert({ missed_session_pct: missedPct, clinic_id: activeClinicId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cancellation-policy"] });
      toast.success("Política de faltas atualizada!");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  // Salvar regra (create/update)
  const saveRuleMutation = useMutation({
    mutationFn: async (rule: Partial<CommissionRule>) => {
      const payload = {
        clinic_id: activeClinicId,
        professional_id: rule.professional_id,
        modalidade: rule.modalidade || null,
        tipo_sessao: rule.tipo_sessao || null,
        tipo_calculo: rule.tipo_calculo ?? "percentual",
        percentage: Number(rule.percentage ?? 0),
        valor_fixo: Number(rule.valor_fixo ?? 0),
        missed_session_pct: Number(rule.missed_session_pct ?? 0.5),
        ativo: rule.ativo ?? true,
        descricao: rule.descricao || null,
      };

      if (rule.id) {
        const { error } = await (supabase as any)
          .from("commission_rules")
          .update(payload)
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("commission_rules")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
      queryClient.invalidateQueries({ queryKey: ["regras-comissao"] });
      setDialogOpen(false);
      setEditingRule(null);
      toast.success("Regra salva com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao salvar regra", { description: e.message }),
  });

  // Deletar regra
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("commission_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
      queryClient.invalidateQueries({ queryKey: ["regras-comissao"] });
      toast.success("Regra removida.");
    },
    onError: (e: Error) => toast.error("Erro ao remover regra", { description: e.message }),
  });

  // Toggle ativo
  const toggleActive = (rule: CommissionRule) => {
    saveRuleMutation.mutate({ ...rule, ativo: !rule.ativo });
  };

  const openNew = () => {
    setEditingRule({ ...EMPTY_RULE });
    setDialogOpen(true);
  };

  const openEdit = (rule: CommissionRule) => {
    setEditingRule({ ...rule });
    setDialogOpen(true);
  };

  const getProfName = (id: string) => {
    const p = profissionais.find((p: any) => p.user_id === id);
    return p?.nome_completo ?? p?.nome ?? id;
  };

  const [missedPctLocal, setMissedPctLocal] = useState<string>("");
  const globalMissedPct = policy?.missed_session_pct ?? 0.5;

  return (
    <div className="space-y-6">
      {/* ── Política Global de Faltas ── */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Política Global de Faltas
          </CardTitle>
          <CardDescription>
            Percentual da comissão pago ao profissional quando o paciente <strong>falta</strong> sem aviso.
            Pode ser sobrescrito regra a regra abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">% pago na falta do paciente</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  className="w-28"
                  defaultValue={Math.round(globalMissedPct * 100)}
                  onChange={(e) => setMissedPctLocal(e.target.value)}
                  placeholder="50"
                />
                <span className="text-muted-foreground text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ex: 50% = o profissional recebe metade da comissão em faltas
              </p>
            </div>
            <Button
              onClick={() => {
                const val = parseFloat(missedPctLocal) / 100;
                if (isNaN(val) || val < 0 || val > 1) {
                  toast.error("Digite um valor entre 0 e 100");
                  return;
                }
                savePolicyMutation.mutate(val);
              }}
              disabled={savePolicyMutation.isPending || !missedPctLocal}
              size="sm"
              className="mb-0.5"
            >
              Salvar Política
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Regras por Profissional/Modalidade ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Regras de Comissão
              </CardTitle>
              <CardDescription className="mt-1">
                Defina percentuais por profissional. Regras mais específicas (com modalidade/tipo) têm prioridade.
              </CardDescription>
            </div>
            <Button onClick={openNew} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova Regra
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando regras...</div>
          ) : regras.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Percent className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhuma regra configurada</p>
              <p className="text-sm mt-1">Clique em "Nova Regra" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Tipo Sessão</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Em Falta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regras.map((rule) => (
                  <TableRow key={rule.id} className={!rule.ativo ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <UserCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        {getProfName(rule.professional_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.modalidade ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Dumbbell className="h-3 w-3" /> {rule.modalidade}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Todas</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.tipo_sessao ? (
                        <Badge variant="secondary" className="text-xs capitalize">{rule.tipo_sessao}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Ambos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.tipo_calculo === "percentual" ? (
                        <span className="font-semibold text-primary">{Number(rule.percentage).toFixed(0)}%</span>
                      ) : (
                        <span className="font-semibold text-primary">R$ {Number(rule.valor_fixo).toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-amber-600 font-medium text-sm">
                        {Math.round(Number(rule.missed_session_pct) * 100)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.ativo}
                        onCheckedChange={() => toggleActive(rule)}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {rule.descricao && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{rule.descricao}</TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(rule)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Remover esta regra?")) deleteRuleMutation.mutate(rule.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Legenda de prioridade ── */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Como as regras funcionam:</p>
              <p>1. Regras com <strong>modalidade + tipo de sessão</strong> específicos têm máxima prioridade.</p>
              <p>2. Regras com apenas <strong>modalidade</strong> ou apenas <strong>tipo de sessão</strong> têm prioridade média.</p>
              <p>3. Regras sem filtros (gerais) são aplicadas quando nenhuma regra específica bate.</p>
              <p>4. A <strong>política global de faltas</strong> é usada quando a regra não define o % de falta.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Dialog de criação/edição ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingRule(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              {editingRule?.id ? "Editar Regra de Comissão" : "Nova Regra de Comissão"}
            </DialogTitle>
          </DialogHeader>

          {editingRule && (
            <div className="space-y-4">
              {/* Profissional */}
              <div className="space-y-1.5">
                <Label>Profissional *</Label>
                <Select
                  value={editingRule.professional_id || ""}
                  onValueChange={(v) => setEditingRule(r => ({ ...r!, professional_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o profissional..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profissionais.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.nome_completo ?? p.nome}
                        {p.commission_rate && (
                          <span className="text-muted-foreground ml-2 text-xs">(padrão: {p.commission_rate}%)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Filtros opcionais */}
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Filtros (opcional — deixe em branco para regra geral)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Modalidade</Label>
                  <Select
                    value={editingRule.modalidade ?? "__todas__"}
                    onValueChange={(v) => setEditingRule(r => ({ ...r!, modalidade: v === "__todas__" ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todas__">Todas as modalidades</SelectItem>
                      {modalidades.map((m: any) => (
                        <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de Sessão</Label>
                  <Select
                    value={editingRule.tipo_sessao ?? "__ambos__"}
                    onValueChange={(v) => setEditingRule(r => ({ ...r!, tipo_sessao: v === "__ambos__" ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ambos__">Individual e Grupo</SelectItem>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="grupo">Grupo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Cálculo */}
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cálculo da Comissão</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de Cálculo</Label>
                  <Select
                    value={editingRule.tipo_calculo ?? "percentual"}
                    onValueChange={(v) => setEditingRule(r => ({ ...r!, tipo_calculo: v as "percentual" | "fixo" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentual">
                        <span className="flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Percentual (%)</span>
                      </SelectItem>
                      <SelectItem value="fixo">
                        <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Valor Fixo (R$)</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  {editingRule.tipo_calculo === "percentual" ? (
                    <>
                      <Label>Percentual (%)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={editingRule.percentage ?? 40}
                          onChange={(e) => setEditingRule(r => ({ ...r!, percentage: parseFloat(e.target.value) }))}
                        />
                        <span className="text-muted-foreground text-sm shrink-0">%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Label>Valor Fixo (R$)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm shrink-0">R$</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={editingRule.valor_fixo ?? 0}
                          onChange={(e) => setEditingRule(r => ({ ...r!, valor_fixo: parseFloat(e.target.value) }))}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* % em falta */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  % da comissão pago em <strong>falta</strong> do paciente
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Ex: 50% = o profissional recebe metade da comissão quando o paciente falta.
                      0% = não recebe nada em faltas.
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    className="w-28"
                    value={Math.round((editingRule.missed_session_pct ?? 0.5) * 100)}
                    onChange={(e) => setEditingRule(r => ({
                      ...r!,
                      missed_session_pct: parseFloat(e.target.value) / 100,
                    }))}
                  />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <Label>Descrição / Observação (opcional)</Label>
                <Textarea
                  value={editingRule.descricao ?? ""}
                  onChange={(e) => setEditingRule(r => ({ ...r!, descricao: e.target.value }))}
                  placeholder="Ex: Regra especial negociada em contrato..."
                  className="min-h-[60px]"
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-3">
                <Switch
                  id="rule-ativo"
                  checked={editingRule.ativo ?? true}
                  onCheckedChange={(v) => setEditingRule(r => ({ ...r!, ativo: v }))}
                />
                <Label htmlFor="rule-ativo" className="cursor-pointer">Regra ativa</Label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingRule(null); }}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => saveRuleMutation.mutate(editingRule as CommissionRule)}
                  disabled={saveRuleMutation.isPending || !editingRule.professional_id}
                  className="gap-2"
                >
                  {saveRuleMutation.isPending ? "Salvando..." : "Salvar Regra"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
