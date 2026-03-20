import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { AppRole } from "../services/authService";

interface RequireRoleProps {
    /** One or more roles that are allowed to access this route. */
    roles: AppRole[];
    children: ReactNode;
    /** Where to redirect when access is denied. Defaults to "/dashboard". */
    redirectTo?: string;
}

/**
 * Route-level RBAC guard.
 *
 * Renders `children` only when the authenticated user has at least one of
 * the required `roles`. Redirects to `redirectTo` otherwise.
 *
 * Usage:
 *   <RequireRole roles={["admin", "master"]}>
 *     <MasterPanel />
 *   </RequireRole>
 */
export function RequireRole({ roles, children, redirectTo = "/dashboard" }: RequireRoleProps) {
    const { roles: userRoles, loading } = useAuth();

    // While auth is still resolving, render nothing to avoid a flash redirect.
    if (loading) return null;

    const hasRequiredRole = roles.some((r) => userRoles.includes(r));

    if (!hasRequiredRole) {
        return <Navigate to={redirectTo} replace />;
    }

    return <>{children}</>;
}
