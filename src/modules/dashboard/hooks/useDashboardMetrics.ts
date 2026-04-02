import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { dashboardService, DashboardMetricsWithTrends } from "../services/dashboardService";

const METRICS_STALE_TIME = 1000 * 60 * 60; // 1 hour
const USER_STALE_TIME = 1000 * 60 * 5;     // 5 minutes

export function useDashboardMetrics() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const hoje = new Date();
  const startDate = format(startOfMonth(hoje), "yyyy-MM-dd");
  const endDate = format(endOfMonth(hoje), "yyyy-MM-dd");
  const prevMonth = subMonths(hoje, 1);
  const prevStartDate = format(startOfMonth(prevMonth), "yyyy-MM-dd");
  const prevEndDate = format(endOfMonth(prevMonth), "yyyy-MM-dd");

  const queryKey = [
    "dashboard-metrics-aggregated",
    activeClinicId,
    startDate,
  ] as const;

  const query = useQuery<DashboardMetricsWithTrends>({
    queryKey,
    queryFn: () =>
      dashboardService.getAggregatedMetrics(
        activeClinicId,
        startDate,
        endDate,
        prevStartDate,
        prevEndDate
      ),
    staleTime: METRICS_STALE_TIME,
    refetchOnWindowFocus: true,
  });

  // Real-time subscription: invalidate cache on data changes
  useEffect(() => {
    const unsubscribe = dashboardService.subscribeToMetricUpdates(
      activeClinicId,
      () => {
        queryClient.invalidateQueries({ queryKey });
      }
    );
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClinicId]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    metrics: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refresh,
    userStaleTime: USER_STALE_TIME,
  };
}
