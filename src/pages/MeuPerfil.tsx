import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Phone, Mail, MapPin, FileText } from "lucide-react";
import { PatientAttachments } from "@/components/clinical/PatientAttachments";

const MeuPerfil = () => {
  const { patientId, profile } = useAuth();

  const { data: paciente, isLoading } = useQuery({
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

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando seus dados...</div>;
  }

  if (!paciente) {
    return <div className="p-8 text-center text-muted-foreground">Perfil não encontrado.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Meu Perfil</h1>
        <p className="text-muted-foreground">Seus dados pessoais e documentos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Nome</p>
              <p className="font-medium">{paciente.nome}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">CPF</p>
              <p className="font-medium">{paciente.cpf || "Não informado"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground text-xs">Telefone</p>
                <p className="font-medium">{paciente.telefone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="font-medium">{paciente.email || "Não informado"}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Data de Nascimento</p>
              <p className="font-medium">
                {paciente.data_nascimento ? format(new Date(paciente.data_nascimento), "dd/MM/yyyy") : "Não informado"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tipo de Atendimento</p>
              <p className="font-medium capitalize">{paciente.tipo_atendimento}</p>
            </div>
          </div>

          {/* Address */}
          {(paciente.rua || paciente.cidade || paciente.bairro) && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Endereço</p>
              </div>
              <p className="text-sm">
                {[paciente.rua, paciente.numero, paciente.complemento].filter(Boolean).join(", ")}
                {paciente.bairro && ` — ${paciente.bairro}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {[paciente.cidade, paciente.estado].filter(Boolean).join(" - ")}
                {paciente.cep && ` • CEP: ${paciente.cep}`}
              </p>
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
