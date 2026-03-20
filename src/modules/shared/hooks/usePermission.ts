import { useAuth } from "@/modules/auth/hooks/useAuth";
import type { AppRole } from "@/types/entities";

export function usePermission() {
    const { roles, isAdmin, isGestor, isProfissional, isSecretario } = useAuth();

    const hasPermission = (allowedRoles: AppRole[]) => {
        if (!roles || roles.length === 0) return false;
        return roles.some(r => allowedRoles.includes(r as AppRole));
    };

    return {
        hasPermission,
        isAdmin,
        isGestor,
        isProfissional,
        isSecretario,
        userRole: roles?.[0] || null
    };
}
