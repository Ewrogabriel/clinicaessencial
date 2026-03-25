import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useI18n } from "@/modules/shared/hooks/useI18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/modules/shared/hooks/use-toast";
import { FileText, Plus, Sparkles, Download, Pencil, Trash2, Stamp, Share2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateDocumentPDF } from "@/lib/generateDocumentPDF";
import DocumentShareDialog from "@/components/clinical/DocumentShareDialog";

const tipoLabels: Record<string, string> = {
  receituario: "Receituário",
  relatorio: "Relatório",
  atestado: "Atestado",
  encaminhamento: "Encaminhamento",
  comparecimento: "Comprovante de Comparecimento",
  outros: "Outros",
};

const tipoColors: Record<string, string> = {
  receituario: "bg-blue-100 text-blue-700",
  relatorio: "bg-emerald-100 text-emerald-700",
  atestado: "bg-amber-100 text-amber-700",
  encaminhamento: "bg-purple-100 text-purple-700",
  comparecimento: "bg-teal-100 text-teal-700",
  outros: "bg-gray-100 text-gray-700",
};

const DocumentosClinicos = () => {
  const { user, profile } = useAuth();
  const { activeClinicId } = useClinic();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [tipo, setTipo] = useState("receituario");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [shareDoc, setShareDoc] = useState<any>(null);
  const [incluirCarimbo, setIncluirCarimbo] = useState(true);
  const [incluirAssinatura, setIncluirAssinatura] = useState(false);
  const [incluirRubrica, setIncluirRubrica] = useState(false);
  const [rubricaNoCarimbo, setRubricaNoCarimbo] = useState(false);
  const [apenasQrCode, setApenasQrCode] = useState(false);

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
        titulo: titulo || tipoLabels[tipo] || tipo,
        conteudo,
        paciente_id: pacienteId,
        profissional_id: user!.id,
        clinic_id: activeClinicId || null,
        dados_extras: { 
          incluir_carimbo: incluirCarimbo,
          incluir_assinatura: incluirAssinatura,
          incluir_rubrica: incluirRubrica,
          rubrica_no_carimbo: rubricaNoCarimbo,
          apenas_qr_code: apenasQrCode,
        },
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
        tipo_documento: tipoLabels[tipo] || tipo,
        conteudo_atual: conteudo,
        evolucoes_recentes: evolutions?.map(e => `${e.data_evolucao}: ${e.descricao}${e.conduta ? ` | Conduta: ${e.conduta}` : ""}`).join("\n") || "Sem evoluções",
        avaliacao: evaluations?.[0] ? `Queixa: ${evaluations[0].queixa_principal}. Objetivos: ${evaluations[0].objetivos_tratamento || "N/A"}. Conduta: ${evaluations[0].conduta_inicial || "N/A"}` : "Sem avaliação",
      };

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "document_suggest", context },
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

  // Generate initial document text
  const handleAIGenerate = async () => {
    if (!pacienteId) {
      toast({ title: "Selecione um paciente primeiro.", variant: "destructive" });
      return;
    }
    setAiGenerating(true);
    try {
      const paciente = pacientes.find((p: any) => p.id === pacienteId);

      const { data: evolutions } = await supabase.from("evolutions")
        .select("descricao, conduta, data_evolucao")
        .eq("paciente_id", pacienteId)
        .order("data_evolucao", { ascending: false })
        .limit(1);

      const { data: evaluations } = await supabase.from("evaluations")
        .select("queixa_principal, objetivos_tratamento")
        .eq("paciente_id", pacienteId)
        .limit(1);

      const context = {
        tipo_documento: tipo,
        paciente_nome: paciente?.nome || "Paciente",
        data: format(new Date(), "dd/MM/yyyy"),
        profissional_nome: profile?.nome || "Profissional",
        profissional_registro: profile?.registro_profissional || "",
        avaliacao: evaluations?.[0] ? `Queixa: ${evaluations[0].queixa_principal}. Objetivos: ${evaluations[0].objetivos_tratamento || "N/A"}` : "",
        ultima_evolucao: evolutions?.[0]?.descricao || "",
      };

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "document_generate", context },
      });

      if (error) throw error;
      if (data?.suggestion || data?.response) {
        setConteudo(data.suggestion || data.response);
        toast({ title: "Texto gerado! Revise e personalize conforme necessário." });
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar texto", description: e.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingDoc(null);
    setTipo("receituario");
    setTitulo("");
    setConteudo("");
    setPacienteId("");
    setIncluirCarimbo(true);
    setIncluirAssinatura(false);
    setIncluirRubrica(false);
    setRubricaNoCarimbo(false);
    setApenasQrCode(false);
  };

  const openEdit = (doc: any) => {
    setEditingDoc(doc);
    setTipo(doc.tipo);
    setTitulo(doc.titulo);
    setConteudo(doc.conteudo);
    setPacienteId(doc.paciente_id);
    setIncluirCarimbo((doc.dados_extras as any)?.incluir_carimbo !== false);
    setIncluirAssinatura((doc.dados_extras as any)?.incluir_assinatura === true);
    setIncluirRubrica((doc.dados_extras as any)?.incluir_rubrica === true);
    setRubricaNoCarimbo((doc.dados_extras as any)?.rubrica_no_carimbo === true);
    setApenasQrCode((doc.dados_extras as any)?.apenas_qr_code === true);
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
      incluirCarimbo: (doc.dados_extras as any)?.incluir_carimbo !== false,
      profissionalSignature: (doc.dados_extras as any)?.incluir_assinatura ? profile?.assinatura_url : undefined,
      profissionalRubrica: (doc.dados_extras as any)?.rubrica_no_carimbo || (doc.dados_extras as any)?.incluir_rubrica ? profile?.rubrica_url : undefined,
      rubricaNoCarimbo: (doc.dados_extras as any)?.rubrica_no_carimbo === true,
      apenasQrCode: (doc.dados_extras as any)?.apenas_qr_code === true,
      documentId: doc.id,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("docs.title")}</h1>
          <p className="text-muted-foreground">{t("docs.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setIsFormOpen(true); }}>
          <Plus className="h-4 w-4" /> {t("docs.new")}
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
      ) : documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>{t("docs.no_docs")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documentos.map((doc: any) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge className={tipoColors[doc.tipo] || tipoColors.outros}>{tipoLabels[doc.tipo] || doc.tipo}</Badge>
                    <CardTitle className="text-sm mt-2">{doc.titulo || tipoLabels[doc.tipo] || doc.tipo}</CardTitle>
                  </div>
                  {(doc.dados_extras as any)?.incluir_carimbo && (
                    <Stamp className="h-4 w-4 text-muted-foreground" />
                  )}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-primary border-primary/30 hover:bg-primary/5"
                    onClick={() => setShareDoc(doc)}
                    title="Compartilhar documento"
                    data-testid={`share-doc-btn-${doc.id}`}
                  >
                    <Share2 className="h-3 w-3" />
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

      {/* Share Dialog */}
      {shareDoc && (
        <DocumentShareDialog
          open={!!shareDoc}
          onOpenChange={(o) => { if (!o) setShareDoc(null); }}
          documentId={shareDoc.id}
          documentTitle={shareDoc.titulo || tipoLabels[shareDoc.tipo] || shareDoc.tipo}
          pacienteNome={(shareDoc.pacientes as any)?.nome || "Paciente"}
        />
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? t("docs.edit") : t("docs.new_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("docs.type")}</Label>
                <Select value={tipo} onValueChange={(v) => { setTipo(v); if (v !== "outros") setTitulo(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receituario">{t("docs.prescription")}</SelectItem>
                    <SelectItem value="relatorio">{t("docs.report")}</SelectItem>
                    <SelectItem value="atestado">{t("docs.certificate")}</SelectItem>
                    <SelectItem value="encaminhamento">{t("docs.referral")}</SelectItem>
                    <SelectItem value="comparecimento">{t("docs.attendance")}</SelectItem>
                    <SelectItem value="outros">{t("docs.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("common.patient")}</Label>
                <Select value={pacienteId} onValueChange={setPacienteId}>
                  <SelectTrigger><SelectValue placeholder={t("docs.select_patient")} /></SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tipo === "outros" && (
              <div>
                <Label>{t("docs.doc_type_name")} *</Label>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Declaração, Laudo, etc." />
              </div>
            )}

            {tipo !== "outros" && (
              <div>
                <Label>{t("docs.title_optional")}</Label>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tipoLabels[tipo]} />
              </div>
            )}

            <div>
              <Label>{t("common.professional")}</Label>
              <Input value={profile?.nome || ""} disabled className="bg-muted" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>{t("docs.content")}</Label>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    disabled={aiGenerating || !pacienteId}
                    onClick={handleAIGenerate}
                  >
                    <Sparkles className="h-3 w-3" />
                    {aiGenerating ? t("docs.generating") : t("docs.generate_text")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    disabled={aiLoading || !conteudo.trim() || !pacienteId}
                    onClick={handleAISuggest}
                  >
                    <Sparkles className="h-3 w-3" />
                    {aiLoading ? t("docs.improving") : t("docs.improve")}
                  </Button>
                </div>
              </div>
              <Textarea
                value={conteudo}
                onChange={e => setConteudo(e.target.value)}
                placeholder={t("docs.generate_hint")}
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                <strong>{t("docs.generate_text")}:</strong> {t("docs.generate_hint")} <strong>{t("docs.improve")}:</strong> {t("docs.improve_hint")}
              </p>
            </div>

            {/* Carimbo toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="font-medium flex items-center gap-2">
                    <Stamp className="h-4 w-4" /> {t("docs.stamp")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("docs.stamp_desc")}
                  </p>
                </div>
                <Switch checked={incluirCarimbo} onCheckedChange={setIncluirCarimbo} />
              </div>

              {incluirCarimbo && profile?.rubrica_url && (
                <div className="flex items-center justify-between rounded-lg border p-3 bg-blue-50/30 border-blue-100 ml-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Incluir Rubrica no Carimbo</Label>
                    <p className="text-[10px] text-muted-foreground">Exibir rubrica dentro do quadro do carimbo</p>
                  </div>
                  <Switch 
                    checked={rubricaNoCarimbo} 
                    onCheckedChange={setRubricaNoCarimbo}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Assinatura</Label>
                    <p className="text-[10px] text-muted-foreground">Inserir imagem da assinatura</p>
                  </div>
                  <Switch 
                    checked={incluirAssinatura} 
                    onCheckedChange={setIncluirAssinatura} 
                    disabled={!profile?.assinatura_url}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Rubrica</Label>
                    <p className="text-[10px] text-muted-foreground">Em todas as páginas</p>
                  </div>
                  <Switch 
                    checked={incluirRubrica} 
                    onCheckedChange={setIncluirRubrica}
                    disabled={!profile?.rubrica_url}
                  />
                </div>
              </div>
              {!profile?.assinatura_url && !profile?.rubrica_url && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 italic">
                  Atenção: Cadastre sua assinatura e rubrica no seu perfil para habilitar estas opções.
                </p>
              )}
            </div>

              {/* QR Code only authentication option */}
              <div className="flex items-center justify-between rounded-lg border p-3 border-primary/20 bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="font-medium flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Apenas Autenticação por QR Code
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Remove assinatura e carimbo, mantendo apenas o QR Code de verificação
                  </p>
                </div>
                <Switch 
                  checked={apenasQrCode} 
                  onCheckedChange={(v) => {
                    setApenasQrCode(v);
                    if (v) {
                      setIncluirCarimbo(false);
                      setIncluirAssinatura(false);
                      setIncluirRubrica(false);
                    }
                  }} 
                />
              </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={resetForm}>{t("common.cancel")}</Button>
              <Button
                disabled={!pacienteId || !conteudo.trim() || (tipo === "outros" && !titulo.trim()) || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? t("common.saving") : editingDoc ? t("common.save") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentosClinicos;
