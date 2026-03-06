import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Calendar, FileText, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface PacienteSession {
  paciente_id: string;
  session_token: string;
  nome: string;
  expires_at: string;
}

export default function DashboardPaciente() {
  const navigate = useNavigate();
  const [pacienteSession, setPacienteSession] = useState<PacienteSession | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("paciente_session");
    if (!stored) {
      navigate("/paciente-access");
      return;
    }

    const session = JSON.parse(stored) as PacienteSession;
    const expiresAt = new Date(session.expires_at);
    
    if (new Date() > expiresAt) {
      localStorage.removeItem("paciente_session");
      toast({ title: "Sessão expirada", description: "Faça login novamente" });
      navigate("/paciente-access");
      return;
    }

    setPacienteSession(session);
  }, [navigate]);

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos-paciente", pacienteSession?.paciente_id],
    queryFn: async () => {
      if (!pacienteSession) return [];
      
      const { data, error } = await (supabase.from("agendamentos") as any)
        .select(`
          id,
          data_horario,
          duracao_minutos,
          status,
          tipo_atendimento,
          profiles (nome)
        `)
        .eq("paciente_id", pacienteSession.paciente_id)
        .order("data_horario", { ascending: true });

      if (error) {
        console.error("Erro ao buscar agendamentos:", error);
        return [];
      }

      return data || [];
    },
    enabled: !!pacienteSession,
  });

  const handleLogout = () => {
    localStorage.removeItem("paciente_session");
    toast({ title: "Desconectado com sucesso" });
    navigate("/paciente-access");
  };

  if (!pacienteSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const proximasSessionoes = agendamentos.filter((a: any) => {
    const data = new Date(a.data_horario);
    return data > new Date() && a.status !== "cancelado";
  });

  const sessoesConcluidas = agendamentos.filter((a: any) => a.status === "realizado");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Minha Área</h1>
            <p className="text-sm text-slate-600">Bem-vindo, {pacienteSession.nome}!</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Próximas Sessões</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{proximasSessionoes.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sessões Realizadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{sessoesConcluidas.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tipo de Atendimento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold capitalize">
                {agendamentos[0]?.tipo_atendimento || "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Próximas Sessões */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximas Sessões
            </CardTitle>
            <CardDescription>
              Confira as datas e horários dos seus atendimentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proximasSessionoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma sessão agendada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proximasSessionoes.slice(0, 5).map((agend: any) => (
                  <div key={agend.id} className="p-4 border rounded-lg hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {new Date(agend.data_horario).toLocaleDateString("pt-BR", {
                            weekday: "long",
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-slate-600">
                          {new Date(agend.data_horario).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} • {agend.duracao_minutos}min
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Profissional: {agend.profiles?.nome || "Não definido"}
                        </p>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        {agend.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Minhas Informações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Minhas Informações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-semibold">{pacienteSession.nome}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sessão ativa até</p>
                <p className="font-semibold">
                  {new Date(pacienteSession.expires_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
