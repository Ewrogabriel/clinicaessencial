import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Activity, AlertTriangle } from "lucide-react";

const stats = [
  {
    title: "Pacientes Ativos",
    value: "0",
    icon: Users,
    description: "Nenhum paciente cadastrado",
  },
  {
    title: "Atendimentos Hoje",
    value: "0",
    icon: Calendar,
    description: "Nenhum agendamento",
  },
  {
    title: "Sessões na Semana",
    value: "0",
    icon: Activity,
    description: "Nenhuma sessão",
  },
  {
    title: "Avisos",
    value: "0",
    icon: AlertTriangle,
    description: "Nenhum aviso pendente",
  },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Visão geral da clínica
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
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
          <CardHeader>
            <CardTitle className="text-lg">Próximos Atendimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhum atendimento agendado para hoje</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pacientes Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhum paciente cadastrado ainda</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
