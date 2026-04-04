import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useI18n } from "@/modules/shared/hooks/useI18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, Video, Home, ClipboardList, ArrowRight, Plus } from "lucide-react";
import { PlanoFormDialog } from "@/components/planos/PlanoFormDialog";
import { ProfessionalForm } from "@/components/profissionais/ProfessionalForm";
import { toast } from "sonner";

const PerfilProfissional = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [planoFormOpen, setPlanoFormOpen] = useState(false);

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

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("pacientes").select("id, nome").eq("status", "ativo").order("nome");
      return data ?? [];
    },
  });

  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-ativas"],
    queryFn: async () => {
      const { data } = await supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
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

        {/* Planos de Sessões */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" /> {t("profile.session_plans")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("profile.session_plans_description")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setPlanoFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> {t("profile.new_plan")}
              </Button>
              <Button variant="outline" onClick={() => navigate("/planos")}>
                <ArrowRight className="h-4 w-4 mr-2" /> {t("profile.manage_plans")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" /> {t("profile.documents")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">{t("profile.no_docs")}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{doc.nome}</p>
                        <p className="text-xs text-muted-foreground">{((doc.file_size || 0) / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDoc(doc)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PlanoFormDialog
        open={planoFormOpen}
        onOpenChange={setPlanoFormOpen}
        editPlano={null}
        pacientes={pacientes}
        modalidades={modalidades}
        userId={user?.id || ""}
      />
    </div>
  );
};

export default PerfilProfissional;
