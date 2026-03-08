import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { format, startOfWeek, addDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity } from "lucide-react";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 6);
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function OccupancyReport() {
  const [filterProfId, setFilterProfId] = useState("all");

  const { data: profissionais = [] } = useQuery({
    queryKey: ["occ-profs"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const ids = (roles || []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids).order("nome");
      return data || [];
    },
  });

  const { data: disponibilidades = [] } = useQuery({
    queryKey: ["occ-disp", filterProfId],
    queryFn: async () => {
      let query = supabase.from("disponibilidade_profissional").select("*").eq("ativo", true);
      if (filterProfId !== "all") query = query.eq("profissional_id", filterProfId);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["occ-ags", filterProfId],
    queryFn: async () => {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = addDays(start, 6);
      let query = (supabase.from("agendamentos") as any)
        .select("data_horario, profissional_id, status")
        .gte("data_horario", start.toISOString())
        .lte("data_horario", end.toISOString())
        .neq("status", "cancelado");
      if (filterProfId !== "all") query = query.eq("profissional_id", filterProfId);
      const { data } = await query;
      return data || [];
    },
  });

  // Build occupancy grid: day x hour
  const grid = useMemo(() => {
    const result: Record<string, { occupied: number; capacity: number }> = {};

    // Build capacity from disponibilidade
    (disponibilidades as any[]).forEach((d: any) => {
      const [sh, sm] = d.hora_inicio.split(":").map(Number);
      const [eh] = d.hora_fim.split(":").map(Number);
      for (let h = sh; h < eh; h++) {
        const key = `${d.dia_semana}-${h}`;
        if (!result[key]) result[key] = { occupied: 0, capacity: 0 };
        result[key].capacity += d.max_pacientes;
      }
    });

    // Count occupied slots
    (agendamentos as any[]).forEach((a: any) => {
      const dt = new Date(a.data_horario);
      const dayOfWeek = getDay(dt);
      const h = dt.getHours();
      const key = `${dayOfWeek}-${h}`;
      if (!result[key]) result[key] = { occupied: 0, capacity: 1 };
      result[key].occupied++;
    });

    return result;
  }, [disponibilidades, agendamentos]);

  // Calculate summary by professional
  const profSummary = useMemo(() => {
    const profMap: Record<string, { nome: string; total: number; occupied: number }> = {};

    (profissionais as any[]).forEach((p: any) => {
      profMap[p.user_id] = { nome: p.nome, total: 0, occupied: 0 };
    });

    (disponibilidades as any[]).forEach((d: any) => {
      if (!profMap[d.profissional_id]) return;
      const [sh] = d.hora_inicio.split(":").map(Number);
      const [eh] = d.hora_fim.split(":").map(Number);
      profMap[d.profissional_id].total += (eh - sh) * d.max_pacientes;
    });

    (agendamentos as any[]).forEach((a: any) => {
      if (profMap[a.profissional_id]) {
        profMap[a.profissional_id].occupied++;
      }
    });

    return Object.entries(profMap)
      .map(([id, v]) => ({
        id,
        nome: v.nome,
        taxa: v.total > 0 ? Math.round((v.occupied / v.total) * 100) : 0,
        ocupado: v.occupied,
        total: v.total,
      }))
      .sort((a, b) => b.taxa - a.taxa);
  }, [profissionais, disponibilidades, agendamentos]);

  const getOccColor = (occupied: number, capacity: number) => {
    if (capacity === 0) return "bg-muted";
    const rate = occupied / capacity;
    if (rate >= 1) return "bg-destructive/80 text-destructive-foreground";
    if (rate >= 0.7) return "bg-warning/60 text-warning-foreground";
    if (rate > 0) return "bg-primary/30 text-primary-foreground";
    return "bg-muted/30";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Relatório de Ocupação
              </CardTitle>
              <CardDescription>Taxa de ocupação por profissional e horário na semana atual.</CardDescription>
            </div>
            <Select value={filterProfId} onValueChange={setFilterProfId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(profissionais as any[]).map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-8 gap-1 text-xs">
                <div className="font-medium text-muted-foreground p-1" />
                {[1, 2, 3, 4, 5, 6, 0].map(d => (
                  <div key={d} className="font-medium text-center p-1 text-muted-foreground">{DAYS[d]}</div>
                ))}
                {HOURS.map(h => (
                  <>
                    <div key={`h-${h}`} className="text-right pr-2 text-muted-foreground py-1 font-mono">
                      {String(h).padStart(2, "0")}:00
                    </div>
                    {[1, 2, 3, 4, 5, 6, 0].map(d => {
                      const cell = grid[`${d}-${h}`];
                      const occ = cell?.occupied || 0;
                      const cap = cell?.capacity || 0;
                      return (
                        <div
                          key={`${d}-${h}`}
                          className={`rounded text-center py-1 text-[10px] font-medium transition-colors ${getOccColor(occ, cap)}`}
                          title={`${DAYS[d]} ${h}h: ${occ}/${cap}`}
                        >
                          {cap > 0 ? `${occ}/${cap}` : "–"}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-muted/30" /> Vazio</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-primary/30" /> Parcial</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-warning/60" /> Quase lotado</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-destructive/80" /> Lotado</div>
          </div>
        </CardContent>
      </Card>

      {/* Summary by Professional */}
      {profSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ocupação por Profissional</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, profSummary.length * 40)}>
              <BarChart data={profSummary} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 12 }} width={90} />
                <Tooltip formatter={(v: any) => [`${v}%`, "Ocupação"]} />
                <Bar dataKey="taxa" radius={[0, 4, 4, 0]}>
                  {profSummary.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.taxa >= 80 ? "hsl(0 72% 51%)" : entry.taxa >= 50 ? "hsl(38 92% 50%)" : "hsl(168 65% 38%)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
