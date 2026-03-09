import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GraduationCap, Award } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Formacao {
  id: string;
  profissional_id: string;
  tipo: "especialidade" | "curso";
  nome: string;
  instituicao?: string;
  data_conclusao?: string;
  carga_horaria?: number;
  certificado_url?: string;
  observacoes?: string;
  created_at: string;
}

interface Props {
  profissionalId: string;
  readOnly?: boolean;
}

export const FormacoesManager = ({ profissionalId, readOnly = false }: Props) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"especialidade" | "curso">("especialidade");
  const [nome, setNome] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [dataConclusao, setDataConclusao] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: formacoes = [], isLoading } = useQuery({
    queryKey: ["profissional-formacoes", profissionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissional_formacoes")
        .select("*")
        .eq("profissional_id", profissionalId)
        .order("data_conclusao", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Formacao[];
    },
    enabled: !!profissionalId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        profissional_id: profissionalId,
        tipo,
        nome,
        instituicao: instituicao || null,
        data_conclusao: dataConclusao || null,
        carga_horaria: cargaHoraria ? parseInt(cargaHoraria) : null,
        observacoes: observacoes || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("profissional_formacoes")
          .update(payload as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profissional_formacoes")
          .insert([payload] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Formação atualizada!" : "Formação adicionada!" });
      queryClient.invalidateQueries({ queryKey: ["profissional-formacoes", profissionalId] });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profissional_formacoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Formação removida!" });
      queryClient.invalidateQueries({ queryKey: ["profissional-formacoes", profissionalId] });
    },
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditingId(null);
    setTipo("especialidade");
    setNome("");
    setInstituicao("");
    setDataConclusao("");
    setCargaHoraria("");
    setObservacoes("");
  };

  const openEdit = (f: Formacao) => {
    setEditingId(f.id);
    setTipo(f.tipo);
    setNome(f.nome);
    setInstituicao(f.instituicao || "");
    setDataConclusao(f.data_conclusao || "");
    setCargaHoraria(f.carga_horaria?.toString() || "");
    setObservacoes(f.observacoes || "");
    setDialogOpen(true);
  };

  const especialidades = formacoes.filter(f => f.tipo === "especialidade");
  const cursos = formacoes.filter(f => f.tipo === "curso");

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Carregando formações...</div>;
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar Formação
          </Button>
        </div>
      )}

      {/* Especialidades */}
      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2 text-sm">
          <Award className="h-4 w-4 text-primary" /> Especialidades
        </h4>
        {especialidades.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma especialidade cadastrada</p>
        ) : (
          <div className="grid gap-2">
            {especialidades.map((f) => (
              <Card key={f.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Especialidade</Badge>
                      <span className="font-medium text-sm">{f.nome}</span>
                    </div>
                    {f.instituicao && (
                      <p className="text-xs text-muted-foreground">{f.instituicao}</p>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {f.data_conclusao && (
                        <span>Conclusão: {format(new Date(f.data_conclusao), "MM/yyyy", { locale: ptBR })}</span>
                      )}
                      {f.carga_horaria && <span>{f.carga_horaria}h</span>}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive" 
                        onClick={() => deleteMutation.mutate(f.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cursos */}
      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2 text-sm">
          <GraduationCap className="h-4 w-4 text-primary" /> Cursos e Capacitações
        </h4>
        {cursos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum curso cadastrado</p>
        ) : (
          <div className="grid gap-2">
            {cursos.map((f) => (
              <Card key={f.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Curso</Badge>
                      <span className="font-medium text-sm">{f.nome}</span>
                    </div>
                    {f.instituicao && (
                      <p className="text-xs text-muted-foreground">{f.instituicao}</p>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {f.data_conclusao && (
                        <span>Conclusão: {format(new Date(f.data_conclusao), "MM/yyyy", { locale: ptBR })}</span>
                      )}
                      {f.carga_horaria && <span>{f.carga_horaria}h</span>}
                    </div>
                    {f.observacoes && (
                      <p className="text-xs text-muted-foreground italic">{f.observacoes}</p>
                    )}
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive" 
                        onClick={() => deleteMutation.mutate(f.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Formação" : "Nova Formação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especialidade">Especialidade</SelectItem>
                  <SelectItem value="curso">Curso / Capacitação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome da Formação *</Label>
              <Input 
                value={nome} 
                onChange={(e) => setNome(e.target.value)} 
                placeholder={tipo === "especialidade" ? "Ex: Especialização em Ortopedia" : "Ex: Pilates Clínico"}
              />
            </div>

            <div className="space-y-2">
              <Label>Instituição</Label>
              <Input 
                value={instituicao} 
                onChange={(e) => setInstituicao(e.target.value)} 
                placeholder="Ex: Universidade XYZ"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Conclusão</Label>
                <Input 
                  type="date" 
                  value={dataConclusao} 
                  onChange={(e) => setDataConclusao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Carga Horária (h)</Label>
                <Input 
                  type="number" 
                  value={cargaHoraria} 
                  onChange={(e) => setCargaHoraria(e.target.value)}
                  placeholder="Ex: 360"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={observacoes} 
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais..."
                className="min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button 
                disabled={!nome.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
