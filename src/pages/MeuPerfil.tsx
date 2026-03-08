import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Phone, Mail, MapPin, FileText, Edit2, Save, X, AlertCircle, CheckCircle2, Camera, Upload } from "lucide-react";
import { PatientAttachments } from "@/components/clinical/PatientAttachments";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

const MeuPerfil = () => {
  const { patientId, profile, loading: authLoading } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: paciente, isLoading, refetch } = useQuery({
    queryKey: ["patient-profile-self", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await (supabase
        .from("pacientes")
        .select("*")
        .eq("id", patientId)
        .single() as any);
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: pendingChanges = [], refetch: refetchPending } = useQuery({
    queryKey: ["patient-pending-changes", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("solicitacoes_alteracao_dados" as any) as any)
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching pending changes:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const submitChanges = useMutation({
    mutationFn: async () => {
      if (!patientId || !editData) throw new Error("Dados inválidos");

      // Create change request for admin approval
      const { error } = await (supabase
        .from("solicitacoes_alteracao_dados" as any) as any)
        .insert([{
          paciente_id: patientId,
          dados_atuais: paciente,
          dados_novos: editData,
          status: "pendente",
          motivo: "Alteração de dados do perfil"
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação enviada", description: "Suas alterações foram enviadas para aprovação do administrador." });
      setEditMode(false);
      setEditData(null);
      refetch();
      refetchPending();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patientId) return;

    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `pacientes/${patientId}/foto.${ext}`;
      const { error: upErr } = await supabase.storage.from("clinic-uploads").upload(path, file, { upsert: true });
      
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("clinic-uploads").getPublicUrl(path);
      const foto_url = urlData.publicUrl;

      // Update directly in database
      const { error: updateErr } = await (supabase
        .from("pacientes")
        .update({ foto_url })
        .eq("id", patientId) as any);

      if (updateErr) throw updateErr;

      toast({ title: "Foto atualizada com sucesso!" });
      refetch();
    } catch (error: any) {
      toast({ title: "Erro ao fazer upload", description: error.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando seus dados...</div>;
  }

  if (!paciente) {
    return <div className="p-8 text-center text-muted-foreground">Perfil não encontrado.</div>;
  }

  const displayData = editMode && editData ? editData : paciente;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Meu Perfil</h1>
          <p className="text-muted-foreground">Seus dados pessoais e documentos.</p>
        </div>
        {!editMode && (
          <Button onClick={() => { setEditMode(true); setEditData(paciente); }} variant="outline" size="sm">
            <Edit2 className="h-4 w-4 mr-2" /> Editar
          </Button>
        )}
      </div>

      {/* Pending Changes Alert */}
      {pendingChanges.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">Solicitações de alteração pendentes</p>
                <p className="text-sm text-blue-800">Você tem {pendingChanges.length} solicitação(ões) de alteração aguardando aprovação do administrador.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Foto de Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Foto de Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {displayData.foto_url ? (
                <img src={displayData.foto_url} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <User className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">Altere sua foto de perfil clicando em "Escolher arquivo"</p>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                  id="photo-upload"
                />
                <Button
                  asChild
                  variant="outline"
                  disabled={uploadingPhoto}
                >
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingPhoto ? "Enviando..." : "Escolher Arquivo"}
                  </label>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Dados Pessoais
          </CardTitle>
          {editMode && <CardDescription>Campos com * não podem ser editados (nome e CPF são imutáveis)</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm space-y-4">
            {/* Nome - Read only */}
            <div>
              <p className="text-muted-foreground text-xs">Nome *</p>
              <p className="font-medium">{displayData.nome}</p>
              {editMode && <p className="text-xs text-muted-foreground mt-1">Não pode ser alterado</p>}
            </div>

            {/* CPF - Read only */}
            <div>
              <p className="text-muted-foreground text-xs">CPF *</p>
              <p className="font-medium">{displayData.cpf || "Não informado"}</p>
              {editMode && <p className="text-xs text-muted-foreground mt-1">Não pode ser alterado</p>}
            </div>

            {/* Telefone - Editable */}
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-muted-foreground mt-1" />
              <div className="flex-1">
                <p className="text-muted-foreground text-xs">Telefone</p>
                {editMode ? (
                  <Input
                    value={editData.telefone || ""}
                    onChange={(e) => setEditData({ ...editData, telefone: e.target.value })}
                    placeholder="Digite o telefone"
                    className="mt-1"
                  />
                ) : (
                  <p className="font-medium">{displayData.telefone}</p>
                )}
              </div>
            </div>

            {/* Email - Editable */}
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-muted-foreground mt-1" />
              <div className="flex-1">
                <p className="text-muted-foreground text-xs">Email</p>
                {editMode ? (
                  <Input
                    type="email"
                    value={editData.email || ""}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    placeholder="Digite o email"
                    className="mt-1"
                  />
                ) : (
                  <p className="font-medium">{displayData.email || "Não informado"}</p>
                )}
              </div>
            </div>

            {/* Data de Nascimento - Editable */}
            <div>
              <p className="text-muted-foreground text-xs">Data de Nascimento</p>
              {editMode ? (
                <Input
                  type="date"
                  value={editData.data_nascimento ? editData.data_nascimento.split('T')[0] : ""}
                  onChange={(e) => setEditData({ ...editData, data_nascimento: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="font-medium">
                  {displayData.data_nascimento ? format(new Date(displayData.data_nascimento), "dd/MM/yyyy") : "Não informado"}
                </p>
              )}
            </div>

            {/* Tipo de Atendimento - Editable */}
            <div>
              <p className="text-muted-foreground text-xs">Tipo de Atendimento</p>
              {editMode ? (
                <select
                  value={editData.tipo_atendimento || ""}
                  onChange={(e) => setEditData({ ...editData, tipo_atendimento: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="individual">Individual</option>
                  <option value="dupla">Dupla</option>
                  <option value="grupal">Grupal</option>
                </select>
              ) : (
                <p className="font-medium capitalize">{displayData.tipo_atendimento}</p>
              )}
            </div>
          </div>

          {/* Address Section */}
          {(displayData.rua || displayData.cidade || displayData.bairro) && (
            <div className="mt-6 pt-4 border-t space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Endereço</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Street */}
                <div>
                  <p className="text-xs text-muted-foreground">Rua</p>
                  {editMode ? (
                    <Input
                      value={editData.rua || ""}
                      onChange={(e) => setEditData({ ...editData, rua: e.target.value })}
                      placeholder="Rua"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm">{displayData.rua || "-"}</p>
                  )}
                </div>

                {/* Number */}
                <div>
                  <p className="text-xs text-muted-foreground">Número</p>
                  {editMode ? (
                    <Input
                      value={editData.numero || ""}
                      onChange={(e) => setEditData({ ...editData, numero: e.target.value })}
                      placeholder="Número"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm">{displayData.numero || "-"}</p>
                  )}
                </div>

                {/* Complement */}
                <div>
                  <p className="text-xs text-muted-foreground">Complemento</p>
                  {editMode ? (
                    <Input
                      value={editData.complemento || ""}
                      onChange={(e) => setEditData({ ...editData, complemento: e.target.value })}
                      placeholder="Complemento (opcional)"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm">{displayData.complemento || "-"}</p>
                  )}
                </div>

                {/* CEP */}
                <div>
                  <p className="text-xs text-muted-foreground">CEP</p>
                  {editMode ? (
                    <Input
                      value={editData.cep || ""}
                      onChange={(e) => setEditData({ ...editData, cep: e.target.value })}
                      placeholder="CEP"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm">{displayData.cep || "-"}</p>
                  )}
                </div>

                {/* Neighborhood */}
                <div>
                  <p className="text-xs text-muted-foreground">Bairro</p>
                  {editMode ? (
                    <Input
                      value={editData.bairro || ""}
                      onChange={(e) => setEditData({ ...editData, bairro: e.target.value })}
                      placeholder="Bairro"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm">{displayData.bairro || "-"}</p>
                  )}
                </div>

                {/* City */}
                <div>
                  <p className="text-xs text-muted-foreground">Cidade</p>
                  {editMode ? (
                    <Input
                      value={editData.cidade || ""}
                      onChange={(e) => setEditData({ ...editData, cidade: e.target.value })}
                      placeholder="Cidade"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm">{displayData.cidade || "-"}</p>
                  )}
                </div>

                {/* State */}
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  {editMode ? (
                    <Input
                      value={editData.estado || ""}
                      onChange={(e) => setEditData({ ...editData, estado: e.target.value })}
                      placeholder="Estado"
                      className="mt-1"
                      maxLength={2}
                    />
                  ) : (
                    <p className="text-sm">{displayData.estado || "-"}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {editMode && (
            <div className="mt-6 flex gap-3 pt-4 border-t">
              <Button
                onClick={() => {
                  setEditMode(false);
                  setEditData(null);
                }}
                variant="outline"
              >
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              <Button
                onClick={() => submitChanges.mutate()}
                disabled={submitChanges.isPending}
                className="bg-primary"
              >
                <Save className="h-4 w-4 mr-2" /> {submitChanges.isPending ? "Enviando..." : "Enviar para Aprovação"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <PatientAttachments pacienteId={patientId!} />
    </div>
  );
};

export default MeuPerfil;
