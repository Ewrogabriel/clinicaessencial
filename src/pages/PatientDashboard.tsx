import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GamificationDashboard } from "@/components/gamification/GamificationDashboard";
import {
  AlertCircle, Calendar, CreditCard, Package, Trophy, Info, Dumbbell,
  ClipboardList, FileText, MessageSquare, Handshake, User
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export default function PatientDashboard() {
  const { user, profile } = useAuth();
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();

  const { data: paciente } = useQuery({
    queryKey: ["paciente-by-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: avisos } = useQuery({
    queryKey: ["avisos-ativos", activeClinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("avisos")
        .select("*")
        .eq("ativo", true)
        .eq("clinic_id", activeClinicId!)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ["clinic-settings", activeClinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinicas")
        .select("*")
        .eq("id", activeClinicId!)
        .single();
      return data;
    },
    enabled: !!activeClinicId,
  });

  const { data: feriados } = useQuery({
    queryKey: ["feriados-proximos"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("feriados")
        .select("*")
        .gte("data", today)
        .order("data")
        .limit(3);
      return data || [];
    },
  });

  const { data: planosCount } = useQuery({
    queryKey: ["planos-exercicios-count", paciente?.id],
    queryFn: async () => {
      if (!paciente?.id) return 0;
      const { count } = await (supabase
        .from("planos_exercicios")
        .select("*", { count: "exact", head: true })
        .eq("paciente_id", paciente.id) as any)
        .eq("ativo", true);
      return (count as number) || 0;
    },
    enabled: !!paciente?.id,
  });

  if (!paciente) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sua conta não está vinculada a um cadastro de paciente. Entre em contato com a clínica.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const quickCards = [
    { label: "Minha Agenda", sub: "Ver sessões", icon: Calendar, route: "/minha-agenda", color: "text-primary", bg: "bg-primary/10", border: "border-l-primary" },
    { label: "Pagamentos", sub: "Financeiro", icon: CreditCard, route: "/meus-pagamentos", color: "text-green-600", bg: "bg-green-600/10", border: "border-l-green-600" },
    { label: "Exercícios", sub: `${planosCount} plano(s)`, icon: Dumbbell, route: "/planos-exercicios", color: "text-purple-600", bg: "bg-purple-600/10", border: "border-l-purple-600" },
    { label: "Meus Planos", sub: "Sessões", icon: ClipboardList, route: "/meus-planos", color: "text-amber-600", bg: "bg-amber-600/10", border: "border-l-amber-600" },
    { label: "Convênios", sub: "Parceiros", icon: Handshake, route: "/convenios", color: "text-sky-600", bg: "bg-sky-600/10", border: "border-l-sky-600" },
    { label: "Mensagens", sub: "Chat", icon: MessageSquare, route: "/mensagens", color: "text-rose-600", bg: "bg-rose-600/10", border: "border-l-rose-600" },
    { label: "Contratos", sub: "Documentos", icon: FileText, route: "/contratos", color: "text-teal-600", bg: "bg-teal-600/10", border: "border-l-teal-600" },
    { label: "Meu Perfil", sub: "Dados", icon: User, route: "/meu-perfil", color: "text-indigo-600", bg: "bg-indigo-600/10", border: "border-l-indigo-600" },
  ];

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {profile?.nome || paciente?.nome}! 👋
        </h1>
        <p className="text-muted-foreground">Bem-vindo ao seu portal</p>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {quickCards.map((c) => (
          <Card
            key={c.route}
            className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${c.border}`}
            onClick={() => navigate(c.route)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 ${c.bg} rounded-lg shrink-0`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gamification + Info */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-amber-500" />
              Minhas Conquistas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GamificationDashboard pacienteId={paciente.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5 text-primary" />
              Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avisos */}
            <div>
              <h4 className="font-semibold mb-2 text-sm">Mural de Avisos</h4>
              {avisos && avisos.length > 0 ? (
                <div className="space-y-2">
                  {avisos.map((aviso) => (
                    <div key={aviso.id} className="p-3 bg-muted rounded-lg">
                      <p className="font-medium text-sm">{aviso.titulo}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{aviso.mensagem}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum aviso no momento</p>
              )}
            </div>

            {/* Feriados */}
            <div>
              <h4 className="font-semibold mb-2 text-sm">Próximos Feriados</h4>
              {feriados && feriados.length > 0 ? (
                <div className="space-y-2">
                  {feriados.map((f) => (
                    <div key={f.id} className="p-3 bg-muted rounded-lg">
                      <p className="font-medium text-sm">{f.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(f.data), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem feriados próximos</p>
              )}
            </div>

            {/* Dados da Clínica */}
            <div>
              <h4 className="font-semibold mb-2 text-sm">Dados da Clínica</h4>
              {clinicSettings ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{clinicSettings.nome}</p>
                  {clinicSettings.telefone && <p className="text-muted-foreground">📞 {clinicSettings.telefone}</p>}
                  {clinicSettings.whatsapp && <p className="text-muted-foreground">💬 {clinicSettings.whatsapp}</p>}
                  {clinicSettings.endereco && (
                    <p className="text-muted-foreground text-xs">
                      📍 {clinicSettings.endereco}
                      {clinicSettings.numero && `, ${clinicSettings.numero}`}
                      {clinicSettings.bairro && ` - ${clinicSettings.bairro}`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
