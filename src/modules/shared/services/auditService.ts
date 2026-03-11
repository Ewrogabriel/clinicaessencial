import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "CANCEL";

export const auditService = {
    async logAction(options: {
        userId: string,
        action: AuditAction,
        resource: string,
        resourceId: string,
        details?: any,
        clinicId?: string
    }) {
        try {
            const { data, error } = await supabase
                .from("audit_logs")
                .insert([{
                    user_id: options.userId,
                    action: options.action,
                    resource: options.resource,
                    resource_id: options.resourceId,
                    details: options.details,
                    clinic_id: options.clinicId,
                    created_at: new Date().toISOString()
                }]);

            if (error) {
                // Se falhar ao registrar log, falhamos silenciosamente para o usuário 
                // mas logamos internamente
                console.error("Failed to log audit action:", error);
            }
        } catch (err) {
            console.error("Audit Logging Error:", err);
        }
    }
};
