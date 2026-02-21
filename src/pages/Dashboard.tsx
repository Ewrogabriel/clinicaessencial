import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Activity, AlertTriangle, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const tipoLabels: Record<string, string> = {
  fisioterapia: "Fisioterapia",
  pilates: "Pilates",
  rpg: "RPG",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const ativos = pacientes.filter((p) => p.status === "ativo");
  const recentes = pacientes.slice(0, 5);

  const hoje = new Date();
  const saudacao =
    hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const stats = [
    {
      title: "Pacientes Ativos",
      value: String(ativos.length),
      icon: Users,
      description: ativos.length === 0 ? "Nenhum paciente ativo" : `de ${pacientes.length} cadastrados`,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "Atendimentos Hoje",
      value: "—",
      icon: Calendar,
      description: "Aguardando agenda",
      color: "text-blue-600 bg-blue-50",
    },
    {
      title: "Sessões na Semana",
      value: "—",
      icon: Activity,
      description: "Aguardando agenda",
      color: "text-violet-600 bg-violet-50",
    },
    {
      title: "Avisos",
      value: "0",
      icon: AlertTriangle,
      description: "Nenhum aviso pendente",
      color: "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          {saudacao}{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground">
          {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Próximos Atendimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Agenda será ativada após migração do banco</p>
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => navigate("/agenda")}
              >
                Ir para Agenda <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pacientes Recentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/pacientes")}>
              Ver todos <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">Nenhum paciente cadastrado ainda</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => navigate("/pacientes/novo")}
                >
                  Cadastrar primeiro paciente <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {p.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.telefone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">
                        {tipoLabels[p.tipo_atendimento] || p.tipo_atendimento}
                      </Badge>
                      <Badge
                        variant={p.status === "ativo" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {p.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
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

export default Dashboard;
