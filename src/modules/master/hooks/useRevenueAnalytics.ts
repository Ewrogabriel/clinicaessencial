import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RevenueMetrics } from "@/modules/master/services/masterService";

export type Period = "month" | "quarter" | "year";

interface MonthlyRevenue {
  month: string;
  revenue: number;
  clinics: number;
}

interface RevenueAnalytics extends RevenueMetrics {
  monthly: MonthlyRevenue[];
}

function getPeriodStartDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case "quarter":
      return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    case "year":
      return new Date(now.getFullYear() - 1, now.getMonth(), 1);
  }
}

async function fetchRevenueAnalytics(period: Period): Promise<RevenueAnalytics> {
  const since = getPeriodStartDate(period);

  const [subsRes, pagsRes] = await Promise.all([
    (supabase.from("clinic_subscriptions") as any)
      .select("*, platform_plans(valor_mensal, nome)")
      .gte("created_at", since.toISOString()),
    (supabase.from("subscription_payments") as any)
      .select("valor, status, mes_referencia, subscription_id")
      .eq("status", "pago")
      .gte("mes_referencia", since.toISOString().substring(0, 10)),
  ]);

  const subs: any[] = subsRes.data ?? [];
  const pags: any[] = pagsRes.data ?? [];

  const activeSubs = subs.filter((s: any) => s.status === "ativa");
  const mrr = activeSubs.reduce(
    (acc: number, s: any) => acc + Number(s.platform_plans?.valor_mensal ?? 0),
    0,
  );
  const totalRevenue = pags.reduce((acc: number, p: any) => acc + Number(p.valor ?? 0), 0);
  const totalClinics = subs.length;
  const cac = totalClinics > 0 ? totalRevenue / totalClinics : 0;
  const ltv = mrr > 0 ? mrr * 12 : 0;
  const cancelledSubs = subs.filter((s: any) => s.status === "cancelada").length;
  const churnRate = totalClinics > 0 ? (cancelledSubs / totalClinics) * 100 : 0;

  // Monthly grouping
  const monthMap: Record<string, { revenue: number; clinicSet: Set<string> }> = {};
  for (const p of pags) {
    const key = (p.mes_referencia as string).substring(0, 7);
    if (!monthMap[key]) monthMap[key] = { revenue: 0, clinicSet: new Set() };
    monthMap[key].revenue += Number(p.valor ?? 0);
    if (p.subscription_id) monthMap[key].clinicSet.add(p.subscription_id);
  }
  const monthly: MonthlyRevenue[] = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { revenue, clinicSet }]) => ({
      month,
      revenue,
      clinics: clinicSet.size,
    }));

  const prevMrr =
    monthly.length > 1 ? monthly[monthly.length - 2]?.revenue ?? 0 : 0;
  const growth =
    prevMrr > 0 ? ((mrr - prevMrr) / prevMrr) * 100 : 0;

  return {
    mrr,
    cac,
    ltv,
    churnRate,
    growth,
    activeClinics: activeSubs.length,
    totalRevenue,
    monthly,
  };
}

export function useRevenueMetrics(period: Period = "month") {
  return useQuery<RevenueAnalytics>({
    queryKey: ["revenue-analytics", period],
    queryFn: () => fetchRevenueAnalytics(period),
    staleTime: 5 * 60 * 1000,
  });
}
