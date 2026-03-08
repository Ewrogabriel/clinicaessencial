import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, DollarSign, Calendar, Trophy } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts';

const AGE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#4f46e5'];

const getAgeDistribution = (pacientes: any[]) => {
  const ranges = [
    { label: '0-17', min: 0, max: 17 },
    { label: '18-30', min: 18, max: 30 },
    { label: '31-45', min: 31, max: 45 },
    { label: '46-60', min: 46, max: 60 },
    { label: '61-75', min: 61, max: 75 },
    { label: '76+', min: 76, max: 200 },
  ];

  const today = new Date();
  const counts = ranges.map(r => ({ name: r.label, value: 0 }));
  let semData = 0;

  pacientes.forEach((p: any) => {
    if (!p.data_nascimento) { semData++; return; }
    const age = differenceInYears(today, new Date(p.data_nascimento));
    const idx = ranges.findIndex(r => age >= r.min && age <= r.max);
    if (idx >= 0) counts[idx].value++;
  });

  if (semData > 0) counts.push({ name: 'Sem data', value: semData });
  return counts.filter(c => c.value > 0);
};

import { useClinic } from "@/hooks/useClinic";

export default function Indicadores() {
  const { activeClinicId } = useClinic();
  const agora = new Date();
  const mesAnterior = subMonths(agora, 1);

  // MRR - Receita Recorrente Mensal
  const { data: mrr = 0 } = useQuery({
    queryKey: ["mrr"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("planos") as any)
        .select("valor")
        .eq("status", "ativo");

      if (error) throw error;
      return (data || []).reduce((sum: number, m: any) => sum + (m.valor || 0), 0);
    },
  });

  // Receita Contratada Futura
  const { data: receitaFutura = 0 } = useQuery({
    queryKey: ["receita-futura"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("planos") as any)
        .select("valor, data_vencimento")
        .eq("status", "ativo")
        .gte("data_vencimento", agora.toISOString());

      if (error) throw error;
      return (data || []).reduce((sum: number, m: any) => sum + (m.valor || 0), 0);
    },
  });

  // Taxa de Cancelamento
  const { data: metrics = { cancelados: 0, total: 0 } } = useQuery({
    queryKey: ["taxa-cancelamento"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("planos") as any)
        .select("status");

      if (error) throw error;

      const total = (data || []).length;
      const cancelados = (data || []).filter((m: any) => m.status === "cancelado").length;

      return { cancelados, total };
    },
  });

  const taxaCancelamento = metrics.total > 0 ? (metrics.cancelados / metrics.total * 100).toFixed(2) : 0;

  // Taxa de Ocupação Real
  const { data: ocupacao = { agendados: 0, capacidade: 0 } } = useQuery({
    queryKey: ["taxa-ocupacao", activeClinicId],
    queryFn: async () => {
      let q = supabase
        .from("agendamentos")
        .select("id")
        .gte("data_horario", startOfMonth(agora).toISOString())
        .lte("data_horario", endOfMonth(agora).toISOString())
        .in("status", ["agendado", "confirmado"]);
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data: agendamentos } = await q;

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
    queryKey: ["consultas-realizadas", activeClinicId],
    queryFn: async () => {
      let q = supabase
        .from("agendamentos")
        .select("id")
        .in("status", ["confirmado", "realizado"])
        .gte("data_horario", startOfMonth(agora).toISOString())
        .lte("data_horario", endOfMonth(agora).toISOString());
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).length;
    },
  });

  // Novos dados do Dashboard
  const { data: pacientesTotal = [] } = useQuery({
    queryKey: ["pacientes-total"],
    queryFn: async () => {
      const { data } = await (supabase.from("pacientes") as any).select("*");
      return data || [];
    },
  });

  const { data: financeData } = useQuery({
    queryKey: ["indicadores-finance", activeClinicId],
    queryFn: async () => {
      const inicioMesStr = startOfMonth(agora).toISOString().split('T')[0];
      const fimMesStr = endOfMonth(agora).toISOString().split('T')[0];
      let qPag = (supabase.from("pagamentos") as any).select("valor, status").gte("data_pagamento", inicioMesStr).lte("data_pagamento", fimMesStr);
      let qDesp = (supabase.from("expenses") as any).select("valor, status");
      let qCom = (supabase.from("commissions") as any).select("valor");
      if (activeClinicId) {
        qPag = qPag.eq("clinic_id", activeClinicId);
        qDesp = qDesp.eq("clinic_id", activeClinicId);
        qCom = qCom.eq("clinic_id", activeClinicId);
      }
      const { data: pagamentos } = await qPag;
      const { data: despesas } = await qDesp;
      const { data: comissoes } = await qCom;

      const receita = (pagamentos || [])?.filter((p: any) => p.status === 'pago').reduce((acc: number, p: any) => acc + Number(p.valor), 0) || 0;
      const custos = (despesas || [])?.filter((d: any) => d.status === 'pago').reduce((acc: number, d: any) => acc + Number(d.valor), 0) || 0;
      const repasses = (comissoes || [])?.reduce((acc: number, c: any) => acc + Number(c.valor), 0) || 0;

      return { receita, custos, repasses };
    },
  });

  const { data: frequencyRanking = [] } = useQuery({
    queryKey: ["indicadores-frequency-ranking", activeClinicId],
    queryFn: async () => {
      let qFreq = (supabase.from("agendamentos") as any)
        .select("paciente_id, status, pacientes(nome)");
      if (activeClinicId) qFreq = qFreq.eq("clinic_id", activeClinicId);
      const { data: agendamentos } = await qFreq;
      if (!agendamentos) return [];

      const stats: Record<string, { nome: string; total: number; cancelados: number; realizados: number }> = {};
      agendamentos.forEach((ag: any) => {
        const pid = ag.paciente_id;
        if (!stats[pid]) {
          stats[pid] = { nome: ag.pacientes?.nome || "?", total: 0, cancelados: 0, realizados: 0 };
        }
        stats[pid].total++;
        if (ag.status === "cancelado" || ag.status === "falta") stats[pid].cancelados++;
        if (ag.status === "realizado") stats[pid].realizados++;
      });

      return Object.entries(stats)
        .map(([id, s]) => ({
          id,
          nome: s.nome,
          total: s.total,
          cancelados: s.cancelados,
          realizados: s.realizados,
          taxa: s.total > 0 ? Math.round(((s.total - s.cancelados) / s.total) * 100) : 0,
        }))
        .sort((a, b) => b.taxa - a.taxa || b.realizados - a.realizados)
        .slice(0, 5);
    },
  });

  const chartData = [
    { name: 'Receita', valor: financeData?.receita || 0, color: '#10b981' },
    { name: 'Despesas', valor: financeData?.custos || 0, color: '#ef4444' },
    { name: 'Comissões', valor: financeData?.repasses || 0, color: '#f59e0b' },
  ];

  const ageData = getAgeDistribution(pacientesTotal);

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

      {/* Gráficos Movidos do Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fluxo Financeiro Mensal</CardTitle>
            <CardDescription>Receitas vs Custos vs Repasses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Pacientes</CardTitle>
            <CardDescription>Por faixa etária (Total da clínica)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {ageData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nenhum dado demográfico disponível
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {ageData.map((_, index) => (
                        <Cell key={`age-${index}`} fill={AGE_COLORS[index % AGE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Frequência */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Melhores Taxas de Comparecimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {frequencyRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aguardando dados de sessões...</p>
            ) : (
              <div className="space-y-4">
                {frequencyRanking.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700" :
                        i === 1 ? "bg-gray-100 text-gray-600" :
                          i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                      }`}>
                      {i + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.realizados} realizados · {p.total} total</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{p.taxa}%</p>
                      <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.taxa >= 80 ? "bg-green-500" : p.taxa >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${p.taxa}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Análise Estratégica original mantida e limpa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sugestões de Crescimento</CardTitle>
            <CardDescription>
              Estratégias baseadas em seus KPIs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border-l-4 border-blue-500 bg-blue-50/50 rounded">
              <h3 className="font-semibold text-blue-900 text-sm">Up-selling e Cross-selling</h3>
              <p className="text-xs text-blue-800 mt-1">
                Ofereça produtos complementares aos clientes ativos.
              </p>
            </div>
            <div className="p-4 border-l-4 border-green-500 bg-green-50/50 rounded">
              <h3 className="font-semibold text-green-900 text-sm">Fidelização</h3>
              <p className="text-xs text-green-800 mt-1">
                Incentive pacotes maiores para reduzir a taxa de cancelamento.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
