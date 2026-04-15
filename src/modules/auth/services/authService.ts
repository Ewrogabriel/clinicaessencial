import { supabase } from "@/integrations/supabase/client";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { handleError } from "../../shared/utils/errorHandler";

export type AppRole = "admin" | "profissional" | "paciente" | "gestor" | "secretario" | "master";

export interface PermissionEntry {
    id: string;
    module: string;
    action: string;
    scope_type: "own" | "others" | "global";
    is_override?: boolean;
}

/** Column list for profile queries (avoids SELECT *). */
const PROFILE_COLUMNS =
    "id, user_id, nome, email, telefone, especialidade, registro_profissional, conselho_profissional, registro_conselho, assinatura_url, rubrica_url, foto_url, created_at, updated_at" as const;

export const authService = {
    async getProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select(PROFILE_COLUMNS)
                .eq("user_id", userId)
                .maybeSingle();

            if (error) {
                // PGRST116 means "0 rows" with .single()-style call – treat as not found, no toast
                if (error.code === "PGRST116") return null;
                throw error;
            }
            return data ?? null;
        } catch (error) {
            handleError(error, "Erro ao buscar perfil do usuário.");
            return null;
        }
    },

    async getPatientId(userId: string) {
        try {
            const { data, error } = await supabase
                .from("pacientes")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle();

            if (error) {
                if (error.code === "PGRST116") return null;
                throw error;
            }
            return data?.id || null;
        } catch (error) {
            // maybeSingle doesn't throw on 0 results, but other errors might occur
            handleError(error, "Erro ao buscar ID do paciente.");
            return null;
        }
    },

    async getRoles(userId: string): Promise<AppRole[]> {
        try {
            const { data, error } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", userId);

            if (error) throw error;
            return (data?.map((r) => r.role) as AppRole[]) ?? [];
        } catch (error) {
            handleError(error, "Erro ao buscar funções do usuário.");
            return [];
        }
    },

    async getPermissions(userId: string): Promise<PermissionEntry[]> {
        try {
            // New Advanced Permissions Query System (Roles + Overrides combined)
            const { data: rolePerms, error: rErr } = await supabase
                .from("role_permissions")
                .select(`
                    app_permissions (
                        id, module, action, scope_type
                    )
                `)
                .in("role_id", (
                    // Subselect to get user's roles
                    (await supabase.from("user_roles").select("role_id").eq("user_id", userId)).data?.map(r => r.role_id) || []
                ));

            if (rErr) throw rErr;

            const { data: overrides, error: oErr } = await supabase
                .from("user_access_overrides")
                .select(`
                    allowed,
                    app_permissions (
                        id, module, action, scope_type
                    )
                `)
                .eq("user_id", userId);

            if (oErr) throw oErr;

            const resolvedPerms = new Map<string, PermissionEntry>();

            // Process role perms
            rolePerms?.forEach((rp: any) => {
                const p = rp.app_permissions;
                if (!p) return;
                resolvedPerms.set(p.id, { ...p, is_override: false });
            });

            // Process overrides (priority)
            overrides?.forEach((ov: any) => {
                const p = ov.app_permissions;
                if (!p) return;
                if (ov.allowed) {
                    resolvedPerms.set(p.id, { ...p, is_override: true });
                } else {
                    resolvedPerms.delete(p.id);
                }
            });

            return Array.from(resolvedPerms.values());
        } catch (error) {
            handleError(error, "Erro ao buscar permissões avançadas do usuário.");
            return [];
        }
    },

    async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            handleError(error, "Erro ao sair do sistema.");
        }
    },

    async signIn(email: string, password: string) {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        } catch (error) {
            throw handleError(error, "Erro ao fazer login.");
        }
    },

    async resetPassword(email: string) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
        } catch (error) {
            throw handleError(error, "Erro ao solicitar recuperação de senha.");
        }
    }
};
