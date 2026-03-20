import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Star, MessageSquare, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const NPS_COLORS: Record<string, string> = {
  detratores: "hsl(var(--destructive))",
  neutros: "hsl(var(--chart-4))",
  promotores: "hsl(var(--primary))",
};

export const NpsAdminPanel = () => {
  const { activeClinicId } = useClinic();

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["nps-admin", activeClinicId],
    queryFn: async () => {
      let q = (supabase.from("pesquisa_satisfacao") as any)
        .select("*, pacientes(nome)")
        .order("created_at", { ascending: false });
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate NPS metrics
  const totalRespostas = surveys.length;
  const promotores = surveys.filter((s: any) => s.nota >= 9).length;
  const neutros = surveys.filter((s: any) => s.nota >= 7 && s.nota <= 8).length;
  const detratores = surveys.filter((s: any) => s.nota <= 6).length;
  const npsScore = totalRespostas > 0
    ? Math.round(((promotores - detratores) / totalRespostas) * 100)
    : 0;
  const mediaNota = totalRespostas > 0
    ? (surveys.reduce((s: number, r: any) => s + r.nota, 0) / totalRespostas).toFixed(1)
    : "—";

  // Distribution chart
  const distributionData = Array.from({ length: 11 }, (_, i) => ({
    nota: String(i),
    count: surveys.filter((s: any) => s.nota === i).length,
    fill: i <= 6 ? NPS_COLORS.detratores : i <= 8 ? NPS_COLORS.neutros : NPS_COLORS.promotores,
  }));

  const getNpsColor = (score: number) => {
    if (score >= 50) return "text-green-600";
    if (score >= 0) return "text-amber-600";
    return "text-destructive";
  };

  const getNpsLabel = (score: number) => {
    if (score >= 75) return "Excelente";
    if (score >= 50) return "Muito Bom";
    if (score >= 0) return "Razoável";
    return "Crítico";
  };

  if (isLoading) return <div className="animate-pulse p-8 text-center text-muted-foreground">Carregando dados NPS...</div>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /> NPS Score
            </div>
            <p className={`text-3xl font-bold ${getNpsColor(npsScore)}`}>{npsScore}</p>
            <p className="text-xs text-muted-foreground">{getNpsLabel(npsScore)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Star className="h-4 w-4" /> Nota Média
            </div>
            <p className="text-3xl font-bold">{mediaNota}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" /> Respostas
            </div>
            <p className="text-3xl font-bold">{totalRespostas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground mb-2">Distribuição</div>
            <div className="flex gap-3 text-xs">
              <span className="text-green-600 font-medium">👍 {promotores}</span>
              <span className="text-amber-600 font-medium">😐 {neutros}</span>
              <span className="text-destructive font-medium">👎 {detratores}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição de Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="nota" className="text-xs" />
              <YAxis className="text-xs" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Respostas" radius={[4, 4, 0, 0]}>
                {distributionData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Comentários Recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {surveys.filter((s: any) => s.comentario).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">Nenhum comentário recebido ainda.</p>
          ) : (
            surveys
              .filter((s: any) => s.comentario)
              .slice(0, 10)
              .map((s: any) => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge
                    variant={s.nota >= 9 ? "default" : s.nota >= 7 ? "secondary" : "destructive"}
                    className="shrink-0"
                  >
                    {s.nota}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{s.comentario}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.pacientes?.nome || "Paciente"} • {format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
