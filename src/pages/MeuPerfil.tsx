import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinicSettings } from "@/modules/clinic/hooks/useClinicSettings";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Phone, Mail, MapPin, FileText, Edit2, Save, X, AlertCircle, CheckCircle2, Camera, Upload, FileDown, Clock, RotateCcw } from "lucide-react";
import { PatientAttachments } from "@/components/clinical/PatientAttachments";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";
import { toast } from "@/modules/shared/hooks/use-toast";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const MeuPerfil = () => {
  const { patientId, profile, loading: authLoading } = useAuth();
  const { data: clinicSettings } = useClinicSettings();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [rescheduleSession, setRescheduleSession] = useState<any>(null);

  const { data: paciente, isLoading, refetch } = useQuery({
    queryKey: ["patient-profile-self", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await (supabase
        .from("pacientes")
        .select("*")
        .eq("id", patientId)
        .maybeSingle() as any);
      if (error) throw error;
      return data ?? null;
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

  // Fetch cancelled/falta sessions for rescheduling
  const { data: cancelledSessions = [], refetch: refetchCancelled } = useQuery({
    queryKey: ["patient-cancelled-sessions", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await (supabase
        .from("agendamentos")
        .select("id, data_horario, tipo_atendimento, duracao_minutos, status, observacoes, profissional_id, paciente_id")
        .eq("paciente_id", patientId)
        .in("status", ["cancelado", "falta"])
        .order("data_horario", { ascending: false })
        .limit(15) as any);
      if (error) throw error;
      const sessions = data || [];
      // Enrich with professional names
      const profIds = [...new Set(sessions.map((s: any) => s.profissional_id))] as string[];
      const profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        (profs || []).forEach((p: { user_id: string; nome: string }) => { profMap[p.user_id] = p.nome; });
      }
      return sessions.map((s: any) => ({ ...s, profissional_nome: profMap[s.profissional_id] || "Profissional" }));
    },
    enabled: !!patientId,
  });

  // Fetch approved ficha requests with available PDFs
  const { data: approvedFichas = [] } = useQuery({
    queryKey: ["patient-approved-fichas", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const now = new Date().toISOString();
      const { data, error } = await (supabase
        .from("ficha_requests" as any) as any)
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "aprovado")
        .not("pdf_url", "is", null)
        .gte("pdf_available_until", now)
        .order("reviewed_at", { ascending: false });
      if (error) {
        console.error("Error fetching approved fichas:", error);
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

      {/* Available PDF from Approved Ficha Requests */}
      {approvedFichas.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileDown className="h-5 w-5 text-green-600" />
              Prontuário Disponível
            </CardTitle>
            <CardDescription>
              Seu prontuário foi aprovado e está disponível para download por tempo limitado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {approvedFichas.map((ficha: any) => {
                const expiryDate = new Date(ficha.pdf_available_until);
                const daysRemaining = differenceInDays(expiryDate, new Date());
                return (
                  <div key={ficha.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">Ficha Completa do Prontuário</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {daysRemaining > 0 ? `${daysRemaining} dias restantes` : "Expira hoje"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Aprovado em {format(new Date(ficha.reviewed_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => window.open(ficha.pdf_url, "_blank")}
                      className="gap-2"
                    >
                      <FileDown className="h-4 w-4" />
                      Baixar PDF
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancelled Sessions - Reschedule Requests */}
      {cancelledSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Sessões Desmarcadas
            </CardTitle>
            <CardDescription>
              Solicite o reagendamento de sessões canceladas ou perdidas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cancelledSessions.map((session: any) => (
                <div key={session.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {format(new Date(session.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.profissional_nome} • {session.tipo_atendimento} • {session.duracao_minutos}min
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={session.status === "falta" ? "destructive" : "outline"} className="text-xs">
                      {session.status === "falta" ? "Falta" : "Cancelado"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                      onClick={() => setRescheduleSession(session)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reagendar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <PatientAttachments pacienteId={patientId!} />

      {/* Reschedule Dialog */}
      <RescheduleDialog
        open={!!rescheduleSession}
        onOpenChange={(open) => !open && setRescheduleSession(null)}
        agendamento={rescheduleSession}
        onSuccess={() => {
          setRescheduleSession(null);
          refetchCancelled();
        }}
      />

      {/* Floating WhatsApp button */}
      {clinicSettings?.whatsapp && (
        <button
          onClick={() => {
            const phone = (clinicSettings.whatsapp as string).replace(/\D/g, "");
            const msg = encodeURIComponent(`Olá! Preciso de ajuda na minha conta de paciente.`);
            window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-lg px-4 py-3 text-sm font-semibold transition-colors"
          aria-label="Fale com a clínica via WhatsApp"
        >
          <WhatsAppIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Fale com a clínica</span>
        </button>
      )}
    </div>
  );
};

export default MeuPerfil;
