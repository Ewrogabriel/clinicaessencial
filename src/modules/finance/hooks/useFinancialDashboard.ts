import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import {
  financialAggregationService,
} from "../services/financialAggregationService";

const CHART_STALE_TIME = 1000 * 60 * 60 * 4; // 4 hours
const KPI_STALE_TIME = 1000 * 60 * 60;        // 1 hour

export function useFinancialDashboard() {
  const { activeClinicId } = useClinic();

  const hoje = new Date();
  const startDate = format(startOfMonth(hoje), "yyyy-MM-dd");
  const endDate = format(endOfMonth(hoje), "yyyy-MM-dd");

  const kpisQuery = useQuery({
    queryKey: ["financial-kpis", activeClinicId, startDate],
    queryFn: () =>
      financialAggregationService.getKPIs(activeClinicId, startDate, endDate),
    staleTime: KPI_STALE_TIME,
  });

  const chartQuery = useQuery({
    queryKey: ["financial-monthly-chart", activeClinicId],
    queryFn: () =>
      financialAggregationService.getMonthlyChart(activeClinicId, 6),
    staleTime: CHART_STALE_TIME,
  });

  return {
    kpis: kpisQuery.data,
    isLoadingKpis: kpisQuery.isLoading,
    monthlyChart: chartQuery.data ?? [],
    isLoadingChart: chartQuery.isLoading,
  };
}
