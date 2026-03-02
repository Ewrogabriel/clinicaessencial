import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Upload, FileText, Trash2, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PerfilProfissional = () => {
  const { user, profile: authProfile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [graduacao, setGraduacao] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [registroProfissional, setRegistroProfissional] = useState("");
  const [cursos, setCursos] = useState("");
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
    setNome((profileData as any).nome || "");
    setTelefone((profileData as any).telefone || "");
    setBio((profileData as any).bio || "");
    setGraduacao((profileData as any).graduacao || "");
    setEspecialidade((profileData as any).especialidade || "");
    setRegistroProfissional((profileData as any).registro_profissional || "");
    setCursos(((profileData as any).cursos || []).join(", "));
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
      } as any).eq("id", (profileData as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["my-professional-profile"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const filePath = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("professional-documents").upload(filePath, file, { upsert: true });
    if (uploadError) { toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("professional-documents").getPublicUrl(filePath);
    await supabase.from("profiles").update({ foto_url: urlData.publicUrl } as any).eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["my-professional-profile"] });
    toast({ title: "Foto atualizada!" });
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const filePath = `${user.id}/docs/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("professional-documents").upload(filePath, file);
    if (uploadError) { toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" }); return; }
    await (supabase.from("professional_documents") as any).insert({
      profissional_id: user.id,
      nome: file.name,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
    });
    queryClient.invalidateQueries({ queryKey: ["my-professional-docs"] });
    toast({ title: "Documento anexado!" });
  };

  const handleDeleteDoc = async (doc: any) => {
    await supabase.storage.from("professional-documents").remove([doc.file_path]);
    await (supabase.from("professional_documents") as any).delete().eq("id", doc.id);
    queryClient.invalidateQueries({ queryKey: ["my-professional-docs"] });
    toast({ title: "Documento removido." });
  };

  const initials = nome ? nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "P";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Meu Perfil Profissional</h1>

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
              <p className="font-semibold text-lg">{nome || "Profissional"}</p>
              {especialidade && <Badge variant="secondary" className="mt-1 capitalize">{especialidade}</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Profile form */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Informações Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Especialidade</Label>
                <Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Ex: Fisioterapia, Pilates" />
              </div>
              <div className="space-y-2">
                <Label>Registro Profissional (CREFITO)</Label>
                <Input value={registroProfissional} onChange={(e) => setRegistroProfissional(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Graduação</Label>
                <Input value={graduacao} onChange={(e) => setGraduacao(e.target.value)} placeholder="Ex: Fisioterapia — UFJF 2018" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Cursos e Especializações (separe por vírgula)</Label>
                <Input value={cursos} onChange={(e) => setCursos(e.target.value)} placeholder="Pilates Clínico, RPG Souchard, Dry Needling" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Bio / Sobre Mim</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Fale um pouco sobre sua experiência..." />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar Perfil"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Documentos & Certificados</CardTitle>
            <Button size="sm" variant="outline" onClick={() => docInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Anexar
            </Button>
            <input ref={docInputRef} type="file" className="hidden" onChange={handleDocUpload} />
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhum documento anexado.</p>
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
    </div>
  );
};

export default PerfilProfissional;
