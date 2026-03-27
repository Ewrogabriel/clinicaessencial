import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Target, 
  BarChart3, PieChart as PieChartIcon, Info, Lightbulb,
  ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function InteligenciaBI() {
  const { activeClinicId } = useClinic();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["bi-metrics", activeClinicId, selectedMonth],
    queryFn: async () => {
      if (!activeClinicId) return null;
      const { data, error } = await (supabase as any).rpc("get_bi_metrics", {
        p_clinic_id: activeClinicId,
        p_mes: `${selectedMonth}-01`
      });
      if (error) throw error;
      return data;
    },
    enabled: !!activeClinicId
  });

  const { data: history = [] } = useQuery({
    queryKey: ["bi-history", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const results = [];
      // Pegar últimos 6 meses
      for(let i = 5; i >= 0; i--) {
        const d = subMonths(startOfMonth(new Date()), i);
        const mStr = format(d, "yyyy-MM");
        const { data } = await (supabase as any).rpc("get_bi_metrics", {
          p_clinic_id: activeClinicId,
          p_mes: `${mStr}-01`
        });
        results.push({
          mes: format(d, "MMM/yy", { locale: ptBR }),
          mrr: data?.mrr || 0,
          ltv: data?.ltv || 0,
          new_patients: data?.new_patients || 0
        });
      }
      return results;
    },
    enabled: !!activeClinicId
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const MetricCard = ({ title, value, unit, icon: Icon, description, trend, trendValue }: any) => (
    <Card className="overflow-hidden border-none shadow-sm bg-gradient-to-br from-card to-muted/30">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Icon size={20} />
          </div>
          {trend && (
            <Badge variant="outline" className={trend === 'up' ? "text-green-600 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}>
              {trend === 'up' ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownRight size={12} className="mr-1" />}
              {trendValue}%
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-2xl font-bold tracking-tight">
              {unit === 'R$' ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : value}
              {unit === '%' && <span className="text-lg ml-0.5">{unit}</span>}
            </h3>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans] flex items-center gap-2">
            <Activity className="text-primary" />
            Inteligência de Negócio (BI)
          </h1>
          <p className="text-sm text-muted-foreground">Métricas avançadas para escalabilidade e retenção</p>
        </div>
        <div className="flex items-center gap-2 bg-card border px-3 py-1.5 rounded-lg shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Referência:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] border-none focus:ring-0 shadow-none h-8 text-sm font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5, 6].map(i => {
                const d = subMonths(new Date(), i);
                return (
                  <SelectItem key={i} value={format(d, "yyyy-MM")}>
                    {format(d, "MMMM 'de' yyyy", { locale: ptBR })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="MRR (Receita Recorrente)"
          value={metrics?.mrr || 0}
          unit="R$"
          icon={DollarSign}
          description="Receita esperada para o mês"
        />
        <MetricCard 
          title="LTV (Life Time Value)"
          value={metrics?.ltv || 0}
          unit="R$"
          icon={Target}
          description="Valor total gerado por cada paciente"
        />
        <MetricCard 
          title="Churn Rate (Cancelamento)"
          value={metrics?.churn_rate || 0}
          unit="%"
          icon={TrendingDown}
          description={`${metrics?.churn_count || 0} pacientes cancelaram`}
          trend={metrics?.churn_rate > 5 ? 'down' : 'up'}
          trendValue={metrics?.churn_rate}
        />
        <MetricCard 
          title="Novos Pacientes"
          value={metrics?.new_patients || 0}
          icon={Users}
          description="Cadastrados no período"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <MetricCard 
          title="Custos de Marketing"
          value={metrics?.marketing_investment || 0}
          unit="R$"
          icon={BarChart3}
          description="Investimento em aquisição"
        />
        <MetricCard 
          title="CAC (Custo por Paciente)"
          value={metrics?.cac || 0}
          unit="R$"
          icon={Target}
          description="Custo médio para atrair um paciente"
        />
        <MetricCard 
          title="Ticket Médio"
          value={metrics?.ticket_medio || 0}
          unit="R$"
          icon={DollarSign}
          description="Média gasta por paciente/mês"
        />
        <MetricCard 
          title="ROI de Aquisição"
          value={metrics?.cac > 0 ? (metrics?.ltv / metrics?.cac).toFixed(1) : "—"}
          unit="x"
          icon={TrendingUp}
          description="LTV / CAC (Meta: > 3.0)"
        />
      </div>

      {/* Historical Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Tendência de Crescimento (6 meses)</CardTitle>
            <CardDescription>Evolução do MRR e Novos Pacientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-[10px]" axisLine={false} tickLine={false} />
                  <YAxis className="text-[10px]" axisLine={false} tickLine={false} tickFormatter={v => `R$${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMrr)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Strategic Analysis */}
        <Card className="border-none shadow-sm bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="text-amber-500" />
              Insights Estratégicos
            </CardTitle>
            <CardDescription>Baseado nos seus KPIs atuais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-tight">Análise de Saúde</h4>
              {metrics?.churn_rate > 10 ? (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                  ⚠️ **Churn Alto:** Sua taxa de cancelamento está acima de 10%. Recomendamos revisar o NPS e o atendimento pós-sessão.
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-700">
                  ✅ **Retenção Saudável:** Seus pacientes estão permanecendo na clínica por mais tempo que a média.
                </div>
              )}
              
              {metrics?.ltv / metrics?.cac < 3 && metrics?.cac > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                  💡 **CAC Desequilibrado:** Você está gastando muito para adquirir pacientes comparado ao retorno deles. Tente otimizar campanhas.
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                  🚀 **Escalabilidade:** Seu LTV/CAC indica que cada real investido traz excelente retorno. Hora de acelerar o marketing!
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-tight mb-2">Simulação de Impacto</h4>
              <p className="text-[10px] text-muted-foreground mb-3">
                Se você reduzir o Churn em **1%**, seu LTV estimado subiria para 
                **R$ {metrics?.ticket_medio > 0 ? (metrics.ticket_medio / ((metrics.churn_rate - 1 || 0.1) / 100)).toFixed(2) : "—"}**.
              </p>
              <Button variant="outline" size="sm" className="w-full text-xs h-7">Ver Estratégias de Retenção</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
