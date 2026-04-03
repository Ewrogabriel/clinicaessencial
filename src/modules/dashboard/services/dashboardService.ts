import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface DashboardMetrics {
  activePatients: number;
  todayAppointments: number;
  occupancyRate: number;
  monthlyRevenue: number;
  pendingAlerts: number;
  monthlyExpenses: number;
  monthlyCommissions: number;
  netProfit: number;
}

export interface MetricDelta {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  trend: "up" | "down" | "neutral";
}

export interface DashboardMetricsWithTrends extends DashboardMetrics {
  deltas: {
    activePatients: MetricDelta;
    todayAppointments: MetricDelta;
    monthlyRevenue: MetricDelta;
    netProfit: MetricDelta;
  };
}

function calcDelta(current: number, previous: number): MetricDelta {
  const delta = current - previous;
  const deltaPercent = previous !== 0 ? (delta / previous) * 100 : 0;
  const trend: MetricDelta["trend"] =
    delta > 0 ? "up" : delta < 0 ? "down" : "neutral";
  return { current, previous, delta, deltaPercent, trend };
}

export const dashboardService = {
  /**
   * Fetches all dashboard metrics in a single aggregated call,
   * reducing N+1 queries by batching independent fetches in parallel.
   */
  async getAggregatedMetrics(
    clinicId: string | null,
    startDate: string,
    endDate: string,
    prevStartDate: string,
    prevEndDate: string
  ): Promise<DashboardMetricsWithTrends> {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [
        activePatientsRes,
        todayAppointmentsRes,
        currentRevenueRes,
        prevRevenueRes,
        currentExpensesRes,
        currentCommissionsRes,
        overdueAlertsRes,
        allMonthAppointmentsRes,
        prevMonthAppointmentsRes,
      ] = await Promise.all([
        // Active patients count
        (() => {
          let q = (supabase as any).from("pacientes").select("id", { count: "exact", head: true }).eq("status", "ativo");
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),

        // Today's appointments
        (() => {
          let q = (supabase as any)
            .from("agendamentos")
            .select("id", { count: "exact", head: true })
            .eq("data_horario::date", today);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),

        // Current month revenue (pagamentos pago)
        (() => {
          let q = (supabase as any)
            .from("pagamentos")
            .select("valor")
            .eq("status", "pago")
            .gte("data_pagamento", startDate)
            .lte("data_pagamento", endDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),

        // Previous month revenue
        (() => {
          let q = (supabase as any)
            .from("pagamentos")
            .select("valor")
            .eq("status", "pago")
            .gte("data_pagamento", prevStartDate)
            .lte("data_pagamento", prevEndDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),

        // Current month expenses
        (() => {
          let q = (supabase as any)
            .from("expenses")
            .select("valor")
            .eq("status", "pago")
            .gte("created_at", startDate)
            .lte("created_at", endDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),

        // Current month commissions
        (() => {
          let q = (supabase as any)
            .from("commissions")
            .select("valor")
            .gte("created_at", startDate)
            .lte("created_at", endDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),

        // Overdue payment alerts
        (() => {
          let q = (supabase as any)
            .from("pagamentos")
            .select("id", { count: "exact", head: true })
            .eq("status", "pendente")
            .lt("data_vencimento", new Date().toISOString().split("T")[0]);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),

        // Current month appointments (for occupancy)
        (() => {
          let q = (supabase as any)
            .from("agendamentos")
            .select("id", { count: "exact", head: true })
            .gte("data_horario", startDate)
            .lte("data_horario", endDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),

        // Previous month appointments
        (() => {
          let q = (supabase as any)
            .from("agendamentos")
            .select("id", { count: "exact", head: true })
            .gte("data_horario", prevStartDate)
            .lte("data_horario", prevEndDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),
      ]);

      const activePatients = activePatientsRes.count ?? 0;
      const todayAppointments = todayAppointmentsRes.count ?? 0;

      const currentRevenue = (currentRevenueRes.data ?? []).reduce(
        (sum: number, p: any) => sum + Number(p.valor),
        0
      );
      const prevRevenue = (prevRevenueRes.data ?? []).reduce(
        (sum: number, p: any) => sum + Number(p.valor),
        0
      );
      const monthlyExpenses = (currentExpensesRes.data ?? []).reduce(
        (sum: number, e: any) => sum + Number(e.valor),
        0
      );
      const monthlyCommissions = (currentCommissionsRes.data ?? []).reduce(
        (sum: number, c: any) => sum + Number(c.valor),
        0
      );
      const pendingAlerts = overdueAlertsRes.count ?? 0;

      const totalAppointments = allMonthAppointmentsRes.count ?? 0;
      const prevTotalAppointments = prevMonthAppointmentsRes.count ?? 0;

      // Simple occupancy: ratio of current month appointments vs previous month (or 0)
      const occupancyRate =
        prevTotalAppointments > 0
          ? Math.min(100, (totalAppointments / prevTotalAppointments) * 100)
          : totalAppointments > 0
          ? 100
          : 0;

      const netProfit = currentRevenue - monthlyExpenses - monthlyCommissions;
      const prevNetProfit = prevRevenue; // simplified

      return {
        activePatients,
        todayAppointments,
        occupancyRate,
        monthlyRevenue: currentRevenue,
        pendingAlerts,
        monthlyExpenses,
        monthlyCommissions,
        netProfit,
        deltas: {
          activePatients: calcDelta(activePatients, activePatients), // no prev data for patients
          todayAppointments: calcDelta(totalAppointments, prevTotalAppointments),
          monthlyRevenue: calcDelta(currentRevenue, prevRevenue),
          netProfit: calcDelta(netProfit, prevNetProfit),
        },
      };
    } catch (error) {
      handleError(error, "Erro ao buscar métricas do dashboard.");
      return {
        activePatients: 0,
        todayAppointments: 0,
        occupancyRate: 0,
        monthlyRevenue: 0,
        pendingAlerts: 0,
        monthlyExpenses: 0,
        monthlyCommissions: 0,
        netProfit: 0,
        deltas: {
          activePatients: calcDelta(0, 0),
          todayAppointments: calcDelta(0, 0),
          monthlyRevenue: calcDelta(0, 0),
          netProfit: calcDelta(0, 0),
        },
      };
    }
  },

  /**
   * Subscribe to real-time metric updates via Supabase Realtime.
   * Returns an unsubscribe function.
   */
  subscribeToMetricUpdates(
    clinicId: string | null,
    onUpdate: () => void
  ): () => void {
    const channel = supabase
      .channel(`dashboard-metrics-${clinicId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agendamentos",
          filter: clinicId ? `clinic_id=eq.${clinicId}` : undefined,
        },
        onUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pagamentos",
          filter: clinicId ? `clinic_id=eq.${clinicId}` : undefined,
        },
        onUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
