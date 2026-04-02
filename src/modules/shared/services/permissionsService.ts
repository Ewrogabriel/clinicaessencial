import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import {
  UserPermissions,
  validatePermissions,
  DEFAULT_PERMISSIONS,
} from "@/modules/finance/utils/permissionSchemas";

export interface PermissionOverride {
  userId: string;
  permissions: UserPermissions;
  updatedBy: string;
  updatedAt: string;
}

export const permissionsService = {
  /**
   * Load permissions for a user from the profiles table (user_permissions JSONB).
   * Falls back to role-based defaults if the JSONB is missing or invalid.
   */
  async getUserPermissions(
    userId: string,
    role?: string
  ): Promise<UserPermissions> {
    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("user_permissions")
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      const validated = validatePermissions(data?.user_permissions);
      if (validated) return validated;

      // Fall back to role defaults
      const roleFallback = role && DEFAULT_PERMISSIONS[role];
      return roleFallback ?? {};
    } catch (error) {
      handleError(error, "Erro ao carregar permissões do usuário.");
      return {};
    }
  },

  /**
   * Save (override) permissions for a user.
   * Logs the change to the audit service.
   */
  async saveUserPermissions(
    userId: string,
    permissions: UserPermissions,
    updatedBy: string
  ): Promise<void> {
    try {
      const validated = validatePermissions(permissions);
      if (!validated) {
        throw new Error("Permissões inválidas — verifique o schema.");
      }

      const { error } = await (supabase as any)
        .from("profiles")
        .update({ user_permissions: validated } as any)
        .eq("user_id", userId);

      if (error) throw error;

      // Audit log
      await (supabase as any).from("audit_logs").insert({
        entity_type: "user_permissions",
        entity_id: userId,
        action: "update",
        changes: { permissions: validated },
        performed_by: updatedBy,
        created_at: new Date().toISOString(),
      } as any);
    } catch (error) {
      handleError(error, "Erro ao salvar permissões do usuário.");
      throw error;
    }
  },

  /**
   * Migrate all existing profiles to have default permissions based on
   * their current role. Skips profiles that already have valid permissions.
   */
  async migrateDefaultPermissions(): Promise<{
    migrated: number;
    skipped: number;
  }> {
    let migrated = 0;
    let skipped = 0;

    try {
      const { data: profiles, error } = await (supabase as any)
        .from("profiles")
        .select("user_id, user_permissions");

      if (error) throw error;

      // Fetch roles separately
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role");

      const roleMap: Record<string, string> = {};
      (roles ?? []).forEach((r: any) => {
        roleMap[r.user_id] = r.role;
      });

      for (const profile of profiles ?? []) {
        const existing = validatePermissions(profile.user_permissions);
        if (existing) {
          skipped++;
          continue;
        }

        const role = roleMap[profile.user_id];
        const defaults = role && DEFAULT_PERMISSIONS[role];
        if (!defaults) {
          skipped++;
          continue;
        }

        const { error: updateError } = await (supabase as any)
          .from("profiles")
          .update({ user_permissions: defaults } as any)
          .eq("user_id", profile.user_id);

        if (!updateError) migrated++;
        else skipped++;
      }
    } catch (error) {
      handleError(error, "Erro durante migração de permissões.");
    }

    return { migrated, skipped };
  },
};
