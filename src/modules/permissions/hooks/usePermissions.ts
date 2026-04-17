import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { permissionService } from "../services/permissionService";
import type { Permission } from "../types";

/**
 * Hook principal de permissões — carrega o conjunto de permissões efetivas
 * do usuário logado (RBAC + overrides).
 */
export function usePermissions() {
  const { user, isAdmin, isMaster } = useAuth();
  const userId = user?.id;

  const { data: allPerms = [] } = useQuery({
    queryKey: ["permissions:catalog"],
    queryFn: () => permissionService.listPermissions(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["permissions:roles"],
    queryFn: () => permissionService.listRolePermissions(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["permissions:overrides", userId],
    queryFn: () => permissionService.listUserOverrides(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const { data: schedulePerm } = useQuery({
    queryKey: ["permissions:schedule", userId],
    queryFn: () => permissionService.getSchedulePermission(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const { roles } = useAuth();

  const can = (module: string, action: string, scope: "own"|"others"|"global" = "global"): boolean => {
    if (isAdmin || isMaster) return true;
    const perm = allPerms.find(
      (p: Permission) => p.module === module && p.action === action && p.scope_type === scope
    );
    if (!perm) return false;

    const override = overrides.find((o) => o.permission_id === perm.id);
    if (override) {
      if (override.valid_until && new Date(override.valid_until) < new Date()) {
        // expired
      } else {
        return override.allowed;
      }
    }

    return rolePerms.some((rp) => (roles as string[]).includes(rp.role) && rp.permission_id === perm.id);
  };

  const canScheduleFor = (targetProfessionalId: string): boolean => {
    if (isAdmin || isMaster) return true;
    if (userId === targetProfessionalId) return true;
    if (!schedulePerm) return false;
    if (schedulePerm.scope === "all") return true;
    if (schedulePerm.scope === "others") {
      if (!schedulePerm.allowed_professionals || schedulePerm.allowed_professionals.length === 0) return true;
      return schedulePerm.allowed_professionals.includes(targetProfessionalId);
    }
    return false;
  };

  return { can, canScheduleFor, schedulePerm, allPerms, rolePerms, overrides };
}
