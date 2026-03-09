import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target, Trophy, TrendingUp, Users, CalendarCheck, XCircle, Star,
  Medal, Award, Flame,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { MetasClinicaForm } from "@/components/metas/MetasClinicaForm";

const MetasGamificacao = () => {
  const { user, isAdmin, isGestor } = useAuth();
  const [mesSelecionado, setMesSelecionado] = useState(format(new Date(), "yyyy-MM"));

  const mesDate = new Date(mesSelecionado + "-01");
  const mesInicio = format(startOfMonth(mesDate), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(mesDate), "yyyy-MM-dd");

  // Fetch all professionals
  const { data: profissionais = [] } = useQuery({
    queryKey: ["metas-profissionais"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome");
      // Filter to only those with profissional role
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const profIds = new Set((roles || []).map(r => r.user_id));
      return (data || []).filter((p: any) => profIds.has(p.user_id));
    },
  });

  // Fetch monthly stats for all professionals
  const { data: stats = [] } = useQuery({
    queryKey: ["metas-stats", mesInicio, mesFim],
    queryFn: async () => {
      const { data: agendamentos } = await (supabase.from("agendamentos") as any)
        .select("profissional_id, status")
        .gte("data_horario", `${mesInicio}T00:00:00`)
        .lte("data_horario", `${mesFim}T23:59:59`);

      const profStats: Record<string, { total: number; realizados: number; faltas: number; cancelados: number }> = {};
      (agendamentos || []).forEach((a: any) => {
        if (!profStats[a.profissional_id]) {
          profStats[a.profissional_id] = { total: 0, realizados: 0, faltas: 0, cancelados: 0 };
        }
        profStats[a.profissional_id].total++;
        if (a.status === "realizado") profStats[a.profissional_id].realizados++;
        if (a.status === "falta") profStats[a.profissional_id].faltas++;
        if (a.status === "cancelado") profStats[a.profissional_id].cancelados++;
      });
      return profStats;
    },
    enabled: profissionais.length > 0,
  });

  // Fetch commissions
  const { data: commissions = {} as Record<string, number> } = useQuery({
    queryKey: ["metas-commissions", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await (supabase.from("commissions") as any)
        .select("professional_id, valor")
        .gte("created_at", `${mesInicio}T00:00:00`)
        .lte("created_at", `${mesFim}T23:59:59`);
      const map: Record<string, number> = {};
      (data || []).forEach((c: any) => {
        map[c.professional_id] = (map[c.professional_id] || 0) + Number(c.valor);
      });
      return map;
    },
  });

  // Default goals
  const GOALS = {
    atendimentos: 80,
    taxaPresenca: 85,
    faturamento: 5000,
  };

  // Build ranking
  const ranking = profissionais
    .map((p: any) => {
      const s = (stats as any)[p.user_id] || { total: 0, realizados: 0, faltas: 0, cancelados: 0 };
      const taxaPresenca = s.total > 0 ? Math.round((s.realizados / s.total) * 100) : 0;
      const faturamento = (commissions as any)[p.user_id] || 0;

      // Score: weighted combination
      const scoreAtend = Math.min(s.realizados / GOALS.atendimentos, 1) * 40;
      const scorePresenca = Math.min(taxaPresenca / GOALS.taxaPresenca, 1) * 35;
      const scoreFat = Math.min(faturamento / GOALS.faturamento, 1) * 25;
      const score = Math.round(scoreAtend + scorePresenca + scoreFat);

      return {
        ...p,
        ...s,
        taxaPresenca,
        faturamento,
        score,
      };
    })
    .sort((a: any, b: any) => b.score - a.score);

  const getRankIcon = (idx: number) => {
    if (idx === 0) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (idx === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (idx === 2) return <Award className="h-5 w-5 text-amber-700" />;
    return <Star className="h-4 w-4 text-muted-foreground" />;
  };

  const getLevelBadge = (score: number) => {
    if (score >= 90) return { label: "🔥 Elite", variant: "default" as const };
    if (score >= 70) return { label: "⭐ Destaque", variant: "default" as const };
    if (score >= 50) return { label: "📈 Em Progresso", variant: "secondary" as const };
    return { label: "🎯 Iniciante", variant: "outline" as const };
  };

  // Chart data
  const chartData = ranking.slice(0, 8).map((p: any) => ({
    nome: p.nome.split(" ")[0],
    realizados: p.realizados,
    faltas: p.faltas,
  }));

  // Month options
  const monthOptions = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthOptions.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy", { locale: ptBR }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Metas & Ranking</h1>
          <p className="text-muted-foreground">KPIs, metas da clínica e ranking de desempenho profissional</p>
        </div>
      </div>

      <Tabs defaultValue="clinica" className="space-y-6">
        <TabsList>
          <TabsTrigger value="clinica">Metas da Clínica</TabsTrigger>
          <TabsTrigger value="ranking">Ranking Profissionais</TabsTrigger>
        </TabsList>

        {/* Metas da Clínica Tab */}
        <TabsContent value="clinica" className="space-y-6">
          {(isAdmin || isGestor) ? (
            <MetasClinicaForm />
          ) : (
            <Card className="p-8 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Apenas administradores podem gerenciar metas da clínica.</p>
            </Card>
          )}
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="space-y-6">
          <div className="flex justify-end">
            <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

      {/* Global KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Profissionais</p>
              <p className="text-lg font-bold">{profissionais.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Realizados</p>
              <p className="text-lg font-bold">{ranking.reduce((s: number, p: any) => s + p.realizados, 0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Faltas</p>
              <p className="text-lg font-bold">{ranking.reduce((s: number, p: any) => s + p.faltas, 0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Flame className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Líder</p>
              <p className="text-lg font-bold truncate">{ranking[0]?.nome?.split(" ")[0] || "—"}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Comparativo de Desempenho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="realizados" fill="hsl(var(--primary))" name="Realizados" radius={[4, 4, 0, 0]} />
                <Bar dataKey="faltas" fill="hsl(var(--destructive))" name="Faltas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking de Profissionais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ranking.map((p: any, idx: number) => {
              const level = getLevelBadge(p.score);
              return (
                <div key={p.user_id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2 shrink-0">
                    {getRankIcon(idx)}
                    <span className="text-lg font-bold text-muted-foreground w-6 text-center">{idx + 1}º</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{p.nome}</p>
                      <Badge variant={level.variant} className="text-xs shrink-0">{level.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span>✅ {p.realizados} atend.</span>
                      <span>❌ {p.faltas} faltas</span>
                      <span>📊 {p.taxaPresenca}% presença</span>
                      <span>💰 R$ {p.faturamento.toFixed(0)}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Score Geral</span>
                        <span className="font-bold">{p.score}%</span>
                      </div>
                      <Progress value={p.score} className="h-2" />
                    </div>
                  </div>
                </div>
              );
            })}
            {ranking.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum profissional encontrado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Goals Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Metas do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">{GOALS.atendimentos}</p>
              <p className="text-xs text-muted-foreground">Atendimentos</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">{GOALS.taxaPresenca}%</p>
              <p className="text-xs text-muted-foreground">Taxa Presença</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">R$ {GOALS.faturamento.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Faturamento</p>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MetasGamificacao;