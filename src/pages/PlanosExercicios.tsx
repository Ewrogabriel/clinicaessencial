import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Dumbbell, Plus, Sparkles, Loader2, Trash2, Edit2, ChevronDown,
  ChevronUp, Search, User, Target, Clock, ImageIcon, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePacientes } from "@/hooks/usePacientes";
import jsPDF from "jspdf";

interface Exercise {
  id?: string;
  nome: string;
  descricao: string;
  series: number;
  repeticoes: string;
  carga: string;
  tempo_execucao: string;
  frequencia: string;
  observacoes: string;
  ordem?: number;
  imagem_url?: string | null;
}

interface Plan {
  id: string;
  titulo: string;
  descricao: string;
  objetivo: string;
  duracao_semanas: number;
  status: string;
  gerado_por_ia: boolean;
  paciente_id: string;
  created_at: string;
  pacientes?: { nome: string };
  exercicios_plano?: Exercise[];
}

export default function PlanosExercicios() {
  const { user, profile, isPatient, isProfissional, isAdmin, isGestor } = useAuth() as any;
  const { activeClinicId } = useClinic();
  const qc = useQueryClient();
  const { data: pacientesData = [] } = usePacientes();
  const isStaff = isProfissional || isAdmin || isGestor;

  // Get paciente record for patient users
  const { data: patientRecord } = useQuery({
    queryKey: ["my-patient-record", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && isPatient,
  });

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [generatingImageIdx, setGeneratingImageIdx] = useState<number | null>(null);

  const [form, setForm] = useState({
    paciente_id: "",
    titulo: "",
    descricao: "",
    objetivo: "",
    duracao_semanas: 4,
    status: "ativo",
  });
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [aiForm, setAiForm] = useState({
    objetivo: "",
    condicao: "",
    nivel: "iniciante",
    semanas: 4,
    observacoes: "",
    paciente_id: "",
    tipo_plano: "fisioterapia",
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["planos-exercicios", activeClinicId, patientRecord?.id, isPatient],
    queryFn: async () => {
      let query = supabase
        .from("planos_exercicios")
        .select("*, pacientes(nome), exercicios_plano(*)")
        .order("created_at", { ascending: false });

      // Patients only see their own plans
      if (isPatient && patientRecord?.id) {
        query = query.eq("paciente_id", patientRecord.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isPatient ? !!patientRecord?.id : true,
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      const planData: any = {
        ...form,
        clinic_id: activeClinicId,
        profissional_id: user?.id,
      };

      let planId = editingPlan?.id;

      if (editingPlan) {
        const { error } = await supabase.from("planos_exercicios").update(planData).eq("id", editingPlan.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("planos_exercicios").insert(planData).select().single();
        if (error) throw error;
        planId = data.id;
      }

      if (planId) {
        if (editingPlan) {
          await supabase.from("exercicios_plano").delete().eq("plano_id", planId);
        }
        if (exercises.length > 0) {
          const exData = exercises.map((ex, idx) => ({
            plano_id: planId,
            nome: ex.nome,
            descricao: ex.descricao,
            series: ex.series,
            repeticoes: ex.repeticoes,
            carga: ex.carga,
            tempo_execucao: ex.tempo_execucao,
            frequencia: ex.frequencia,
            observacoes: ex.observacoes,
            imagem_url: ex.imagem_url || null,
            ordem: idx,
          }));
          await supabase.from("exercicios_plano").insert(exData);
        }
      }

      // Send notification to patient when creating a new plan
      if (!editingPlan && form.paciente_id) {
        const { data: paciente } = await supabase
          .from("pacientes")
          .select("user_id, nome")
          .eq("id", form.paciente_id)
          .single();

        if (paciente?.user_id) {
          await supabase.from("notificacoes").insert({
            user_id: paciente.user_id,
            tipo: "plano_exercicio",
            titulo: "Novo Plano de Exercícios",
            resumo: `Seu profissional criou o plano "${form.titulo}" para você. Confira seus exercícios!`,
            link: "/planos-exercicios",
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planos-exercicios"] });
      toast.success(editingPlan ? "Plano atualizado!" : "Plano criado com sucesso! O paciente foi notificado.");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planos_exercicios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planos-exercicios"] });
      toast.success("Plano excluído");
    },
  });

  const generateWithAI = async () => {
    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-exercise-plan", {
        body: { ...aiForm },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const plan = data.plan;
      setForm({
        paciente_id: aiForm.paciente_id,
        titulo: plan.titulo || "Plano Personalizado",
        descricao: plan.descricao || "",
        objetivo: plan.objetivo || aiForm.objetivo,
        duracao_semanas: aiForm.semanas,
        status: "ativo",
      });
      setExercises((plan.exercicios || []).map((ex: any, i: number) => ({ ...ex, ordem: i })));
      setAiDialogOpen(false);
      setDialogOpen(true);
      toast.success("Plano gerado pela IA! Revise e salve.");
    } catch (e: any) {
      toast.error("Erro ao gerar plano: " + e.message);
    } finally {
      setGeneratingAI(false);
    }
  };

  const generateExerciseImage = async (idx: number) => {
    const ex = exercises[idx];
    if (!ex?.nome) {
      toast.error("Preencha o nome do exercício primeiro.");
      return;
    }
    setGeneratingImageIdx(idx);
    try {
      const prompt = `Create a clean, professional medical/physiotherapy illustration showing a person performing the exercise: "${ex.nome}". ${ex.descricao ? `Details: ${ex.descricao}.` : ""} Style: simple anatomical illustration, white background, clear body positioning, suitable for a clinical exercise plan. No text.`;

      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: { prompt },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.imageUrl) {
        updateExercise(idx, "imagem_url", data.imageUrl);
        toast.success("Imagem gerada!");
      }
    } catch (e: any) {
      toast.error("Erro ao gerar imagem: " + e.message);
    } finally {
      setGeneratingImageIdx(null);
    }
  };

  const resetForm = () => {
    setForm({ paciente_id: "", titulo: "", descricao: "", objetivo: "", duracao_semanas: 4, status: "ativo" });
    setExercises([]);
    setEditingPlan(null);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      paciente_id: plan.paciente_id,
      titulo: plan.titulo,
      descricao: plan.descricao || "",
      objetivo: plan.objetivo || "",
      duracao_semanas: plan.duracao_semanas,
      status: plan.status,
    });
    setExercises(plan.exercicios_plano || []);
    setDialogOpen(true);
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, {
      nome: "", descricao: "", series: 3, repeticoes: "10-12",
      carga: "Peso corporal", tempo_execucao: "30s", frequencia: "3x/semana", observacoes: "",
      imagem_url: null,
    }]);
  };

  const updateExercise = (idx: number, field: keyof Exercise, value: any) => {
    setExercises((prev) => prev.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex));
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const filtered = plans.filter((p: Plan) => {
    if (!search) return true;
    return p.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      p.pacientes?.nome?.toLowerCase().includes(search.toLowerCase());
  });

  const exportPlanPDF = (plan: Plan) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(plan.titulo, 14, 20);
    doc.setFontSize(10);
    doc.text(`Paciente: ${plan.pacientes?.nome || "—"}`, 14, 28);
    doc.text(`Objetivo: ${plan.objetivo || "—"}`, 14, 34);
    doc.text(`Duração: ${plan.duracao_semanas} semanas | Status: ${plan.status}`, 14, 40);
    doc.text(`Criado em: ${format(new Date(plan.created_at), "dd/MM/yyyy", { locale: ptBR })}`, 14, 46);

    let y = 56;
    (plan.exercicios_plano || []).forEach((ex, idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text(`${idx + 1}. ${ex.nome}`, 14, y); y += 6;
      doc.setFontSize(9);
      if (ex.descricao) { doc.text(`   Como executar: ${ex.descricao}`, 14, y); y += 5; }
      doc.text(`   Séries: ${ex.series || "—"} | Rep.: ${ex.repeticoes || "—"} | Freq.: ${ex.frequencia || "—"}`, 14, y); y += 5;
      if (ex.carga) { doc.text(`   Carga: ${ex.carga}`, 14, y); y += 5; }
      if (ex.observacoes) { doc.text(`   Obs.: ${ex.observacoes}`, 14, y); y += 5; }
      y += 4;
    });

    doc.save(`plano-${plan.titulo.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast.success("PDF exportado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            {isPatient ? "Meus Planos de Exercícios" : "Planos de Exercícios"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isPatient ? "Planos criados pelo seu profissional" : "Crie planos personalizados com auxílio de IA"}
          </p>
        </div>
        {isStaff && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Gerar com IA
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Plano
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por título ou paciente..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse bg-muted/30" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum plano criado ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Gerar com IA" para criar seu primeiro plano
            </p>
          </div>
        ) : (
          filtered.map((plan: Plan) => {
            const isExpanded = expandedPlan === plan.id;
            const exCount = plan.exercicios_plano?.length || 0;
            return (
              <Card key={plan.id} className="overflow-hidden">
                <div
                  className="p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Dumbbell className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{plan.titulo}</p>
                      {plan.gerado_por_ia && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                          <Sparkles className="h-2.5 w-2.5" /> IA
                        </Badge>
                      )}
                      <Badge variant={plan.status === "ativo" ? "default" : "secondary"} className="text-[10px]">
                        {plan.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3" /> {plan.pacientes?.nome || "Paciente"}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Dumbbell className="h-3 w-3" /> {exCount} exercícios</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {plan.duracao_semanas} semanas</span>
                      <span>{format(new Date(plan.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); exportPlanPDF(plan); }}>
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                    {isStaff && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(plan); }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deletePlan.mutate(plan.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/20 p-4 space-y-3">
                    {plan.descricao && <p className="text-sm text-muted-foreground">{plan.descricao}</p>}
                    {plan.objetivo && (
                      <p className="text-xs flex items-center gap-1 text-primary">
                        <Target className="h-3 w-3" /> <strong>Objetivo:</strong> {plan.objetivo}
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(plan.exercicios_plano || []).map((ex, idx) => (
                        <div key={idx} className="bg-card border rounded-lg p-3 text-xs space-y-1">
                          {ex.imagem_url && (
                            <img src={ex.imagem_url} alt={ex.nome} className="w-full h-32 object-contain rounded mb-2 bg-muted/30" />
                          )}
                          <p className="font-semibold text-sm">{ex.nome}</p>
                          {ex.descricao && <p className="text-muted-foreground">{ex.descricao}</p>}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {ex.series && <Badge variant="outline">{ex.series} séries</Badge>}
                            {ex.repeticoes && <Badge variant="outline">{ex.repeticoes} rep.</Badge>}
                            {ex.frequencia && <Badge variant="outline">{ex.frequencia}</Badge>}
                          </div>
                          {ex.observacoes && <p className="text-muted-foreground italic">{ex.observacoes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* New/Edit Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              {editingPlan ? "Editar Plano" : "Novo Plano de Exercícios"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => setForm((f) => ({ ...f, paciente_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {pacientesData.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Plano de Fortalecimento Core" />
              </div>
              <div className="space-y-1.5">
                <Label>Objetivo</Label>
                <Input value={form.objetivo} onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))} placeholder="Ex: Fortalecer lombar" />
              </div>
              <div className="space-y-1.5">
                <Label>Duração (semanas)</Label>
                <Input type="number" value={form.duracao_semanas} onChange={(e) => setForm((f) => ({ ...f, duracao_semanas: Number(e.target.value) }))} min={1} max={52} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição geral do plano..." rows={2} />
              </div>
            </div>

            {/* Exercises */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Exercícios ({exercises.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addExercise} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              <div className="space-y-3">
                {exercises.map((ex, idx) => (
                  <Card key={idx} className="p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground">Exercício {idx + 1}</p>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={generatingImageIdx === idx || !ex.nome}
                          onClick={() => generateExerciseImage(idx)}
                        >
                          {generatingImageIdx === idx ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ImageIcon className="h-3 w-3" />
                          )}
                          {generatingImageIdx === idx ? "Gerando..." : "Gerar Imagem"}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeExercise(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {ex.imagem_url && (
                      <div className="mb-2 relative">
                        <img src={ex.imagem_url} alt={ex.nome} className="w-full h-36 object-contain rounded border bg-background" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => updateExercise(idx, "imagem_url", null)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="col-span-2">
                        <Input placeholder="Nome do exercício *" value={ex.nome}
                          onChange={(e) => updateExercise(idx, "nome", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <Input placeholder="Séries" type="number" value={ex.series}
                        onChange={(e) => updateExercise(idx, "series", Number(e.target.value))} className="h-8 text-sm" />
                      <Input placeholder="Repetições (ex: 10-12)" value={ex.repeticoes}
                        onChange={(e) => updateExercise(idx, "repeticoes", e.target.value)} className="h-8 text-sm" />
                      <Input placeholder="Frequência (ex: 3x/sem)" value={ex.frequencia}
                        onChange={(e) => updateExercise(idx, "frequencia", e.target.value)} className="h-8 text-sm" />
                      <Input placeholder="Carga" value={ex.carga}
                        onChange={(e) => updateExercise(idx, "carga", e.target.value)} className="h-8 text-sm" />
                      <div className="col-span-2">
                        <Textarea placeholder="Descrição / como executar" value={ex.descricao}
                          onChange={(e) => updateExercise(idx, "descricao", e.target.value)} rows={2} className="text-sm" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={() => savePlan.mutate()} disabled={!form.titulo || !form.paciente_id || savePlan.isPending}>
              {savePlan.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPlan ? "Salvar Alterações" : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Gerar Plano com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <Select value={aiForm.paciente_id} onValueChange={(v) => setAiForm((f) => ({ ...f, paciente_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {pacientesData.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de plano *</Label>
              <Select value={aiForm.tipo_plano} onValueChange={(v) => setAiForm((f) => ({ ...f, tipo_plano: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                  <SelectItem value="pilates_aparelho">Pilates Aparelho (Reformer)</SelectItem>
                  <SelectItem value="pilates_solo">Pilates Solo (Mat)</SelectItem>
                  <SelectItem value="pilates_misto">Pilates Misto (Solo + Aparelho)</SelectItem>
                  <SelectItem value="fortalecimento">Fortalecimento Muscular</SelectItem>
                  <SelectItem value="alongamento">Alongamento e Flexibilidade</SelectItem>
                  <SelectItem value="funcional">Treinamento Funcional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo principal *</Label>
              <Input value={aiForm.objetivo} onChange={(e) => setAiForm((f) => ({ ...f, objetivo: e.target.value }))}
                placeholder="Ex: Fortalecimento lombar, reabilitação joelho..." />
            </div>
            <div className="space-y-1.5">
              <Label>Condição do paciente</Label>
              <Input value={aiForm.condicao} onChange={(e) => setAiForm((f) => ({ ...f, condicao: e.target.value }))}
                placeholder="Ex: Lombalgia crônica, pós-operatório..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nível do paciente</Label>
                <Select value={aiForm.nivel} onValueChange={(v) => setAiForm((f) => ({ ...f, nivel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iniciante">Iniciante</SelectItem>
                    <SelectItem value="intermediario">Intermediário</SelectItem>
                    <SelectItem value="avancado">Avançado</SelectItem>
                    <SelectItem value="adaptado">Adaptado (Restrições)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Semanas</Label>
                <Input type="number" value={aiForm.semanas} min={1} max={52}
                  onChange={(e) => setAiForm((f) => ({ ...f, semanas: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações para a IA</Label>
              <Textarea value={aiForm.observacoes} onChange={(e) => setAiForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Ex: Exercícios no Reformer, sem carga em MMSS, foco em core, usar bola suíça..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Cancelar</Button>
            <Button onClick={generateWithAI} disabled={!aiForm.objetivo || generatingAI} className="gap-2">
              {generatingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generatingAI ? "Gerando..." : "Gerar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
