/**
 * EvolutionTemplateManager — allows clinics to create/edit/delete
 * their own evolution (SOAP/narrative) templates, replacing hardcoded ones.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EvolutionTemplate {
  id: string;
  label: string;
  descricao: string;
  conduta: string;
  clinic_id: string | null;
  is_default: boolean;
}

const SYSTEM_DEFAULTS: Omit<EvolutionTemplate, "id" | "clinic_id">[] = [
  {
    label: "Sessão Padrão",
    descricao: "Paciente realizou sessão de tratamento conforme protocolo estabelecido. Boa adesão aos exercícios propostos. Sem queixas álgicas durante a execução.",
    conduta: "Manter protocolo atual. Progredir carga/repetições na próxima sessão conforme tolerância.",
    is_default: true,
  },
  {
    label: "Reavaliação",
    descricao: "Realizada reavaliação funcional. Paciente apresenta melhora em relação à avaliação anterior nos seguintes parâmetros: amplitude de movimento, força muscular e funcionalidade.",
    conduta: "Atualizar protocolo de tratamento conforme novos achados. Reavaliar em 30 dias.",
    is_default: true,
  },
  {
    label: "Alta / Última Sessão",
    descricao: "Paciente atingiu os objetivos terapêuticos propostos. Apresenta independência funcional para atividades de vida diária. Orientado sobre manutenção dos ganhos em domicílio.",
    conduta: "Alta do tratamento. Orientações domiciliares entregues. Retorno preventivo em 3 meses.",
    is_default: true,
  },
  {
    label: "Falta / Não Compareceu",
    descricao: "Paciente não compareceu à sessão agendada. Tentativa de contato realizada.",
    conduta: "Reagendar sessão. Reforçar importância da regularidade no tratamento.",
    is_default: true,
  },
];

const EMPTY_FORM = { label: "", descricao: "", conduta: "" };

export function EvolutionTemplateManager() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EvolutionTemplate | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: templates = [], isLoading } = useQuery<EvolutionTemplate[]>({
    queryKey: ["evolution-templates", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await (supabase as any)
        .from("evolution_templates")
        .select("*")
        .or(`clinic_id.eq.${activeClinicId},is_default.eq.true`)
        .order("is_default", { ascending: false })
        .order("label");
      if (error) {
        // Table may not exist yet — return system defaults
        console.warn("evolution_templates table not found, using defaults", error);
        return SYSTEM_DEFAULTS.map((t, i) => ({ ...t, id: `default-${i}`, clinic_id: null })) as EvolutionTemplate[];
      }
      // If no templates in DB, seed system defaults display only
      if (!data || data.length === 0) {
        return SYSTEM_DEFAULTS.map((t, i) => ({ ...t, id: `default-${i}`, clinic_id: null })) as EvolutionTemplate[];
      }
      return data as EvolutionTemplate[];
    },
    enabled: !!activeClinicId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) => {
      if (!activeClinicId) throw new Error("Clínica não selecionada");
      if (editing && !editing.is_default) {
        const { error } = await (supabase as any)
          .from("evolution_templates")
          .update({ ...payload })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("evolution_templates")
          .insert({ ...payload, clinic_id: activeClinicId, is_default: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution-templates"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success(editing ? "Template atualizado!" : "Template criado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao salvar template", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("evolution_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution-templates"] });
      toast.success("Template removido.");
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (t: EvolutionTemplate) => {
    setEditing(t);
    setForm({ label: t.label, descricao: t.descricao, conduta: t.conduta });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Templates de Evolução
        </CardTitle>
        <Button size="sm" onClick={openCreate} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" /> Novo Template
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : templates.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium truncate">{t.label}</p>
                {t.is_default && <Badge variant="outline" className="text-[10px] shrink-0">Padrão</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{t.descricao}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => openEdit(t)}
                title={t.is_default ? "Criar cópia editável" : "Editar"}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!t.is_default && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(t.id)}
                  disabled={deleteMutation.isPending}
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editing && !editing.is_default ? "Editar Template" : "Novo Template de Evolução"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editing?.is_default && (
              <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                📋 Você está criando uma <strong>cópia editável</strong> deste template padrão. O original será mantido.
              </p>
            )}
            <div>
              <Label htmlFor="tmpl-label">Nome do Template *</Label>
              <Input
                id="tmpl-label"
                placeholder="Ex: Sessão de Pilates Intensiva"
                value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="tmpl-descricao">Texto da Evolução *</Label>
              <Textarea
                id="tmpl-descricao"
                placeholder="Descreva o que será pré-preenchido no campo de evolução..."
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="tmpl-conduta">Conduta / Próximos Passos</Label>
              <Textarea
                id="tmpl-conduta"
                placeholder="Plano para a próxima sessão..."
                value={form.conduta}
                onChange={e => setForm(p => ({ ...p, conduta: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.label || !form.descricao || saveMutation.isPending}
            >
              {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
