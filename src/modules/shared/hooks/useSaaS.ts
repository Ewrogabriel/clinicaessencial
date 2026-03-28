import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

export interface SaaSStatus {
  clinic_id: string;
  clinic_name: string;
  plan_name: string;
  max_patients: number;
  max_professionals: number;
  has_bi: boolean;
  has_premium_agenda: boolean;
  has_api: boolean;
  subscription_status: 'active' | 'past_due' | 'canceled' | null;
  current_period_end: string | null;
}

export const useSaaS = () => {
  const { activeClinicId } = useClinic();

  const { data: saasStatus, isLoading } = useQuery({
    queryKey: ["saas-status", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return null;
      const { data, error } = await (supabase
        .from("v_saas_status" as any)
        .select("*")
        .eq("clinic_id", activeClinicId)
        .single() as any);
      
      if (error) {
        console.warn("Could not fetch SaaS status, defaulting to Basic", error);
        return {
          plan_name: "Free/Legacy",
          max_patients: 10,
          max_professionals: 1,
          has_bi: false,
          has_premium_agenda: false,
          has_api: false
        } as SaaSStatus;
      }
      return data as SaaSStatus;
    },
    enabled: !!activeClinicId
  });

  const checkFeature = (feature: keyof Pick<SaaSStatus, 'has_bi' | 'has_premium_agenda' | 'has_api'>) => {
    return saasStatus?.[feature] ?? false;
  };

  const isLimitReached = async (type: 'patients' | 'professionals') => {
    if (!activeClinicId || !saasStatus) return false;
    
    if (type === 'patients') {
      const { count } = await supabase
        .from("clinic_pacientes")
        .select("*", { count: 'exact', head: true })
        .eq("clinic_id", activeClinicId);
      return (count ?? 0) >= saasStatus.max_patients;
    }

    if (type === 'professionals') {
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .in("role", ["profissional", "admin"]);
      
      const { count } = await (supabase as any)
        .from("profiles")
        .select("*", { count: 'exact', head: true })
        .in("user_id", (roles || []).map((r: any) => r.user_id))
        .eq("clinic_id", activeClinicId);

      return (count ?? 0) >= saasStatus.max_professionals;
    }

    return false;
  };

  return {
    saasStatus,
    isLoading,
    checkFeature,
    isLimitReached,
    isPro: saasStatus?.plan_name === 'Pro' || saasStatus?.plan_name === 'Enterprise',
    isEnterprise: saasStatus?.plan_name === 'Enterprise'
  };
};
