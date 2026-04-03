import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Target, 
  BarChart3, Lightbulb,
  ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface BiMetrics {
  mrr: number;
  ltv: number;
  churn_rate: number;
  churn_count: number;
  new_patients: number;
  marketing_investment: number;
  cac: number;
  ticket_medio: number;
}

async function computeBiMetrics(clinicId: string, mesStr: string): Promise<BiMetrics> {
  const mesDate = new Date(parseInt(mesStr.split("-")[0]), parseInt(mesStr.split("-")[1]) - 1, 1);
  const mesStart = format(startOfMonth(mesDate), "yyyy-MM-dd");
  const mesEnd = format(endOfMonth(mesDate), "yyyy-MM-dd");
  const prevStart = format(startOfMonth(subMonths(mesDate, 1)), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(subMonths(mesDate, 1)), "yyyy-MM-dd");

  // Fetch all data in parallel
  const [pagRes, pmRes, psRes, expRes, newPacRes, prevPacRes] = await Promise.all([
    (supabase as any).from("pagamentos")
      .select("id,valor,data_pagamento,status")
      .eq("clinic_id", clinicId)
      .gte("data_pagamento", mesStart)
      .lte("data_pagamento", mesEnd)
      .in("status", ["pago"]),
    (supabase as any).from("pagamentos_mensalidade")
      .select("id,valor,data_pagamento,status,paciente_id")
      .eq("clinic_id", clinicId)
      .gte("mes_referencia", mesStart)
      .lte("mes_referencia", mesEnd + "T23:59:59"),
    (supabase as any).from("pagamentos_sessoes")
      .select("id,valor,data_pagamento,status,paciente_id")
      .eq("clinic_id", clinicId)
      .gte("data_pagamento", mesStart + "T00:00:00")
      .lte("data_pagamento", mesEnd + "T23:59:59")
      .in("status", ["pago"]),
    (supabase as any).from("expenses")
      .select("id,valor,categoria")
      .eq("clinic_id", clinicId)
      .gte("data_vencimento", mesStart)
      .lte("data_vencimento", mesEnd),
    // New patients this month
    (supabase as any).from("clinic_pacientes")
      .select("id,paciente_id,created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", mesStart)
      .lte("created_at", mesEnd + "T23:59:59"),
    // Patients from previous month (for churn)
    (supabase as any).from("agendamentos")
      .select("paciente_id")
      .eq("clinic_id", clinicId)
      .gte("data_horario", prevStart)
      .lte("data_horario", prevEnd + "T23:59:59")
      .in("status", ["realizado", "agendado", "confirmado"]),
  ]);

  const pagos = pagRes.data || [];
  const mensalidades = pmRes.data || [];
  const sessoesPagas = psRes.data || [];
  const expenses = expRes.data || [];
  const newPatients = newPacRes.data || [];
  const prevPatients = prevPacRes.data || [];

  // MRR: sum of paid mensalidades + paid pagamentos + paid sessoes
  const receitaPagamentos = pagos.reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);
  const receitaMensalidades = mensalidades
    .filter((m: any) => m.status === "pago")
    .reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);
  const receitaSessoes = sessoesPagas.reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);
  const mrr = receitaPagamentos + receitaMensalidades + receitaSessoes;

  // Unique paying patients
  const payingPatients = new Set<string>();
  pagos.forEach((p: any) => p.paciente_id && payingPatients.add(p.paciente_id));
  mensalidades.filter((m: any) => m.status === "pago").forEach((p: any) => p.paciente_id && payingPatients.add(p.paciente_id));
  sessoesPagas.forEach((p: any) => p.paciente_id && payingPatients.add(p.paciente_id));

  const ticketMedio = payingPatients.size > 0 ? mrr / payingPatients.size : 0;

  // Churn: patients from prev month who have no activity this month
  const prevPatientIds = new Set(prevPatients.map((p: any) => p.paciente_id));
  // Get current month active patients
  const { data: curPatients } = await (supabase as any).from("agendamentos")
    .select("paciente_id")
    .eq("clinic_id", clinicId)
    .gte("data_horario", mesStart)
    .lte("data_horario", mesEnd + "T23:59:59")
    .in("status", ["realizado", "agendado", "confirmado"]);
  
  const curPatientIds = new Set((curPatients || []).map((p: any) => p.paciente_id));
  let churnCount = 0;
  prevPatientIds.forEach(id => { if (!curPatientIds.has(id)) churnCount++; });
  const churnRate = prevPatientIds.size > 0 ? (churnCount / prevPatientIds.size) * 100 : 0;

  // LTV = ticket_medio / (churn_rate/100), capped
  const ltv = churnRate > 0 ? ticketMedio / (churnRate / 100) : ticketMedio * 12;

  // Marketing costs
  const marketingInvestment = expenses
    .filter((e: any) => (e.categoria || "").toLowerCase().includes("marketing"))
    .reduce((s: number, e: any) => s + (Number(e.valor) || 0), 0);

  const cac = newPatients.length > 0 ? marketingInvestment / newPatients.length : 0;

  return {
    mrr: Math.round(mrr * 100) / 100,
    ltv: Math.round(ltv * 100) / 100,
    churn_rate: Math.round(churnRate * 10) / 10,
    churn_count: churnCount,
    new_patients: newPatients.length,
    marketing_investment: Math.round(marketingInvestment * 100) / 100,
    cac: Math.round(cac * 100) / 100,
    ticket_medio: Math.round(ticketMedio * 100) / 100,
  };
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
            {unit === 'R$' ? `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : value}
            {unit === '%' && <span className="text-lg ml-0.5">{unit}</span>}
          </h3>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{description}</p>
      </div>
    </CardContent>
  </Card>
);

export default function InteligenciaBI() {
  const { activeClinicId } = useClinic();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["bi-metrics-local", activeClinicId, selectedMonth],
    queryFn: () => computeBiMetrics(activeClinicId!, selectedMonth),
    enabled: !!activeClinicId
  });

  const { data: history = [] } = useQuery({
    queryKey: ["bi-history-local", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const results = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(startOfMonth(new Date()), i);
        const mStr = format(d, "yyyy-MM");
        const m = await computeBiMetrics(activeClinicId, mStr);
        results.push({
          mes: format(d, "MMM/yy", { locale: ptBR }),
          mrr: m.mrr,
          ltv: m.ltv,
          new_patients: m.new_patients
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="MRR (Receita Recorrente)" value={metrics?.mrr || 0} unit="R$" icon={DollarSign} description="Receita do mês" />
        <MetricCard title="LTV (Life Time Value)" value={metrics?.ltv || 0} unit="R$" icon={Target} description="Valor total gerado por paciente" />
        <MetricCard 
          title="Churn Rate" value={metrics?.churn_rate || 0} unit="%" icon={TrendingDown}
          description={`${metrics?.churn_count || 0} pacientes não retornaram`}
          trend={(metrics?.churn_rate || 0) > 5 ? 'down' : 'up'} trendValue={metrics?.churn_rate || 0}
        />
        <MetricCard title="Novos Pacientes" value={metrics?.new_patients || 0} icon={Users} description="Cadastrados no período" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Custos de Marketing" value={metrics?.marketing_investment || 0} unit="R$" icon={BarChart3} description="Investimento em aquisição" />
        <MetricCard title="CAC (Custo por Paciente)" value={metrics?.cac || 0} unit="R$" icon={Target} description="Custo médio para atrair um paciente" />
        <MetricCard title="Ticket Médio" value={metrics?.ticket_medio || 0} unit="R$" icon={DollarSign} description="Média gasta por paciente/mês" />
        <MetricCard 
          title="ROI de Aquisição"
          value={(metrics?.cac || 0) > 0 ? ((metrics?.ltv || 0) / metrics!.cac).toFixed(1) : "—"}
          unit="x" icon={TrendingUp} description="LTV / CAC (Meta: > 3.0)"
        />
      </div>

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
                  <YAxis className="text-[10px]" axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMrr)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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
              {(metrics?.churn_rate || 0) > 10 ? (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                  ⚠️ <strong>Churn Alto:</strong> Sua taxa de cancelamento está acima de 10%. Revise o atendimento pós-sessão.
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-700">
                  ✅ <strong>Retenção Saudável:</strong> Seus pacientes estão permanecendo na clínica.
                </div>
              )}
              
              {(metrics?.cac || 0) > 0 && (metrics?.ltv || 0) / metrics!.cac < 3 ? (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                  💡 <strong>CAC Desequilibrado:</strong> Você gasta muito para adquirir pacientes. Otimize campanhas.
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                  🚀 <strong>Escalabilidade:</strong> Seu LTV/CAC indica bom retorno. Hora de acelerar!
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-tight mb-2">Simulação de Impacto</h4>
              <p className="text-[10px] text-muted-foreground mb-3">
                Se você reduzir o Churn em <strong>1%</strong>, seu LTV estimado subiria para{" "}
                <strong>R$ {(metrics?.ticket_medio || 0) > 0 && (metrics?.churn_rate || 0) > 1
                  ? (metrics!.ticket_medio / ((metrics!.churn_rate - 1) / 100)).toFixed(2)
                  : "—"}</strong>.
              </p>
              <Button variant="outline" size="sm" className="w-full text-xs h-7">Ver Estratégias de Retenção</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
