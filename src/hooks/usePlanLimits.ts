import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";

interface PlanLimit {
  allowed: boolean;
  current: number;
  max: number; // -1 = unlimited
}

export function usePlanLimit(resource: string) {
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["plan-limit", activeClinicId, resource],
    queryFn: async () => {
      if (!activeClinicId) return { allowed: true, current: 0, max: -1 } as PlanLimit;

      const { data, error } = await supabase.rpc("check_plan_limit", {
        _clinic_id: activeClinicId,
        _resource: resource,
      });

      if (error) {
        console.error("Error checking plan limit:", error);
        return { allowed: true, current: 0, max: -1 } as PlanLimit;
      }

      return data as unknown as PlanLimit;
    },
    enabled: !!activeClinicId,
  });
}
