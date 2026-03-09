import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Grid3X3 } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import type { MonthlyTrend, OccupancyHeatmap } from "@/hooks/useProfessionalAnalytics";

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"];
const DIAS = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Props {
  trends: MonthlyTrend[];
  heatmap: OccupancyHeatmap[];
  statusPie: { name: string; value: number }[];
}

export function PerformanceCharts({ trends, heatmap, statusPie }: Props) {
  const maxHeat = Math.max(...heatmap.map(h => h.count), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Tendência de receita e sessões */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tendência de Receita & Sessões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="mes" fontSize={12} className="fill-muted-foreground" />
                <YAxis yAxisId="left" fontSize={12} className="fill-muted-foreground" />
                <YAxis yAxisId="right" orientation="right" fontSize={12} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                  formatter={(value: number, name: string) =>
                    name === "receita" ? [`R$ ${value.toFixed(2)}`, "Receita"] : [value, "Sessões"]
                  }
                />
                <Area yAxisId="left" type="monotone" dataKey="receita" stroke="hsl(var(--primary))" fill="url(#colorReceita)" name="receita" />
                <Bar yAxisId="right" dataKey="realizadas" fill="#10b981" name="Realizadas" radius={[4, 4, 0, 0]} barSize={20} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Distribuição de status */}
      {statusPie.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição do Mês</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Desempenho mensal (barras) */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Desempenho Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
                <Bar dataKey="realizadas" fill="#10b981" name="Realizadas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="faltas" fill="#ef4444" name="Faltas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="canceladas" fill="#f59e0b" name="Canceladas" radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Heatmap de ocupação */}
      {heatmap.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              Mapa de Ocupação Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `60px repeat(14, 1fr)` }}>
                <div />
                {Array.from({ length: 14 }, (_, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground text-center">{7 + i}h</div>
                ))}
                {[1, 2, 3, 4, 5, 6].map(dia => (
                  <>
                    <div key={`label-${dia}`} className="text-xs text-muted-foreground flex items-center">{DIAS[dia]}</div>
                    {Array.from({ length: 14 }, (_, i) => {
                      const h = 7 + i;
                      const cell = heatmap.find(c => c.dia === dia && c.hora === `${h}:00`);
                      const intensity = cell ? cell.count / maxHeat : 0;
                      return (
                        <div
                          key={`${dia}-${h}`}
                          className="aspect-square rounded-sm min-w-[18px]"
                          style={{
                            backgroundColor: intensity > 0
                              ? `hsl(var(--primary) / ${Math.max(0.1, intensity)})`
                              : "hsl(var(--muted))",
                          }}
                          title={`${DIAS[dia]} ${h}h: ${cell?.count || 0} sessões`}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 justify-end">
                <span className="text-[10px] text-muted-foreground">Menos</span>
                {[0.1, 0.3, 0.5, 0.7, 1].map(v => (
                  <div key={v} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(var(--primary) / ${v})` }} />
                ))}
                <span className="text-[10px] text-muted-foreground">Mais</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
