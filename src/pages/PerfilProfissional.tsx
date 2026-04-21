import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useI18n } from "@/modules/shared/hooks/useI18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Upload, Loader2, Download } from "lucide-react";
import { ProfessionalForm } from "@/components/profissionais/ProfessionalForm";
import { toast } from "sonner";

function sanitizeFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const rawExt = lastDot > 0 ? fileName.slice(lastDot) : "";
  const sanitizedBase = baseName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const finalBase = sanitizedBase || "arquivo";
  const sanitizedExt = rawExt ? "." + rawExt.slice(1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return finalBase + sanitizedExt;
}

const PerfilProfissional = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docNome, setDocNome] = useState("");

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["my-professional-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["my-professional-docs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase.from("professional_documents") as any)
        .select("*").eq("profissional_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      if (!user || !profileData) throw new Error("Perfil não encontrado");
      
      const updateData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone || null,
        bio: formData.bio || null,
        graduacao: formData.graduacao || null,
        especialidade: formData.especialidade || null,
        registro_profissional: formData.registro_profissional || null,
        cursos: formData.cursos ? formData.cursos.split(",").map((c: string) => c.trim()).filter(Boolean) : [],
        aceita_teleconsulta: formData.aceita_teleconsulta,
        teleconsulta_plataforma: formData.teleconsulta_plataforma || null,
        teleconsulta_link: formData.teleconsulta_link || null,
        aceita_domiciliar: formData.aceita_domiciliar,
        domiciliar_raio_km: formData.domiciliar_raio_km ? parseFloat(formData.domiciliar_raio_km) : null,
        domiciliar_valor_adicional: formData.domiciliar_valor_adicional ? parseFloat(formData.domiciliar_valor_adicional) : 0,
        domiciliar_observacoes: formData.domiciliar_observacoes || null,
        conselho_profissional: formData.conselho_profissional || null,
        registro_conselho: formData.registro_conselho || null,
        cor_agenda: formData.cor_agenda || "#3b82f6",
        assinatura_url: formData.assinatura_url || null,
        rubrica_url: formData.rubrica_url || null,
        foto_url: formData.foto_url || null,
        tipo_contratacao: formData.tipo_contratacao || "autonomo",
        cnpj: formData.cnpj || null,
        cpf: formData.cpf || null,
        rg: formData.rg || null,
        data_nascimento: formData.data_nascimento || null,
        estado_civil: formData.estado_civil || "solteiro",
        endereco: formData.endereco || null,
        numero: formData.numero || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        cep: formData.cep || null,
        // Novos campos de contrato
        contract_raio_nao_concorrencia_km: formData.contract_raio_nao_concorrencia_km ? parseFloat(formData.contract_raio_nao_concorrencia_km) : null,
        contract_multa_nao_captacao_fator: formData.contract_multa_nao_captacao_fator ? parseInt(formData.contract_multa_nao_captacao_fator) : null,
        contract_multa_nao_captacao_valor: formData.contract_multa_nao_captacao_valor ? parseFloat(formData.contract_multa_nao_captacao_valor) : null,
        contract_dia_pagamento_comissao: formData.contract_dia_pagamento_comissao ? parseInt(formData.contract_dia_pagamento_comissao) : null,
        contract_prazo_aviso_previo_dias: formData.contract_prazo_aviso_previo_dias ? parseInt(formData.contract_prazo_aviso_previo_dias) : null,
        contract_multa_uso_marca_valor: formData.contract_multa_uso_marca_valor ? parseFloat(formData.contract_multa_uso_marca_valor) : null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updateData as any)
        .eq("id", (profileData as any).id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("profile.updated"));
      queryClient.invalidateQueries({ queryKey: ["my-professional-profile"] });
    },
    onError: (e: any) => toast.error(t("common.error"), { description: e.message }),
  });

  const handleDeleteDoc = async (doc: any) => {
    await supabase.storage.from("professional-documents").remove([doc.file_path]);
    await (supabase.from("professional_documents") as any).delete().eq("id", doc.id);
    queryClient.invalidateQueries({ queryKey: ["my-professional-docs"] });
    toast.success(t("profile.doc_removed"));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = sanitizeFileName(file.name);
        const filePath = `${user.id}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("professional-documents").upload(filePath, file);
        if (upErr) throw upErr;
        const { error: dbErr } = await (supabase.from("professional_documents") as any).insert({
          profissional_id: user.id,
          nome: docNome.trim() || file.name,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
        });
        if (dbErr) throw dbErr;
      }
      queryClient.invalidateQueries({ queryKey: ["my-professional-docs"] });
      toast.success("Documento(s) enviado(s)!");
      setDocNome("");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from("professional-documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (profileLoading) {
    return <div className="flex items-center justify-center h-64 animate-pulse">Carregando perfil...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">{t("profile.title")}</h1>
          <p className="text-muted-foreground">Gerencie suas informações profissionais e de contato</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-sm bg-muted/20">
          <CardHeader>
            <CardTitle className="text-lg">Informações do meu Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfessionalForm
              initialData={profileData}
              onSubmit={async (data) => saveMutation.mutate(data)}
              loading={saveMutation.isPending}
              canChangeRole={false}
            />
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" /> {t("profile.documents")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Nome do documento (opcional)"
                value={docNome}
                onChange={(e) => setDocNome(e.target.value)}
                className="flex-1"
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                title="Upload de documentos"
                onChange={handleUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Enviando..." : "Anexar Documento"}
              </Button>
            </div>

            {documents.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">{t("profile.no_docs")}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.nome}</p>
                        <p className="text-xs text-muted-foreground">{((doc.file_size || 0) / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)} title="Baixar">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDoc(doc)} title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default PerfilProfissional;
