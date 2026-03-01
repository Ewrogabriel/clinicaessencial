import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Activity, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PatientDashboard = () => {
  const { profile, patientId } = useAuth();

  const { data: agenda = [] } = useQuery({
    queryKey: ["patient-agenda", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          profiles:profissional_id (nome)
        `)
        .eq("paciente_id", patientId)
        .gte("data_horario", new Date().toISOString())
        .order("data_horario", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: planoAtivo } = useQuery({
    queryKey: ["patient-plano", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "ativo")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  const { data: avisos = [] } = useQuery({
    queryKey: ["avisos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avisos")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const hoje = new Date();
  const saudacao = hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          {saudacao}, {profile?.nome?.split(" ")[0]}! 👋
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao seu portal de saúde.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sessões Restantes
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {planoAtivo ? `${(planoAtivo as any).sessoes_restantes ?? 0} / ${planoAtivo.total_sessoes}` : "0 / 0"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              No seu plano atual de {(planoAtivo as any)?.modalidade || "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Próxima Consulta
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {agenda.length > 0 
                ? format(new Date(agenda[0].data_horario), "dd 'de' MMM, HH:mm", { locale: ptBR })
                : "Nenhuma marcada"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {agenda.length > 0 ? `Com ${(agenda[0] as any).profiles?.nome}` : "Agende uma nova sessão"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status Financeiro
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
              Em dia
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Nenhuma pendência encontrada
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suas Próximas Sessões</CardTitle>
          </CardHeader>
          <CardContent>
            {agenda.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Nenhum agendamento futuro encontrado.
              </div>
            ) : (
              <div className="space-y-4">
                {agenda.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="font-medium text-sm">{format(new Date(item.data_horario), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                      <p className="text-xs text-muted-foreground">{item.profiles?.nome} • {item.modalidade}</p>
                    </div>
                    <Badge variant="secondary">Confirmado</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Mural de Avisos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            {avisos.length === 0 ? (
               <p className="text-muted-foreground text-center py-4">Nenhum aviso no momento.</p>
            ) : (
               avisos.map((aviso) => (
                 <div key={aviso.id} className="bg-white p-3 rounded-md border shadow-sm">
                   <h4 className="font-semibold text-primary">{aviso.titulo}</h4>
                   <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{aviso.mensagem}</p>
                   <span className="text-[10px] text-muted-foreground mt-2 block">
                     {format(new Date(aviso.created_at), "dd/MM/yyyy", { locale: ptBR })}
                   </span>
                 </div>
               ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientDashboard;
