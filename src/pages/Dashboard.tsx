import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Activity, AlertTriangle, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';

const tipoLabels: Record<string, string> = {
  fisioterapia: "Fisioterapia",
  pilates: "Pilates",
  rpg: "RPG",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, clinicId } = useAuth();

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await (supabase.from("pacientes") as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: financeData } = useQuery({
    queryKey: ["dashboard-finance", clinicId, inicioMes],
    queryFn: async () => {
      if (!clinicId) return { receita: 0, custos: 0, repasses: 0, lucro: 0 };

      const { data: pagamentos } = await (supabase.from("pagamentos") as any).select("valor, status").eq("clinic_id", clinicId).gte("data_pagamento", inicioMes).lte("data_pagamento", fimMes);
      const { data: despesas } = await (supabase.from("expenses") as any).select("valor, status").eq("clinic_id", clinicId);
      const { data: comissoes } = await (supabase.from("commissions") as any).select("valor").eq("clinic_id", clinicId);

      const receita = (pagamentos || [])?.filter((p: any) => p.status === 'pago').reduce((acc, p) => acc + Number(p.valor), 0) || 0;
      const custos = (despesas || [])?.filter((d: any) => d.status === 'pago').reduce((acc, d) => acc + Number(d.valor), 0) || 0;
      const repasses = (comissoes || [])?.reduce((acc, c) => acc + Number(c.valor), 0) || 0;

      return { receita, custos, repasses, lucro: receita - custos - repasses };
    },
    enabled: !!clinicId,
  });

  const { data: alertCount = 0 } = useQuery({
    queryKey: ["dashboard-alerts", clinicId],
    queryFn: async () => {
      if (!clinicId) return 0;
      // Count overdue pending payments
      const { count } = await (supabase.from("pagamentos") as any)
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "pendente")
        .lte("data_vencimento", new Date().toISOString().split("T")[0]);
      return count ?? 0;
    },
    enabled: !!clinicId,
  });

  const ativos = (pacientes || []).filter((p) => p.status === "ativo");
  const recentes = (pacientes || []).slice(0, 5);

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
      title: "Receita (Total)",
      value: `R$ ${(financeData?.receita || 0).toFixed(2)}`,
      icon: Activity,
      description: "Pagamentos recebidos",
      color: "text-blue-600 bg-blue-50",
    },
    {
      title: "Lucro Líquido",
      value: `R$ ${(financeData?.lucro || 0).toFixed(2)}`,
      icon: Activity,
      description: "Após despesas e comissões",
      color: "text-violet-600 bg-violet-50",
    },
    {
      title: "Alertas",
      value: String(alertCount),
      icon: AlertTriangle,
      description: alertCount === 0 ? "Nenhum atraso" : `${alertCount} pagamento(s) em atraso`,
      color: alertCount > 0 ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50",
    },
  ];

  const chartData = [
    { name: 'Receita', valor: financeData?.receita || 0, color: '#10b981' },
    { name: 'Despesas', valor: financeData?.custos || 0, color: '#ef4444' },
    { name: 'Comissões', valor: financeData?.repasses || 0, color: '#f59e0b' },
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
          <CardHeader>
            <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
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
                        {(p.nome || "?").charAt(0).toUpperCase()}
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
