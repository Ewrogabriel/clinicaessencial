import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { permissionsService } from "../services/permissionsService";
import {
  UserPermissions,
  Resource,
  PermissionAction,
  hasPermission as checkPermission,
} from "@/modules/finance/utils/permissionSchemas";

export function usePermissionValidation(targetUserId?: string) {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const userId = targetUserId ?? user?.id ?? "";
  const role = roles?.[0] as string | undefined;

  const permissionsQuery = useQuery<UserPermissions>({
    queryKey: ["user-permissions", userId],
    queryFn: () => permissionsService.getUserPermissions(userId, role),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const saveMutation = useMutation({
    mutationFn: (permissions: UserPermissions) =>
      permissionsService.saveUserPermissions(
        userId,
        permissions,
        user?.id ?? ""
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", userId] });
    },
  });

  const can = (
    resource: Resource,
    action: keyof PermissionAction
  ): boolean => {
    return checkPermission(permissionsQuery.data, resource, action);
  };

  return {
    permissions: permissionsQuery.data ?? {},
    isLoading: permissionsQuery.isLoading,
    can,
    savePermissions: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
