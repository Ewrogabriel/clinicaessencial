import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target, Plus, Pencil, Trash2, Calendar, DollarSign, Users, CheckCircle2, XCircle, Clock, Sparkles, Loader2 } from "lucide-react";

interface Meta {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  meta_valor: number | null;
  meta_quantidade: number | null;
  unidade: string | null;
  data_inicio: string;
  data_fim: string;
  status: string;
  created_at: string;
}

const tipoOptions = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "outro", label: "Outro" },
];

const unidadeOptions = [
  { value: "R$", label: "R$ (Valor)" },
  { value: "atendimentos", label: "Atendimentos" },
  { value: "pacientes", label: "Pacientes" },
  { value: "matriculas", label: "Matrículas" },
  { value: "sessoes", label: "Sessões" },
  { value: "%", label: "% (Percentual)" },
  { value: "outro", label: "Outro" },
];

const statusOptions = [
  { value: "ativa", label: "Ativa", icon: Clock, color: "bg-blue-500" },
  { value: "concluida", label: "Concluída", icon: CheckCircle2, color: "bg-green-500" },
  { value: "cancelada", label: "Cancelada", icon: XCircle, color: "bg-destructive" },
];

export function MetasClinicaForm() {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("mensal");
  const [metaValor, setMetaValor] = useState("");
  const [metaQuantidade, setMetaQuantidade] = useState("");
  const [unidade, setUnidade] = useState("R$");
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [statusMeta, setStatusMeta] = useState("ativa");

  const fetchAiSuggestions = async () => {
    setLoadingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-goals-suggestions", {
        body: { clinicId: activeClinicId }
      });
      if (error) throw error;
      setAiSuggestions(data?.suggestions || []);
    } catch (err: any) {
      toast({ title: "Erro ao buscar sugestões", description: err.message, variant: "destructive" });
    } finally {
      setLoadingAi(false);
    }
  };

  const applySuggestion = (suggestion: string) => {
    setTitulo(suggestion);
    setAiSuggestions([]);
  };

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["metas-clinica", activeClinicId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("metas_clinica" as any) as any)
        .select("*")
        .eq("clinic_id", activeClinicId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Meta[];
    },
    enabled: !!activeClinicId,
  });

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setTipo("mensal");
    setMetaValor("");
    setMetaQuantidade("");
    setUnidade("R$");
    setDataInicio(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setDataFim(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setStatusMeta("ativa");
    setEditingMeta(null);
  };

  const openEditDialog = (meta: Meta) => {
    setEditingMeta(meta);
    setTitulo(meta.titulo);
    setDescricao(meta.descricao || "");
    setTipo(meta.tipo);
    setMetaValor(meta.meta_valor?.toString() || "");
    setMetaQuantidade(meta.meta_quantidade?.toString() || "");
    setUnidade(meta.unidade || "R$");
    setDataInicio(meta.data_inicio);
    setDataFim(meta.data_fim);
    setStatusMeta(meta.status);
    setDialogOpen(true);
  };

  const handleTipoChange = (newTipo: string) => {
    setTipo(newTipo);
    const now = new Date();
    if (newTipo === "mensal") {
      setDataInicio(format(startOfMonth(now), "yyyy-MM-dd"));
      setDataFim(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (newTipo === "trimestral") {
      setDataInicio(format(startOfMonth(now), "yyyy-MM-dd"));
      setDataFim(format(endOfMonth(addMonths(now, 2)), "yyyy-MM-dd"));
    } else if (newTipo === "semestral") {
      setDataInicio(format(startOfMonth(now), "yyyy-MM-dd"));
      setDataFim(format(endOfMonth(addMonths(now, 5)), "yyyy-MM-dd"));
    } else if (newTipo === "anual") {
      setDataInicio(format(startOfYear(now), "yyyy-MM-dd"));
      setDataFim(format(endOfYear(now), "yyyy-MM-dd"));
    }
  };

  const saveMeta = useMutation({
    mutationFn: async () => {
      if (!user || !activeClinicId || !titulo.trim()) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      const payload = {
        clinic_id: activeClinicId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        tipo,
        meta_valor: metaValor ? parseFloat(metaValor) : null,
        meta_quantidade: metaQuantidade ? parseInt(metaQuantidade) : null,
        unidade,
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: statusMeta,
        created_by: user.id,
      };

      if (editingMeta) {
        const { error } = await (supabase
          .from("metas_clinica" as any) as any)
          .update(payload)
          .eq("id", editingMeta.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("metas_clinica" as any) as any)
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingMeta ? "Meta atualizada!" : "Meta criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["metas-clinica"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("metas_clinica" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Meta excluída!" });
      queryClient.invalidateQueries({ queryKey: ["metas-clinica"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    const opt = statusOptions.find(s => s.value === status);
    if (!opt) return null;
    const Icon = opt.icon;
    return (
      <Badge variant={status === "ativa" ? "default" : status === "concluida" ? "secondary" : "destructive"} className="gap-1">
        <Icon className="h-3 w-3" />
        {opt.label}
      </Badge>
    );
  };

  const getMetaProgress = (meta: Meta) => {
    // This is a simplified progress - in real scenario you'd fetch actual data
    const now = new Date();
    const start = new Date(meta.data_inicio);
    const end = new Date(meta.data_fim);
    if (now < start) return 0;
    if (now > end) return 100;
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.round((elapsed / total) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Metas da Clínica</h2>
          <p className="text-muted-foreground text-sm">Defina metas mensais, anuais e acompanhe o progresso</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { resetForm(); setAiSuggestions([]); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMeta ? "Editar Meta" : "Cadastrar Nova Meta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* AI Suggestions Section */}
              {!editingMeta && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Sugestões da IA
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAiSuggestions}
                      disabled={loadingAi}
                      className="gap-2"
                    >
                      {loadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {loadingAi ? "Gerando..." : "Gerar Sugestões"}
                    </Button>
                  </div>
                  {aiSuggestions.length > 0 && (
                    <div className="grid gap-2">
                      {aiSuggestions.map((suggestion, idx) => (
                        <Button
                          key={idx}
                          variant="ghost"
                          size="sm"
                          className="justify-start text-left h-auto py-2 px-3 border border-border hover:bg-accent"
                          onClick={() => applySuggestion(suggestion)}
                        >
                          <Target className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                          <span className="text-sm">{suggestion}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Meta de Faturamento Janeiro"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva detalhes da meta..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={handleTipoChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unidadeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor da Meta (R$)</Label>
                  <Input
                    type="number"
                    value={metaValor}
                    onChange={(e) => setMetaValor(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    value={metaQuantidade}
                    onChange={(e) => setMetaQuantidade(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>

              {editingMeta && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusMeta} onValueChange={setStatusMeta}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending || !titulo.trim()}>
                  {saveMeta.isPending ? "Salvando..." : editingMeta ? "Atualizar" : "Criar Meta"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse">Carregando metas...</div>
      ) : metas.length === 0 ? (
        <Card className="p-8 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
          <p className="text-sm text-muted-foreground">Clique em "Nova Meta" para começar.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {metas.map((meta) => (
            <Card key={meta.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{meta.titulo}</CardTitle>
                    {meta.descricao && (
                      <CardDescription className="text-xs mt-1 line-clamp-2">{meta.descricao}</CardDescription>
                    )}
                  </div>
                  {getStatusBadge(meta.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {tipoOptions.find(t => t.value === meta.tipo)?.label}
                    </Badge>
                    {meta.meta_valor && (
                      <Badge variant="outline" className="gap-1">
                        <DollarSign className="h-3 w-3" />
                        R$ {meta.meta_valor.toLocaleString("pt-BR")}
                      </Badge>
                    )}
                    {meta.meta_quantidade && (
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" />
                        {meta.meta_quantidade} {meta.unidade !== "R$" ? meta.unidade : ""}
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {format(new Date(meta.data_inicio), "dd/MM/yyyy", { locale: ptBR })} até {format(new Date(meta.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                  </div>

                  {meta.status === "ativa" && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progresso do período</span>
                        <span>{getMetaProgress(meta)}%</span>
                      </div>
                      <Progress value={getMetaProgress(meta)} className="h-2" />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(meta)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Deseja excluir esta meta?")) {
                          deleteMeta.mutate(meta.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
