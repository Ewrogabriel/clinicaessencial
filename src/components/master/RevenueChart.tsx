import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface RevenueDataPoint {
  month: string;
  revenue: number;
  clinics: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Sem dados de receita para o período selecionado.
      </div>
    );
  }

  const formatted = data.map((d) => ({ ...d, monthLabel: formatMonth(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
        <YAxis
          yAxisId="revenue"
          tickFormatter={(v: number) => {
            if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
            if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
            return `R$${v}`;
          }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          yAxisId="clinics"
          orientation="right"
          tick={{ fontSize: 12 }}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === "Receita") return [formatCurrency(value), name];
            return [value, name];
          }}
        />
        <Legend />
        <Bar
          yAxisId="revenue"
          dataKey="revenue"
          name="Receita"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
          opacity={0.85}
        />
        <Line
          yAxisId="clinics"
          type="monotone"
          dataKey="clinics"
          name="Clínicas"
          stroke="hsl(var(--chart-2, 160 60% 45%))"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
