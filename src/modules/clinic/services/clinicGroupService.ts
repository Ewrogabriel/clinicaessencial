import { supabase } from "@/integrations/supabase/client";
import { handleError } from "../../shared/utils/errorHandler";
import type { ClinicGroup, ClinicGroupMember, ClinicWithGroup } from "@/types/entities";

export const clinicGroupService = {
    /**
     * Fetch all clinic groups visible to the current user.
     */
    async getClinicGroups(): Promise<ClinicGroup[]> {
        try {
            const { data, error } = await supabase
                .from("clinic_groups")
                .select("id, nome, descricao, ativo, created_by, created_at, updated_at")
                .eq("ativo", true)
                .order("nome");

            if (error) throw error;
            return (data || []) as ClinicGroup[];
        } catch (error) {
            handleError(error, "Erro ao buscar grupos de clínicas.");
            return [];
        }
    },

    /**
     * Fetch the clinic group that contains a given clinic, if any.
     */
    async getClinicGroupByClinicId(clinicId: string): Promise<ClinicGroup | null> {
        try {
            const { data, error } = await supabase
                .from("clinicas")
                .select(`
                    clinic_group_id,
                    clinic_groups (
                        id, nome, descricao, ativo, created_by, created_at, updated_at
                    )
                `)
                .eq("id", clinicId)
                .maybeSingle();

            if (error) throw error;
            if (!data || !data.clinic_group_id) return null;

            // clinic_groups is returned as an object when joined via FK
            return (data.clinic_groups as unknown as ClinicGroup) ?? null;
        } catch (error) {
            handleError(error, "Erro ao buscar grupo da clínica.");
            return null;
        }
    },

    /**
     * Fetch all clinics that belong to a given clinic group.
     */
    async getClinicsInGroup(clinicGroupId: string): Promise<ClinicWithGroup[]> {
        try {
            const { data, error } = await supabase
                .from("clinicas")
                .select("id, nome, cnpj, logo_url, cidade, estado, ativo, clinic_group_id")
                .eq("clinic_group_id", clinicGroupId)
                .eq("ativo", true)
                .order("nome");

            if (error) throw error;
            return (data || []) as ClinicWithGroup[];
        } catch (error) {
            handleError(error, "Erro ao buscar clínicas do grupo.");
            return [];
        }
    },

    /**
     * Fetch the clinic_group_members entries for a given group,
     * including which clinics have cross-booking enabled.
     */
    async getGroupMembers(clinicGroupId: string): Promise<ClinicGroupMember[]> {
        try {
            const { data, error } = await supabase
                .from("clinic_group_members")
                .select("id, group_id, clinic_id, cross_booking_enabled, created_at")
                .eq("group_id", clinicGroupId)
                .order("created_at");

            if (error) throw error;
            return (data || []) as ClinicGroupMember[];
        } catch (error) {
            handleError(error, "Erro ao buscar membros do grupo.");
            return [];
        }
    },

    /**
     * Returns true when the specified clinic has cross-booking enabled
     * within its clinic group.
     */
    async isCrossBookingEnabled(clinicId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from("clinic_group_members")
                .select("cross_booking_enabled")
                .eq("clinic_id", clinicId)
                .maybeSingle();

            if (error) throw error;
            return data?.cross_booking_enabled ?? false;
        } catch (error) {
            handleError(error, "Erro ao verificar permissão de agendamento cruzado.");
            return false;
        }
    },
};
