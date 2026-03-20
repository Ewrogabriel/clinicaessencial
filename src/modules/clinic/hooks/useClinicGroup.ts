import { useQuery } from "@tanstack/react-query";
import { clinicGroupService } from "../services/clinicGroupService";
import { useClinic } from "./useClinic";

/**
 * Returns the clinic group that the currently active clinic belongs to,
 * along with all sibling clinics in that group.
 *
 * When the active clinic is not part of any group, `clinicGroup` is null
 * and `clinicsInGroup` contains only the active clinic itself.
 */
export function useClinicGroup() {
    const { activeClinicId, activeClinic } = useClinic();

    const { data: clinicGroup = null, isLoading: isLoadingGroup } = useQuery({
        queryKey: ["clinic-group-by-clinic", activeClinicId],
        queryFn: () => clinicGroupService.getClinicGroupByClinicId(activeClinicId!),
        enabled: !!activeClinicId,
        staleTime: 5 * 60 * 1000, // 5 min
    });

    const { data: clinicsInGroup = [], isLoading: isLoadingClinics } = useQuery({
        queryKey: ["clinics-in-group", clinicGroup?.id],
        queryFn: () => clinicGroupService.getClinicsInGroup(clinicGroup!.id),
        enabled: !!clinicGroup?.id,
        staleTime: 5 * 60 * 1000,
    });

    const { data: crossBookingEnabled = false } = useQuery({
        queryKey: ["cross-booking", activeClinicId],
        queryFn: () => clinicGroupService.isCrossBookingEnabled(activeClinicId!),
        enabled: !!activeClinicId && !!clinicGroup,
        staleTime: 5 * 60 * 1000,
    });

    // When there is no clinic group, the only "unit" is the active clinic itself
    const availableUnits =
        clinicsInGroup.length > 0
            ? clinicsInGroup
            : activeClinic
            ? [
                  {
                      id: activeClinic.id,
                      nome: activeClinic.nome,
                      cnpj: activeClinic.cnpj,
                      logo_url: activeClinic.logo_url,
                      cidade: activeClinic.cidade,
                      estado: activeClinic.estado,
                      ativo: activeClinic.ativo,
                      clinic_group_id: null,
                  },
              ]
            : [];

    return {
        /** The clinic group the active clinic belongs to (null if standalone). */
        clinicGroup,
        /** All clinic units within the same clinic group. */
        clinicsInGroup,
        /** Clinics available for booking: group siblings or just active clinic. */
        availableUnits,
        /** Whether patients can book across all units in this group. */
        crossBookingEnabled,
        isLoading: isLoadingGroup || isLoadingClinics,
    };
}
