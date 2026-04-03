import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export type AuditAction =
  | "reconcile"
  | "split"
  | "undo"
  | "adjust"
  | "reject"
  | "edit"
  | "delete"
  | "auto_reconcile"
  | "refund"
  | "config_change";

export type AuditResourceType =
  | "transaction"
  | "payment"
  | "split"
  | "adjustment"
  | "config";

export interface AuditLogEntry {
  id?: string;
  clinic_id: string;
  user_id?: string | null;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  reason?: string | null;
  ip_address?: string | null;
  created_at?: string;
}

export const auditService = {
  /**
   * Write an immutable audit log entry.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from("audit_logs_reconciliation")
        .insert(entry);
      if (error) throw error;
    } catch (error) {
      // Never throw from audit logging – just log to console
      console.warn("Audit log failed:", error);
    }
  },

  /**
   * Get audit logs for a resource.
   */
  async getLogs(
    clinicId: string,
    options: {
      resourceId?: string;
      resourceType?: AuditResourceType;
      limit?: number;
    } = {}
  ): Promise<AuditLogEntry[]> {
    try {
      let q = (supabase as any)
        .from("audit_logs_reconciliation")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(options.limit ?? 50);

      if (options.resourceId) q = q.eq("resource_id", options.resourceId);
      if (options.resourceType) q = q.eq("resource_type", options.resourceType);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    } catch (error) {
      handleError(error, "Erro ao buscar logs de auditoria");
      return [];
    }
  },
};
