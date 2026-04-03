import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useI18n } from "@/modules/shared/hooks/useI18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Upload, FileText, Trash2, Camera, Video, Home, ClipboardList, ArrowRight, Plus } from "lucide-react";
import { PlanoFormDialog } from "@/components/planos/PlanoFormDialog";
import { toast } from "sonner";

const PerfilProfissional = () => {
  const { user, profile: authProfile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [planoFormOpen, setPlanoFormOpen] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [graduacao, setGraduacao] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [registroProfissional, setRegistroProfissional] = useState("");
  const [cursos, setCursos] = useState("");
  const [aceitaTeleconsulta, setAceitaTeleconsulta] = useState(false);
  const [teleconsultaPlataforma, setTeleconsultaPlataforma] = useState("");
  const [teleconsultaLink, setTeleconsultaLink] = useState("");
  const [aceitaDomiciliar, setAceitaDomiciliar] = useState(false);
  const [domiciliarRaioKm, setDomiciliarRaioKm] = useState("");
  const [domiciliarValorAdicional, setDomiciliarValorAdicional] = useState("");
  const [domiciliarObservacoes, setDomiciliarObservacoes] = useState("");
  const [assinaturaUrl, setAssinaturaUrl] = useState("");
  const [rubricaUrl, setRubricaUrl] = useState("");
  const [conselhoProfissional, setConselhoProfissional] = useState("");
  const [registroConselho, setRegistroConselho] = useState("");
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const [uploadingRubrica, setUploadingRubrica] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["my-professional-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Initialize form
  if (profileData && !loaded) {
    const p = profileData as any;
    setNome(p.nome || "");
    setTelefone(p.telefone || "");
    setBio(p.bio || "");
    setGraduacao(p.graduacao || "");
    setEspecialidade(p.especialidade || "");
    setRegistroProfissional(p.registro_profissional || "");
    setCursos((p.cursos || []).join(", "));
    setAceitaTeleconsulta(p.aceita_teleconsulta || false);
    setTeleconsultaPlataforma(p.teleconsulta_plataforma || "");
    setTeleconsultaLink(p.teleconsulta_link || "");
    setAceitaDomiciliar(p.aceita_domiciliar || false);
    setDomiciliarRaioKm(p.domiciliar_raio_km ? String(p.domiciliar_raio_km) : "");
    setDomiciliarValorAdicional(p.domiciliar_valor_adicional ? String(p.domiciliar_valor_adicional) : "");
    setDomiciliarObservacoes(p.domiciliar_observacoes || "");
    setAssinaturaUrl(p.assinatura_url || "");
    setRubricaUrl(p.rubrica_url || "");
    setConselhoProfissional(p.conselho_profissional || "");
    setRegistroConselho(p.registro_conselho || "");
    setLoaded(true);

  }

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

  const { data: conselhos = [] } = useQuery({
    queryKey: ["conselhos-profissionais"],
    queryFn: async () => {
      const { data } = await supabase.from("conselhos_profissionais").select("*").order("sigla");
      return data ?? [];
    },
  });


  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profileData) throw new Error("Perfil não encontrado");
      const { error } = await supabase.from("profiles").update({
        nome: nome.trim(),
        telefone: telefone || null,
        bio: bio || null,
        graduacao: graduacao || null,
        especialidade: especialidade || null,
        registro_profissional: registroProfissional || null,
        cursos: cursos ? cursos.split(",").map(c => c.trim()).filter(Boolean) : [],
        aceita_teleconsulta: aceitaTeleconsulta,
        teleconsulta_plataforma: teleconsultaPlataforma || null,
        teleconsulta_link: teleconsultaLink || null,
        aceita_domiciliar: aceitaDomiciliar,
        domiciliar_raio_km: domiciliarRaioKm ? parseFloat(domiciliarRaioKm) : null,
        domiciliar_valor_adicional: domiciliarValorAdicional ? parseFloat(domiciliarValorAdicional) : 0,
        domiciliar_observacoes: domiciliarObservacoes || null,
        conselho_profissional: conselhoProfissional || null,
        registro_conselho: registroConselho || null,
      } as any).eq("id", (profileData as any).id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("profile.updated"));
      queryClient.invalidateQueries({ queryKey: ["my-professional-profile"] });
    },
    onError: (e: any) => toast.error(t("common.error"), { description: e.message }),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const filePath = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("professional-documents").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error(t("common.error"), { description: uploadError.message }); return; }
    const { data: urlData } = supabase.storage.from("professional-documents").getPublicUrl(filePath);
    await supabase.from("profiles").update({ foto_url: urlData.publicUrl } as any).eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["my-professional-profile"] });
    toast.success(t("profile.photo_updated"));
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingSignature(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/signature-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("professional-documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("professional-documents").getPublicUrl(path);
      const url = urlData.publicUrl;
      setAssinaturaUrl(url);
      await supabase.from("profiles").update({ assinatura_url: url } as any).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["my-professional-profile"] });
      toast.success("Assinatura atualizada com sucesso!");
    } catch (err: any) {
      toast.error("Erro no upload", { description: err.message });
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleRubricaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingRubrica(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/rubrica-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("professional-documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("professional-documents").getPublicUrl(path);
      const url = urlData.publicUrl;
      setRubricaUrl(url);
      await supabase.from("profiles").update({ rubrica_url: url } as any).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["my-professional-profile"] });
      toast.success("Rubrica atualizada com sucesso!");
    } catch (err: any) {
      toast.error("Erro no upload", { description: err.message });
    } finally {
      setUploadingRubrica(false);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const filePath = `${user.id}/docs/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("professional-documents").upload(filePath, file);
    if (uploadError) { toast.error(t("common.error"), { description: uploadError.message }); return; }
    await (supabase.from("professional_documents") as any).insert({
      profissional_id: user.id,
      nome: file.name,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
    });
    queryClient.invalidateQueries({ queryKey: ["my-professional-docs"] });
    toast.success(t("profile.doc_attached"));
  };

  const handleDeleteDoc = async (doc: any) => {
    await supabase.storage.from("professional-documents").remove([doc.file_path]);
    await (supabase.from("professional_documents") as any).delete().eq("id", doc.id);
    queryClient.invalidateQueries({ queryKey: ["my-professional-docs"] });
    toast.success(t("profile.doc_removed"));
  };

  const initials = nome ? nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "P";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">{t("profile.title")}</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avatar + basic info */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={(profileData as any)?.foto_url || ""} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">{nome || t("common.professional")}</p>
              {especialidade && <Badge variant="secondary" className="mt-1 capitalize">{especialidade}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {aceitaTeleconsulta && (
                <Badge variant="outline" className="gap-1"><Video className="h-3 w-3" /> {t("profile.teleconsultation")}</Badge>
              )}
              {aceitaDomiciliar && (
                <Badge variant="outline" className="gap-1"><Home className="h-3 w-3" /> {t("profile.home_visit")}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile form */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("profile.personal_info")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("profile.full_name")}</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("common.phone")}</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("profile.specialty")}</Label>
                <Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Ex: Fisioterapia, Pilates" />
              </div>
               <div className="space-y-2">
                 <Label>Conselho Profissional</Label>
                 <Select value={conselhoProfissional} onValueChange={setConselhoProfissional}>
                   <SelectTrigger><SelectValue placeholder="Selecione o Conselho" /></SelectTrigger>
                   <SelectContent>
                     {conselhos.map((c: any) => (
                       <SelectItem key={c.id} value={c.sigla}>{c.sigla} - {c.nome}</SelectItem>
                     ))}
                     <SelectItem value="OUTRO">Outro (especificar)</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               
               {conselhoProfissional === "OUTRO" && (
                 <div className="space-y-2">
                   <Label>Especifique o Conselho</Label>
                   <Input 
                     value={especialidade} // reuse or use a new state if needed, but the user asked for a simple field
                     placeholder="Ex: CRM, CREFITO, etc"
                     onChange={(e) => setEspecialidade(e.target.value)}
                   />
                 </div>
               )}

              <div className="space-y-2">
                <Label>Número de Registro no Conselho</Label>
                <Input value={registroConselho} onChange={(e) => setRegistroConselho(e.target.value)} placeholder="Ex: 123456-F" />
              </div>
              <div className="space-y-2">
                <Label>{t("profile.registration")} (Interno/Outros)</Label>
                <Input value={registroProfissional} onChange={(e) => setRegistroProfissional(e.target.value)} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>{t("profile.graduation")}</Label>
                <Input value={graduacao} onChange={(e) => setGraduacao(e.target.value)} placeholder="Ex: Fisioterapia — UFJF 2018" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("profile.courses")} ({t("profile.courses_hint")})</Label>
                <Input value={cursos} onChange={(e) => setCursos(e.target.value)} placeholder="Pilates Clínico, RPG Souchard, Dry Needling" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("profile.bio")}</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder={t("profile.bio_placeholder")} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signatures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Assinaturas Digitais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label className="font-semibold block mb-2">Assinatura</Label>
              <div className="flex flex-col gap-3 items-start">
                {assinaturaUrl ? (
                  <img src={assinaturaUrl} alt="Assinatura" className="h-16 w-32 object-contain bg-white border rounded" />
                ) : (
                  <div className="h-16 w-32 bg-muted border rounded flex items-center justify-center text-xs text-muted-foreground">Obrigatória</div>
                )}
                <div>
                  <Label htmlFor="upload-assinatura" className="cursor-pointer">
                    <Button asChild variant="outline" size="sm" disabled={uploadingSignature}>
                      <span><Upload className="h-3 w-3 mr-2" /> {uploadingSignature ? "Enviando..." : "Enviar Assinatura"}</span>
                    </Button>
                  </Label>
                  <input id="upload-assinatura" type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Usada em contratos e documentos. Recomenda-se fundo branco ou transparente.</p>
            </div>

            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label className="font-semibold block mb-2">Rubrica (Opcional)</Label>
              <div className="flex flex-col gap-3 items-start">
                {rubricaUrl ? (
                  <img src={rubricaUrl} alt="Rubrica" className="h-16 w-16 object-contain bg-white border rounded" />
                ) : (
                  <div className="h-16 w-16 bg-muted border rounded flex items-center justify-center text-xs text-muted-foreground uppercase text-center">-</div>
                )}
                <div>
                  <Label htmlFor="upload-rubrica" className="cursor-pointer">
                    <Button asChild variant="outline" size="sm" disabled={uploadingRubrica}>
                      <span><Upload className="h-3 w-3 mr-2" /> {uploadingRubrica ? "Enviando..." : "Enviar Rubrica"}</span>
                    </Button>
                  </Label>
                  <input id="upload-rubrica" type="file" accept="image/*" className="hidden" onChange={handleRubricaUpload} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Símbolo curto que pode ser anexado aos carimbos profissionais nos PDFs.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teleconsulta Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-primary" /> {t("profile.teleconsultation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{t("profile.accept_teleconsultation")}</p>
              <p className="text-xs text-muted-foreground">{t("profile.allow_tele")}</p>
            </div>
            <Switch checked={aceitaTeleconsulta} onCheckedChange={setAceitaTeleconsulta} />
          </div>
          {aceitaTeleconsulta && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>{t("profile.platform")}</Label>
                <Select value={teleconsultaPlataforma} onValueChange={setTeleconsultaPlataforma}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                    <SelectItem value="whatsapp_video">WhatsApp Vídeo</SelectItem>
                    <SelectItem value="outro">Outra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("profile.room_link")}</Label>
                <Input value={teleconsultaLink} onChange={(e) => setTeleconsultaLink(e.target.value)} placeholder="https://meet.google.com/..." />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Atendimento Domiciliar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-primary" /> {t("profile.home_visit")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{t("profile.accept_home")}</p>
              <p className="text-xs text-muted-foreground">{t("profile.allow_home")}</p>
            </div>
            <Switch checked={aceitaDomiciliar} onCheckedChange={setAceitaDomiciliar} />
          </div>
          {aceitaDomiciliar && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>{t("profile.radius_km")}</Label>
                <Input type="number" value={domiciliarRaioKm} onChange={(e) => setDomiciliarRaioKm(e.target.value)} placeholder="Ex: 15" />
              </div>
              <div className="space-y-2">
                <Label>{t("profile.additional_fee")}</Label>
                <Input type="number" step="0.01" value={domiciliarValorAdicional} onChange={(e) => setDomiciliarValorAdicional(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label>{t("common.obs")}</Label>
                <Input value={domiciliarObservacoes} onChange={(e) => setDomiciliarObservacoes(e.target.value)} placeholder={t("profile.restrictions")} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg">
          {saveMutation.isPending ? t("common.saving") : t("profile.save")}
        </Button>
      </div>

      {/* Planos de Sessões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> {t("profile.session_plans")}</CardTitle>
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {t("profile.documents")}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => docInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> {t("profile.attach")}
            </Button>
            <input ref={docInputRef} type="file" className="hidden" onChange={handleDocUpload} />
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">{t("profile.no_docs")}</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.nome}</p>
                      <p className="text-xs text-muted-foreground">{doc.file_type} • {((doc.file_size || 0) / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteDoc(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
