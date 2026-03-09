import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { FileText, Plus, Sparkles, Download, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateDocumentPDF } from "@/lib/generateDocumentPDF";

const tipoLabels: Record<string, string> = {
  receituario: "Receituário",
  relatorio: "Relatório",
  atestado: "Atestado",
  encaminhamento: "Encaminhamento",
};

const tipoColors: Record<string, string> = {
  receituario: "bg-blue-100 text-blue-700",
  relatorio: "bg-emerald-100 text-emerald-700",
  atestado: "bg-amber-100 text-amber-700",
  encaminhamento: "bg-purple-100 text-purple-700",
};

const DocumentosClinicos = () => {
  const { user, profile } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [tipo, setTipo] = useState("receituario");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch documents
  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ["documentos-clinicos", user?.id, activeClinicId],
    queryFn: async () => {
      let q = supabase.from("documentos_clinicos")
        .select("*, pacientes(nome, cpf)")
        .order("created_at", { ascending: false });
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch patients for selection
  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-select", activeClinicId],
    queryFn: async () => {
      if (activeClinicId) {
        const { data: cp } = await supabase.from("clinic_pacientes").select("paciente_id").eq("clinic_id", activeClinicId);
        const ids = (cp || []).map(c => c.paciente_id);
        if (!ids.length) return [];
        const { data } = await supabase.from("pacientes").select("id, nome, cpf").in("id", ids).order("nome");
        return data || [];
      }
      const { data } = await supabase.from("pacientes").select("id, nome, cpf").order("nome");
      return data || [];
    },
  });

  // Save document
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tipo,
        titulo: titulo || tipoLabels[tipo],
        conteudo,
        paciente_id: pacienteId,
        profissional_id: user!.id,
        clinic_id: activeClinicId || null,
      };
      if (editingDoc) {
        const { error } = await supabase.from("documentos_clinicos").update(payload).eq("id", editingDoc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("documentos_clinicos").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingDoc ? "Documento atualizado!" : "Documento salvo!" });
      queryClient.invalidateQueries({ queryKey: ["documentos-clinicos"] });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documentos_clinicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Documento excluído!" });
      queryClient.invalidateQueries({ queryKey: ["documentos-clinicos"] });
    },
  });

  // AI suggestion
  const handleAISuggest = async () => {
    if (!conteudo.trim() || !pacienteId) {
      toast({ title: "Preencha o conteúdo e selecione o paciente para obter sugestões.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      // Fetch patient evolutions for context
      const { data: evolutions } = await supabase.from("evolutions")
        .select("descricao, conduta, data_evolucao")
        .eq("paciente_id", pacienteId)
        .order("data_evolucao", { ascending: false })
        .limit(5);

      const { data: evaluations } = await supabase.from("evaluations")
        .select("queixa_principal, objetivos_tratamento, conduta_inicial")
        .eq("paciente_id", pacienteId)
        .limit(1);

      const context = {
        tipo_documento: tipoLabels[tipo],
        conteudo_atual: conteudo,
        evolucoes_recentes: evolutions?.map(e => `${e.data_evolucao}: ${e.descricao}${e.conduta ? ` | Conduta: ${e.conduta}` : ""}`).join("\n") || "Sem evoluções",
        avaliacao: evaluations?.[0] ? `Queixa: ${evaluations[0].queixa_principal}. Objetivos: ${evaluations[0].objetivos_tratamento || "N/A"}. Conduta: ${evaluations[0].conduta_inicial || "N/A"}` : "Sem avaliação",
      };

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: "document_suggest",
          context,
        },
      });

      if (error) throw error;
      if (data?.suggestion) {
        setConteudo(data.suggestion);
        toast({ title: "Sugestão de IA aplicada! Revise o conteúdo." });
      }
    } catch (e: any) {
      toast({ title: "Erro na sugestão de IA", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingDoc(null);
    setTipo("receituario");
    setTitulo("");
    setConteudo("");
    setPacienteId("");
  };

  const openEdit = (doc: any) => {
    setEditingDoc(doc);
    setTipo(doc.tipo);
    setTitulo(doc.titulo);
    setConteudo(doc.conteudo);
    setPacienteId(doc.paciente_id);
    setIsFormOpen(true);
  };

  const handleGeneratePDF = async (doc: any) => {
    const paciente = pacientes.find((p: any) => p.id === doc.paciente_id);
    await generateDocumentPDF({
      tipo: doc.tipo,
      titulo: doc.titulo,
      conteudo: doc.conteudo,
      profissionalNome: profile?.nome || "Profissional",
      profissionalRegistro: profile?.registro_profissional || undefined,
      pacienteNome: paciente?.nome || (doc.pacientes as any)?.nome || "Paciente",
      pacienteCpf: paciente?.cpf || (doc.pacientes as any)?.cpf || undefined,
      data: format(new Date(doc.created_at), "dd/MM/yyyy"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos Clínicos</h1>
          <p className="text-muted-foreground">Receituários, relatórios, atestados e encaminhamentos</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setIsFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo Documento
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum documento criado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documentos.map((doc: any) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge className={tipoColors[doc.tipo] || ""}>{tipoLabels[doc.tipo]}</Badge>
                    <CardTitle className="text-sm mt-2">{doc.titulo || tipoLabels[doc.tipo]}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-1">
                  Paciente: <span className="font-medium">{(doc.pacientes as any)?.nome || "—"}</span>
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{doc.conteudo}</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="gap-1 flex-1" onClick={() => handleGeneratePDF(doc)}>
                    <Download className="h-3 w-3" /> PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(doc)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(doc.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Editar Documento" : "Novo Documento Clínico"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Documento</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receituario">Receituário</SelectItem>
                    <SelectItem value="relatorio">Relatório Clínico</SelectItem>
                    <SelectItem value="atestado">Atestado</SelectItem>
                    <SelectItem value="encaminhamento">Encaminhamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Paciente</Label>
                <Select value={pacienteId} onValueChange={setPacienteId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Título (opcional)</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tipoLabels[tipo]} />
            </div>

            <div>
              <Label>Profissional</Label>
              <Input value={profile?.nome || ""} disabled className="bg-muted" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Conteúdo</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  disabled={aiLoading || !conteudo.trim()}
                  onClick={handleAISuggest}
                >
                  <Sparkles className="h-3 w-3" />
                  {aiLoading ? "Analisando..." : "Sugestão IA"}
                </Button>
              </div>
              <Textarea
                value={conteudo}
                onChange={e => setConteudo(e.target.value)}
                placeholder="Digite o conteúdo do documento..."
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Preencha o conteúdo e clique em "Sugestão IA" para obter melhorias baseadas no prontuário do paciente.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button
                disabled={!pacienteId || !conteudo.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Salvando..." : editingDoc ? "Atualizar" : "Salvar Documento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentosClinicos;
