import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "CANCEL";

export const auditService = {
    async logAction(options: {
        userId: string,
        action: AuditAction,
        resource: string,
        resourceId: string,
        details?: Record<string, unknown>,
        clinicId?: string
    }) {
        try {
            const { error } = await supabase
                .from("audit_logs")
                .insert([{
                    user_id: options.userId,
                    acao: options.action,
                    tabela: options.resource,
                    registro_id: options.resourceId,
                    dados_novos: (options.details ?? null) as any,
                }]);

            if (error) {
                console.error("Failed to log audit action:", error);
            }
        } catch (err) {
            console.error("Audit Logging Error:", err);
        }
    }
};
