import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import { Brain, TrendingUp, Users, Target, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChurnPrediction } from "@/components/intelligence/ChurnPrediction";
import { OccupancyReport } from "@/components/intelligence/OccupancyReport";

const Inteligencia = () => {
  const _unused = useAuth();
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  const { data: insights, isLoading } = useQuery({
    queryKey: ["ai-insights-data"],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();

      const { data: payments } = await (supabase.from("pagamentos").select("valor, data_pagamento, status").eq("status", "pago").gte("data_pagamento", sixMonthsAgo) as any);
      const { data: allPayments } = await (supabase.from("pagamentos").select("valor, status, data_vencimento").gte("data_pagamento", subMonths(new Date(), 3).toISOString().split("T")[0]) as any);

      const monthlyData: Record<string, number> = {};
      payments?.forEach((p: any) => {
        const month = format(new Date(p.data_pagamento), "MMM/yy", { locale: ptBR });
        monthlyData[month] = (monthlyData[month] || 0) + Number(p.valor);
      });
      const historicalRevenue = Object.entries(monthlyData).map(([name, valor]) => ({ name, valor }));

      // Prediction
      const values = historicalRevenue.map(d => d.valor);
      const predictedNext = values.length >= 2 ? values[values.length - 1] + (values[values.length - 1] - values[values.length - 2]) * 0.5 : values[0] || 0;

      const predictions = [
        { name: "Projeção 1", valor: predictedNext, isPrediction: true },
        { name: "Projeção 2", valor: predictedNext * 1.05, isPrediction: true },
      ];

      // Churn
      const thirtyDaysAgo = subMonths(new Date(), 1).toISOString();
      const { data: patients } = await (supabase.from("pacientes").select("id, nome, status").eq("status", "ativo") as any);
      const { data: recentSessions } = await (supabase.from("agendamentos").select("paciente_id").eq("status", "realizado").gte("data_horario", thirtyDaysAgo) as any);

      const activeInSessionIds = new Set(recentSessions?.map((s: any) => s.paciente_id));
      const churnRisk = patients?.filter((p: any) => !activeInSessionIds.has(p.id)) || [];

      // Appointments stats
      const { data: agendamentos } = await (supabase.from("agendamentos").select("status, profissional_id, paciente_id, profiles:profissional_id(nome)").gte("data_horario", sixMonthsAgo) as any);
      
      const totalAg = agendamentos?.length || 0;
      const realizados = agendamentos?.filter((a: any) => a.status === "realizado").length || 0;
      const faltas = agendamentos?.filter((a: any) => a.status === "falta").length || 0;
      const cancelados = agendamentos?.filter((a: any) => a.status === "cancelado").length || 0;

      // Inadimplência
      const today = new Date().toISOString().split("T")[0];
      const inadimplentes = (allPayments || []).filter((p: any) => p.status === "pendente" && p.data_vencimento && p.data_vencimento < today);
      const totalInadimplencia = inadimplentes.reduce((s: number, p: any) => s + Number(p.valor), 0);

      // Prof stats
      const profMap: Record<string, { nome: string; realizados: number; faltas: number }> = {};
      agendamentos?.forEach((a: any) => {
        const pid = a.profissional_id;
        if (!profMap[pid]) profMap[pid] = { nome: a.profiles?.nome || "—", realizados: 0, faltas: 0 };
        if (a.status === "realizado") profMap[pid].realizados++;
        if (a.status === "falta") profMap[pid].faltas++;
      });
      const profStats = Object.values(profMap);

      return {
        chartData: [...historicalRevenue, ...predictions],
        churnRisk,
        totalAg, realizados, faltas, cancelados,
        totalInadimplencia,
        inadimplentesCount: inadimplentes.length,
        totalRecebido: payments?.reduce((s: number, p: any) => s + Number(p.valor), 0) || 0,
        totalPacientes: patients?.length || 0,
        profStats,
        contextString: `
Período: últimos 6 meses
Total de pacientes ativos: ${patients?.length || 0}
Pacientes em risco de churn (sem sessão há 30+ dias): ${churnRisk.length}
Total de agendamentos: ${totalAg}
Realizados: ${realizados} | Faltas: ${faltas} | Cancelados: ${cancelados}
Taxa de presença: ${totalAg > 0 ? Math.round((realizados / totalAg) * 100) : 0}%
Faturamento total (6 meses): R$ ${(payments?.reduce((s: number, p: any) => s + Number(p.valor), 0) || 0).toFixed(2)}
Inadimplência: ${inadimplentes.length} pagamentos pendentes = R$ ${totalInadimplencia.toFixed(2)}
Profissionais: ${profStats.map(p => `${p.nome}: ${p.realizados} realizados, ${p.faltas} faltas`).join("; ")}
Receita mensal: ${historicalRevenue.map(h => `${h.name}: R$ ${h.valor.toFixed(2)}`).join(", ")}
        `.trim(),
      };
    },
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { context: insights?.contextString || "" },
      });
      if (error) throw error;
      return data.insights as string;
    },
    onSuccess: (data) => setAiInsights(data),
  });

  const taxaPresenca = insights?.totalAg ? Math.round((insights.realizados / insights.totalAg) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Inteligência Clínica</h1>
            <p className="text-muted-foreground">Insights preditivos e análise com auxílio de IA</p>
          </div>
        </div>
        <Button
          onClick={() => aiMutation.mutate()}
          disabled={aiMutation.isPending || !insights}
          className="gap-2"
        >
          {aiMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar Análise IA
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Taxa de Presença", value: `${taxaPresenca}%`, icon: TrendingUp, color: "text-emerald-600" },
          { label: "Risco de Churn", value: insights?.churnRisk?.length || 0, icon: AlertTriangle, color: "text-amber-600" },
          { label: "Inadimplência", value: `R$ ${(insights?.totalInadimplencia || 0).toFixed(0)}`, icon: Target, color: "text-red-600" },
          { label: "Pacientes Ativos", value: insights?.totalPacientes || 0, icon: Users, color: "text-blue-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* AI Insights */}
      {aiInsights && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Análise da IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{
              __html: aiInsights
                .replace(/## /g, '<h3 class="text-base font-semibold mt-4 mb-2">')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n- /g, '<br/>• ')
                .replace(/\n/g, '<br/>')
            }} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Previsão de Faturamento</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={insights?.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(val: number) => `R$ ${val.toFixed(2)}`} contentStyle={{ borderRadius: '8px' }} />
                  <Line
                    type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={3}
                    dot={(props: any) => {
                      if (props.payload.isPrediction) return <circle cx={props.cx} cy={props.cy} r={4} fill="#94a3b8" />;
                      return <circle cx={props.cx} cy={props.cy} r={4} fill="#10b981" />;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500"></div><span>Histórico</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-slate-400"></div><span>Projeção</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Pacientes em Risco (Churn)</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground italic">Analisando engajamento...</div>
            ) : (insights?.churnRisk?.length || 0) === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Todos os pacientes estão ativos! 🎉</div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-auto">
                {(insights?.churnRisk || []).slice(0, 10).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center font-bold text-xs">
                        {p.nome.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{p.nome}</span>
                    </div>
                    <Badge variant="outline" className="text-destructive border-destructive/30">Risco Alto</Badge>
                  </div>
                ))}
                {(insights?.churnRisk?.length || 0) > 10 && (
                  <p className="text-xs text-center text-muted-foreground mt-2">+{(insights?.churnRisk?.length || 0) - 10} outros</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Churn Prediction - Detailed */}
      <ChurnPrediction />

      {/* Occupancy Report */}
      <OccupancyReport />

      {/* Produtividade por Profissional */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Produtividade por Profissional</CardTitle></CardHeader>
        <CardContent>
          {(insights?.profStats?.length || 0) === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sem dados de atendimentos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={insights?.profStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" tickFormatter={(v: string) => v.split(" ")[0]} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="realizados" fill="hsl(168, 65%, 38%)" name="Realizados" radius={[4, 4, 0, 0]} />
                <Bar dataKey="faltas" fill="hsl(0, 72%, 51%)" name="Faltas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inteligencia;
