import { useAuth } from "../hooks/useAuth";
import type { AppRole } from "@/types/entities";

export function usePermission() {
    const { userRole } = useAuth();

    const hasPermission = (allowedRoles: AppRole[]) => {
        if (!userRole) return false;
        return allowedRoles.includes(userRole as AppRole);
    };

    const isAdmin = userRole === "admin";
    const isGestor = userRole === "gestor";
    const isProfissional = userRole === "profissional";
    const isSecretario = userRole === "secretario";

    return {
        hasPermission,
        isAdmin,
        isGestor,
        isProfissional,
        isSecretario,
        userRole
    };
}
