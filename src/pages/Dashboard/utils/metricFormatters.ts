export function formatMetricValue(value: number, type: "currency" | "percentage" | "count" = "count"): string {
  if (type === "currency") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(value);
  }
  if (type === "percentage") {
    return `${value.toFixed(1)}%`;
  }
  return value.toString();
}

export function formatTrend(current: number, previous: number): { value: number; direction: "up" | "down" } | undefined {
  if (previous === 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(change)),
    direction: change >= 0 ? "up" : "down",
  };
}
