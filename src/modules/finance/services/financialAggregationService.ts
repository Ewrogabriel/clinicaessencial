import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface FinancialKPIs {
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  totalRefunded: number;
  totalExpenses: number;
  totalCommissions: number;
  netProfit: number;
  grossRevenue: number;
}

export interface MonthlyChartPoint {
  mes: string;
  receita: number;
  despesas: number;
  lucro: number;
}

export const financialAggregationService = {
  /**
   * Fetch all financial KPIs for a clinic and date range in a single
   * batched request (reduces N+1 queries).
   */
  async getKPIs(
    clinicId: string | null,
    startDate: string,
    endDate: string
  ): Promise<FinancialKPIs> {
    try {
      const [paymentsRes, expensesRes, commissionsRes] = await Promise.all([
        (() => {
          let q = (supabase as any)
            .from("pagamentos")
            .select("valor, status")
            .gte("data_pagamento", startDate)
            .lte("data_pagamento", endDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),
        (() => {
          let q = (supabase as any)
            .from("expenses")
            .select("valor, status")
            .gte("created_at", startDate)
            .lte("created_at", endDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),
        (() => {
          let q = (supabase as any)
            .from("commissions")
            .select("valor")
            .gte("created_at", startDate)
            .lte("created_at", endDate);
          if (clinicId) q = q.eq("clinic_id", clinicId);
          return q;
        })(),
      ]);

      const payments: Array<{ valor: number; status: string }> =
        paymentsRes.data ?? [];
      const expenses: Array<{ valor: number; status: string }> =
        expensesRes.data ?? [];
      const commissions: Array<{ valor: number }> =
        commissionsRes.data ?? [];

      const totalReceived = payments
        .filter((p) => p.status === "pago")
        .reduce((s, p) => s + Number(p.valor), 0);
      const totalPending = payments
        .filter((p) => p.status === "pendente")
        .reduce((s, p) => s + Number(p.valor), 0);
      const totalOverdue = payments
        .filter((p) => p.status === "vencido")
        .reduce((s, p) => s + Number(p.valor), 0);
      const totalRefunded = payments
        .filter((p) => p.status === "reembolsado")
        .reduce((s, p) => s + Number(p.valor), 0);
      const totalExpenses = expenses.reduce(
        (s, e) => s + Number(e.valor),
        0
      );
      const totalCommissions = commissions.reduce(
        (s, c) => s + Number(c.valor),
        0
      );

      const grossRevenue = totalReceived;
      const netProfit = grossRevenue - totalExpenses - totalCommissions;

      return {
        totalReceived,
        totalPending,
        totalOverdue,
        totalRefunded,
        totalExpenses,
        totalCommissions,
        netProfit,
        grossRevenue,
      };
    } catch (error) {
      handleError(error, "Erro ao calcular KPIs financeiros.");
      return {
        totalReceived: 0,
        totalPending: 0,
        totalOverdue: 0,
        totalRefunded: 0,
        totalExpenses: 0,
        totalCommissions: 0,
        netProfit: 0,
        grossRevenue: 0,
      };
    }
  },

  /**
   * Aggregate monthly revenue, expenses and profit for the last N months.
   */
  async getMonthlyChart(
    clinicId: string | null,
    months = 6
  ): Promise<MonthlyChartPoint[]> {
    try {
      const points: MonthlyChartPoint[] = [];

      const now = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

        const kpis = await financialAggregationService.getKPIs(clinicId, start, endStr);
        points.push({
          mes: label,
          receita: kpis.grossRevenue,
          despesas: kpis.totalExpenses,
          lucro: kpis.netProfit,
        });
      }

      return points;
    } catch (error) {
      handleError(error, "Erro ao gerar gráfico mensal.");
      return [];
    }
  },
};
