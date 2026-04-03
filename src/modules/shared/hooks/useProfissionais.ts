import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import type { Tables } from "@/integrations/supabase/types";

export interface PermissionEntry {
  resource: string;
  access_level: "view" | "edit";
}

export interface UserRecord extends Tables<"profiles"> {
  role: string;
  permissions: PermissionEntry[];
}

export const useProfissionais = () => {
    const { activeClinicId } = useClinic();
    const queryClient = useQueryClient();

    const { data: profissionais = [], isLoading } = useQuery({
        queryKey: ["staff-users", activeClinicId],
        queryFn: async () => {
            const { data: roleData } = await supabase
                .from("user_roles")
                .select("user_id, role");

            const staffRoles = roleData?.filter(r => r.role !== "paciente") ?? [];
            let userIds = staffRoles.map(r => r.user_id);
            if (userIds.length === 0) return [];

            // Filtrar pela clínica ativa
            if (activeClinicId) {
                const { data: clinicUsers } = await supabase.from("clinic_users")
                    .select("user_id")
                    .eq("clinic_id", activeClinicId);
                const clinicUserIds = new Set(clinicUsers?.map((cu) => cu.user_id) ?? []);
                userIds = userIds.filter(id => clinicUserIds.has(id));
                if (userIds.length === 0) return [];
            }

            const { data: profiles } = await supabase
                .from("profiles")
                .select("*")
                .in("user_id", userIds)
                .order("nome");

            const { data: permsData } = await supabase
                .from("user_permissions")
                .select("user_id, resource, access_level")
                .in("user_id", userIds)
                .eq("enabled", true);

            return (profiles ?? []).map(p => ({
                ...p,
                role: staffRoles.find(r => r.user_id === p.user_id)?.role || "profissional",
                permissions: (permsData ?? [])
                    .filter((perm) => perm.user_id === p.user_id)
                    .map((perm) => ({
                        resource: perm.resource,
                        access_level: (perm.access_level || "edit") as "view" | "edit",
                    })),
            })) as UserRecord[];
        },
    });

    return {
        profissionais,
        isLoading
    };
};
