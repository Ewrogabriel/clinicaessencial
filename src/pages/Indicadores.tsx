import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, DollarSign, Calendar } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Indicadores() {
  const agora = new Date();
  const mesAnterior = subMonths(agora, 1);

  // MRR - Receita Recorrente Mensal
  const { data: mrr = 0 } = useQuery({
    queryKey: ["mrr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("valor")
        .eq("status", "ativa")
        .eq("tipo", "recorrente");

      if (error) throw error;
      return (data || []).reduce((sum: number, m: any) => sum + (m.valor || 0), 0);
    },
  });

  // Receita Contratada Futura
  const { data: receitaFutura = 0 } = useQuery({
    queryKey: ["receita-futura"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("valor, data_vencimento")
        .eq("status", "ativa")
        .gte("data_vencimento", agora.toISOString());

      if (error) throw error;
      return (data || []).reduce((sum: number, m: any) => sum + (m.valor || 0), 0);
    },
  });

  // Taxa de Cancelamento
  const { data: metrics = { cancelados: 0, total: 0 } } = useQuery({
    queryKey: ["taxa-cancelamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("status");

      if (error) throw error;
      
      const total = (data || []).length;
      const cancelados = (data || []).filter((m: any) => m.status === "cancelada").length;
      
      return { cancelados, total };
    },
  });

  const taxaCancelamento = metrics.total > 0 ? (metrics.cancelados / metrics.total * 100).toFixed(2) : 0;

  // Taxa de Ocupação Real
  const { data: ocupacao = { agendados: 0, capacidade: 0 } } = useQuery({
    queryKey: ["taxa-ocupacao"],
    queryFn: async () => {
      const { data: agendamentos } = await supabase
        .from("agendamentos")
        .select("id")
        .gte("data_horario", startOfMonth(agora).toISOString())
        .lte("data_horario", endOfMonth(agora).toISOString())
        .in("status", ["agendado", "confirmado"]);

      // Estimar capacidade baseado em 5 horários por dia x 20 dias úteis
      const capacidade = 100;
      const agendados = (agendamentos || []).length;

      return { agendados, capacidade };
    },
  });

  const taxaOcupacao = ocupacao.capacidade > 0 
    ? (ocupacao.agendados / ocupacao.capacidade * 100).toFixed(2) 
    : 0;

  // Ticket Médio
  const { data: ticketMedio = 0 } = useQuery({
    queryKey: ["ticket-medio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("valor")
        .gte("data", startOfMonth(agora).toISOString())
        .lte("data", endOfMonth(agora).toISOString());

      if (error) throw error;
      
      const pagamentos = data || [];
      if (pagamentos.length === 0) return 0;
      
      const total = pagamentos.reduce((sum: number, p: any) => sum + (p.valor || 0), 0);
      return total / pagamentos.length;
    },
  });

  // Novos Pacientes
  const { data: novosPacientes = 0 } = useQuery({
    queryKey: ["novos-pacientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id")
        .gte("created_at", startOfMonth(agora).toISOString())
        .lte("created_at", endOfMonth(agora).toISOString());

      if (error) throw error;
      return (data || []).length;
    },
  });

  // Consultas Realizadas
  const { data: consultasRealizadas = 0 } = useQuery({
    queryKey: ["consultas-realizadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id")
        .in("status", ["confirmado", "realizado"])
        .gte("data_horario", startOfMonth(agora).toISOString())
        .lte("data_horario", endOfMonth(agora).toISOString());

      if (error) throw error;
      return (data || []).length;
    },
  });

  const KPICard = ({
    title,
    value,
    unit,
    icon: Icon,
    trend,
    description,
  }: {
    title: string;
    value: number | string;
    unit?: string;
    icon: any;
    trend?: "up" | "down";
    description?: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="w-4 h-4 text-gray-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <div className="text-2xl font-bold">
            {value}
            {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
              {trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          )}
        </div>
        {description && <p className="text-xs text-gray-500 mt-2">{description}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Indicadores de Negócio</h1>
        <p className="text-gray-600">
          Métricas e KPIs de {format(agora, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Receita Recorrente Mensal (MRR)"
          value={`R$ ${mrr.toFixed(2)}`}
          unit=""
          icon={DollarSign}
          trend="up"
          description="Receita previsível do mês"
        />

        <KPICard
          title="Receita Contratada Futura"
          value={`R$ ${receitaFutura.toFixed(2)}`}
          unit=""
          icon={Calendar}
          description="Matrículas ativas não vencidas"
        />

        <KPICard
          title="Taxa de Cancelamento"
          value={taxaCancelamento}
          unit="%"
          icon={TrendingDown}
          description={`${metrics.cancelados} de ${metrics.total} matrículas`}
        />

        <KPICard
          title="Taxa de Ocupação"
          value={taxaOcupacao}
          unit="%"
          icon={Calendar}
          description={`${ocupacao.agendados} de ${ocupacao.capacidade} slots`}
        />

        <KPICard
          title="Ticket Médio"
          value={`R$ ${ticketMedio.toFixed(2)}`}
          unit=""
          icon={DollarSign}
          description="Média por transação"
        />

        <KPICard
          title="Novos Pacientes"
          value={novosPacientes}
          unit=""
          icon={Users}
          description="Cadastrados neste mês"
        />

        <KPICard
          title="Consultas Realizadas"
          value={consultasRealizadas}
          unit=""
          icon={Calendar}
          description="Confirmadas ou realizadas"
        />
      </div>

      {/* Análise Adicional */}
      <Card>
        <CardHeader>
          <CardTitle>Estratégias de Aumento de Ticket Médio</CardTitle>
          <CardDescription>
            Recomendações para melhorar a receita por cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded">
            <h3 className="font-semibold text-blue-900">Up-selling e Cross-selling</h3>
            <p className="text-sm text-blue-800 mt-1">
              Ofereça produtos complementares ou pacotes premium aos clientes existentes
            </p>
          </div>

          <div className="p-4 border-l-4 border-green-500 bg-green-50 rounded">
            <h3 className="font-semibold text-green-900">Programas de Fidelidade</h3>
            <p className="text-sm text-green-800 mt-1">
              Crie incentivos para que clientes adquiram pacotes maiores ou frequência maior
            </p>
          </div>

          <div className="p-4 border-l-4 border-purple-500 bg-purple-50 rounded">
            <h3 className="font-semibold text-purple-900">Descontos Progressivos</h3>
            <p className="text-sm text-purple-800 mt-1">
              Implemente promoções como "Leve 3, Pague 2" ou descontos para lotes maiores
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
