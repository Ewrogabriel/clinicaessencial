import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Given a clinic_id, returns all clinic IDs that are in the same group
 * with cross_booking_enabled = true
 */
export function useCrossBookingClinics(clinicId: string | null) {
  return useQuery({
    queryKey: ["cross-booking-clinics", clinicId],
    queryFn: async () => {
      if (!clinicId) return [clinicId].filter(Boolean) as string[];

      // Find all groups this clinic belongs to
      const { data: myGroups } = await supabase.from("clinic_group_members")
        .select("group_id")
        .eq("clinic_id", clinicId)
        .eq("cross_booking_enabled", true);

      if (!myGroups?.length) return [clinicId];

      const groupIds = myGroups.map((g) => g.group_id);

      // Find all clinics in those groups with cross booking enabled
      const { data: linkedMembers } = await supabase.from("clinic_group_members")
        .select("clinic_id")
        .in("group_id", groupIds)
        .eq("cross_booking_enabled", true);

      const clinicIds = [...new Set((linkedMembers || []).map((m) => m.clinic_id))];
      return clinicIds.length > 0 ? clinicIds : [clinicId];
    },
    enabled: !!clinicId,
  });
}
