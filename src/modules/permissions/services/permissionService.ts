import { supabase } from "@/integrations/supabase/client";
import type {
  Permission, RolePermission, UserPermissionOverride, SchedulePermission,
} from "../types";

export const permissionService = {
  async listPermissions(): Promise<Permission[]> {
    const { data, error } = await (supabase as any)
      .from("permissions")
      .select("*")
      .order("module").order("action").order("scope_type");
    if (error) throw error;
    return (data ?? []) as Permission[];
  },

  async listRolePermissions(role?: string): Promise<RolePermission[]> {
    let q = (supabase as any).from("role_permissions").select("*");
    if (role) q = q.eq("role", role);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as RolePermission[];
  },

  async setRolePermission(role: string, permission_id: string, allowed: boolean) {
    if (allowed) {
      const { error } = await (supabase as any)
        .from("role_permissions")
        .upsert({ role, permission_id }, { onConflict: "role,permission_id" });
      if (error) throw error;
    } else {
      const { error } = await (supabase as any)
        .from("role_permissions")
        .delete()
        .eq("role", role)
        .eq("permission_id", permission_id);
      if (error) throw error;
    }
  },

  async listUserOverrides(user_id: string): Promise<UserPermissionOverride[]> {
    const { data, error } = await (supabase as any)
      .from("user_permissions_override")
      .select("*")
      .eq("user_id", user_id);
    if (error) throw error;
    return (data ?? []) as UserPermissionOverride[];
  },

  async setUserOverride(user_id: string, permission_id: string, allowed: boolean, granted_by: string) {
    const { error } = await (supabase as any)
      .from("user_permissions_override")
      .upsert(
        { user_id, permission_id, allowed, granted_by },
        { onConflict: "user_id,permission_id" }
      );
    if (error) throw error;
  },

  async clearUserOverride(user_id: string, permission_id: string) {
    const { error } = await (supabase as any)
      .from("user_permissions_override")
      .delete()
      .eq("user_id", user_id)
      .eq("permission_id", permission_id);
    if (error) throw error;
  },

  async getSchedulePermission(user_id: string): Promise<SchedulePermission | null> {
    const { data, error } = await (supabase as any)
      .from("schedule_permissions")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as SchedulePermission | null;
  },

  async setSchedulePermission(
    user_id: string,
    scope: "own" | "others" | "all",
    allowed_professionals: string[] | null,
    updated_by: string,
  ) {
    const { error } = await (supabase as any)
      .from("schedule_permissions")
      .upsert(
        { user_id, scope, allowed_professionals, updated_by },
        { onConflict: "user_id" }
      );
    if (error) throw error;
  },

  async can(user_id: string, module: string, action: string, scope: "own"|"others"|"global" = "global"): Promise<boolean> {
    const { data, error } = await (supabase as any).rpc("user_can", {
      _user_id: user_id, _module: module, _action: action, _scope: scope,
    });
    if (error) {
      console.warn("user_can rpc error:", error);
      return false;
    }
    return Boolean(data);
  },

  async canScheduleFor(user_id: string, target_professional_id: string): Promise<boolean> {
    const { data, error } = await (supabase as any).rpc("can_schedule_for", {
      _user_id: user_id, _target_professional_id: target_professional_id,
    });
    if (error) {
      console.warn("can_schedule_for rpc error:", error);
      return false;
    }
    return Boolean(data);
  },
};
