import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarCheck, DollarSign, AlertTriangle, CheckCircle2, Clock, TrendingUp, UserCheck } from "lucide-react";

interface KPIData {
  pacientesAtivos: number;
  pacientesUnicos: number;
  sessoesTotal: number;
  realizadas: number;
  faltas: number;
  canceladas: number;
  sessoesTotalAnt: number;
  realizadasAnt: number;
  receitaAtual: number;
  receitaAnterior: number;
  crescimentoReceita: number;
  horasTrabalhadas: number;
  ticketMedio: number;
  taxaPresenca: number;
  taxaFalta: number;
  taxaFaltaAnt: number;
}

interface Props {
  kpis: KPIData;
}

export function AdvancedKPIs({ kpis }: Props) {
  const cards = [
    {
      title: "Pacientes Ativos",
      value: String(kpis.pacientesAtivos),
      sub: `${kpis.pacientesUnicos} únicos no mês`,
      icon: Users,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400",
    },
    {
      title: "Sessões do Mês",
      value: String(kpis.sessoesTotal),
      sub: `${kpis.realizadas} realizadas`,
      icon: CalendarCheck,
      badge: kpis.sessoesTotalAnt > 0
        ? `${kpis.sessoesTotal >= kpis.sessoesTotalAnt ? "+" : ""}${Math.round(((kpis.sessoesTotal - kpis.sessoesTotalAnt) / kpis.sessoesTotalAnt) * 100)}%`
        : null,
      badgeUp: kpis.sessoesTotal >= kpis.sessoesTotalAnt,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400",
    },
    {
      title: "Comissão do Mês",
      value: `R$ ${kpis.receitaAtual.toFixed(2)}`,
      sub: `Ticket médio: R$ ${kpis.ticketMedio.toFixed(2)}`,
      icon: DollarSign,
      badge: kpis.crescimentoReceita !== 0 ? `${kpis.crescimentoReceita > 0 ? "+" : ""}${kpis.crescimentoReceita}%` : null,
      badgeUp: kpis.crescimentoReceita >= 0,
      color: "text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-400",
    },
    {
      title: "Taxa de Presença",
      value: `${kpis.taxaPresenca}%`,
      sub: `${kpis.faltas} faltas • ${kpis.horasTrabalhadas}h trabalhadas`,
      icon: kpis.taxaPresenca >= 85 ? CheckCircle2 : AlertTriangle,
      badge: kpis.taxaFaltaAnt > 0 && kpis.taxaFalta !== kpis.taxaFaltaAnt
        ? `Faltas: ${kpis.taxaFalta > kpis.taxaFaltaAnt ? "+" : ""}${kpis.taxaFalta - kpis.taxaFaltaAnt}pp`
        : null,
      badgeUp: kpis.taxaFalta <= kpis.taxaFaltaAnt,
      color: kpis.taxaPresenca >= 85
        ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400"
        : "text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            <div className={`rounded-lg p-2 ${c.color}`}>
              <c.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{c.value}</span>
              {c.badge && (
                <Badge variant={c.badgeUp ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                  {c.badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
