import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/modules/shared/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";

interface PolicyForm {
  nome: string;
  descricao: string;
  prazo_aviso_horas: number;
  multa_percentual: number;
  aplica_falta: boolean;
  aplica_cancelamento: boolean;
  exige_justificativa: boolean;
  prazo_reagendamento_dias: number;
  prazo_remarcacao_dias: number;
  ativo: boolean;
}

const emptyForm: PolicyForm = {
  nome: "",
  descricao: "",
  prazo_aviso_horas: 24,
  multa_percentual: 0,
  aplica_falta: true,
  aplica_cancelamento: true,
  exige_justificativa: true,
  prazo_reagendamento_dias: 7,
  prazo_remarcacao_dias: 30,
  ativo: true,
};

export function CancellationPolicies() {
  const { user, isAdmin, isGestor } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = isAdmin || isGestor;

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["politicas-cancelamento"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("politicas_cancelamento" as any) as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        prazo_aviso_horas: form.prazo_aviso_horas,
        multa_percentual: form.multa_percentual,
        aplica_falta: form.aplica_falta,
        aplica_cancelamento: form.aplica_cancelamento,
        exige_justificativa: form.exige_justificativa,
        prazo_reagendamento_dias: form.prazo_reagendamento_dias,
        prazo_remarcacao_dias: form.prazo_remarcacao_dias,
        ativo: form.ativo,
      };

      if (editingId) {
        const { error } = await (supabase.from("politicas_cancelamento" as any) as any)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("politicas_cancelamento" as any) as any)
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["politicas-cancelamento"] });
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: editingId ? "Política atualizada!" : "Política criada!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("politicas_cancelamento" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["politicas-cancelamento"] });
      setDeleteTarget(null);
      toast({ title: "Política removida." });
    },
  });

  const openEdit = (policy: any) => {
    setEditingId(policy.id);
    setForm({
      nome: policy.nome,
      descricao: policy.descricao || "",
      prazo_aviso_horas: policy.prazo_aviso_horas,
      multa_percentual: Number(policy.multa_percentual),
      aplica_falta: policy.aplica_falta,
      aplica_cancelamento: policy.aplica_cancelamento,
      exige_justificativa: policy.exige_justificativa ?? true,
      prazo_reagendamento_dias: policy.prazo_reagendamento_dias ?? 7,
      prazo_remarcacao_dias: policy.prazo_remarcacao_dias ?? 30,
      ativo: policy.ativo,
    });
    setFormOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Políticas de Cancelamento e Remarcação</h3>
          <p className="text-sm text-muted-foreground">
            Defina regras de prazo, justificativa, multa e vencimento para cancelamentos, faltas e remarcações
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nova Política
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma política cadastrada.</p>
            {canEdit && (
              <Button size="sm" className="mt-3 gap-2" onClick={openNew}>
                <Plus className="h-3 w-3" /> Criar primeira política
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prazo Aviso</TableHead>
                  <TableHead>Multa</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead>Reagendar</TableHead>
                  <TableHead>Remarcar</TableHead>
                  <TableHead>Aplica em</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead>Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{p.nome}</span>
                        {p.descricao && (
                          <p className="text-xs text-muted-foreground mt-0.5">{p.descricao}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{p.prazo_aviso_horas}h</TableCell>
                    <TableCell>{Number(p.multa_percentual)}%</TableCell>
                    <TableCell>
                      <Badge variant={p.exige_justificativa ? "default" : "secondary"} className="text-[10px]">
                        {p.exige_justificativa ? "Obrigatória" : "Opcional"}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.prazo_reagendamento_dias ?? 7}d</TableCell>
                    <TableCell>{p.prazo_remarcacao_dias ?? 30}d</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.aplica_cancelamento && <Badge variant="outline" className="text-[10px]">Cancel.</Badge>}
                        {p.aplica_falta && <Badge variant="outline" className="text-[10px]">Falta</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.ativo ? "default" : "secondary"}>
                        {p.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditingId(null); } else setFormOpen(true); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Política" : "Nova Política de Cancelamento / Remarcação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Política padrão" className="mt-1" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes da política..." className="mt-1" rows={2} />
            </div>

            {/* Prazos e Multa */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prazo de Aviso (horas)</Label>
                <Input type="number" min={0} value={form.prazo_aviso_horas} onChange={(e) => setForm({ ...form, prazo_aviso_horas: parseInt(e.target.value) || 0 })} className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Cancelar antes deste prazo evita multa</p>
              </div>
              <div>
                <Label>Multa (%)</Label>
                <Input type="number" min={0} max={100} step={5} value={form.multa_percentual} onChange={(e) => setForm({ ...form, multa_percentual: parseFloat(e.target.value) || 0 })} className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">% do valor da sessão cobrado como multa</p>
              </div>
            </div>

            {/* Prazos de Reagendamento e Remarcação */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prazo p/ Reagendar (dias)</Label>
                <Input type="number" min={1} value={form.prazo_reagendamento_dias} onChange={(e) => setForm({ ...form, prazo_reagendamento_dias: parseInt(e.target.value) || 7 })} className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Dias que o paciente tem para reagendar uma sessão antes dela expirar</p>
              </div>
              <div>
                <Label>Prazo p/ Remarcar (dias)</Label>
                <Input type="number" min={1} value={form.prazo_remarcacao_dias} onChange={(e) => setForm({ ...form, prazo_remarcacao_dias: parseInt(e.target.value) || 30 })} className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Dias após cancelamento/falta para remarcar, senão a sessão vence</p>
              </div>
            </div>

            {/* Switches */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Exige justificativa</Label>
                  <p className="text-[10px] text-muted-foreground">Paciente precisa informar motivo ao cancelar</p>
                </div>
                <Switch checked={form.exige_justificativa} onCheckedChange={(v) => setForm({ ...form, exige_justificativa: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aplica em cancelamentos</Label>
                <Switch checked={form.aplica_cancelamento} onCheckedChange={(v) => setForm({ ...form, aplica_cancelamento: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aplica em faltas</Label>
                <Switch checked={form.aplica_falta} onCheckedChange={(v) => setForm({ ...form, aplica_falta: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Política ativa</Label>
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.nome || saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover política?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
