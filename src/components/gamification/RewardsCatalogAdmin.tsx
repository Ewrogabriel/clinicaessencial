import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Gift, Plus, Edit2, Trash2, Loader2, Star, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Reward {
  id: string;
  nome: string;
  descricao: string | null;
  pontos_necessarios: number;
  tipo: string;
  valor_desconto: number;
  percentual_desconto: number | null;
  ativo: boolean;
  limite_resgates: number | null;
  validade_dias: number | null;
  created_at: string;
}

interface Redemption {
  id: string;
  reward_id: string;
  paciente_id: string;
  pontos_gastos: number;
  status: string;
  codigo_desconto: string | null;
  utilizado_em: string | null;
  expira_em: string | null;
  created_at: string;
  rewards_catalog?: { nome: string };
  pacientes?: { nome: string };
}

export function RewardsCatalogAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    pontos_necessarios: 100,
    tipo: "desconto_percentual",
    valor_desconto: 0,
    percentual_desconto: 10,
    ativo: true,
    limite_resgates: null as number | null,
    validade_dias: 30,
  });

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ["rewards-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards_catalog")
        .select("*")
        .order("pontos_necessarios");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ["rewards-redemptions-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards_redemptions")
        .select("*, rewards_catalog(nome), pacientes(nome)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Redemption[];
    },
  });

  const saveReward = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        created_by: user?.id,
      };
      if (form.tipo === "desconto_percentual") {
        payload.valor_desconto = 0;
      } else {
        payload.percentual_desconto = null;
      }

      if (editing) {
        const { error } = await supabase.from("rewards_catalog").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rewards_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards-catalog"] });
      toast.success(editing ? "Recompensa atualizada!" : "Recompensa criada!");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteReward = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rewards_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards-catalog"] });
      toast.success("Recompensa excluída");
    },
  });

  const updateRedemptionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "utilizado") update.utilizado_em = new Date().toISOString();
      const { error } = await supabase.from("rewards_redemptions").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards-redemptions-admin"] });
      toast.success("Status atualizado");
    },
  });

  const resetForm = () => {
    setForm({
      nome: "", descricao: "", pontos_necessarios: 100, tipo: "desconto_percentual",
      valor_desconto: 0, percentual_desconto: 10, ativo: true, limite_resgates: null, validade_dias: 30,
    });
    setEditing(null);
  };

  const openEdit = (r: Reward) => {
    setEditing(r);
    setForm({
      nome: r.nome,
      descricao: r.descricao || "",
      pontos_necessarios: r.pontos_necessarios,
      tipo: r.tipo,
      valor_desconto: r.valor_desconto,
      percentual_desconto: r.percentual_desconto || 10,
      ativo: r.ativo,
      limite_resgates: r.limite_resgates,
      validade_dias: r.validade_dias || 30,
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> Catálogo de Recompensas
          </h2>
          <p className="text-sm text-muted-foreground">Configure trocas de pontos por descontos</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Recompensa
        </Button>
      </div>

      {/* Rewards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-32 bg-muted/30" />
          ))
        ) : rewards.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Gift className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma recompensa configurada</p>
          </div>
        ) : (
          rewards.map((r: Reward) => (
            <Card key={r.id} className={!r.ativo ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{r.nome}</CardTitle>
                    {r.descricao && <CardDescription className="text-xs mt-1">{r.descricao}</CardDescription>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteReward.mutate(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1">
                    <Star className="h-3 w-3" /> {r.pontos_necessarios} pts
                  </Badge>
                  {r.tipo === "desconto_percentual" ? (
                    <Badge className="bg-green-600">{r.percentual_desconto}% OFF</Badge>
                  ) : (
                    <Badge className="bg-green-600">R$ {r.valor_desconto.toFixed(2)}</Badge>
                  )}
                  <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
                {r.validade_dias && (
                  <p className="text-xs text-muted-foreground mt-2">Validade: {r.validade_dias} dias após resgate</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Redemptions */}
      {redemptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Resgates Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {redemptions.map((red) => (
                <div key={red.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                  <div>
                    <p className="font-medium">{red.pacientes?.nome || "Paciente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {red.rewards_catalog?.nome} • {red.pontos_gastos} pts • {format(new Date(red.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={red.status === "utilizado" ? "default" : red.status === "pendente" ? "secondary" : "outline"}>
                      {red.status}
                    </Badge>
                    {red.status === "pendente" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateRedemptionStatus.mutate({ id: red.id, status: "aprovado" })}>
                        Aprovar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              {editing ? "Editar Recompensa" : "Nova Recompensa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Desconto 10% na mensalidade" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes da recompensa..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pontos necessários *</Label>
                <Input type="number" value={form.pontos_necessarios} min={1}
                  onChange={(e) => setForm((f) => ({ ...f, pontos_necessarios: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desconto_percentual">Desconto %</SelectItem>
                    <SelectItem value="desconto_valor">Desconto R$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.tipo === "desconto_percentual" ? (
              <div className="space-y-1.5">
                <Label>Percentual de desconto (%)</Label>
                <Input type="number" value={form.percentual_desconto || 0} min={1} max={100}
                  onChange={(e) => setForm((f) => ({ ...f, percentual_desconto: Number(e.target.value) }))} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Valor do desconto (R$)</Label>
                <Input type="number" value={form.valor_desconto} min={0} step="0.01"
                  onChange={(e) => setForm((f) => ({ ...f, valor_desconto: Number(e.target.value) }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Validade (dias)</Label>
                <Input type="number" value={form.validade_dias || ""} min={1}
                  onChange={(e) => setForm((f) => ({ ...f, validade_dias: Number(e.target.value) || null }))}
                  placeholder="30" />
              </div>
              <div className="space-y-1.5">
                <Label>Limite resgates</Label>
                <Input type="number" value={form.limite_resgates || ""} min={1}
                  onChange={(e) => setForm((f) => ({ ...f, limite_resgates: Number(e.target.value) || null }))}
                  placeholder="Ilimitado" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={() => saveReward.mutate()} disabled={!form.nome || saveReward.isPending}>
              {saveReward.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
