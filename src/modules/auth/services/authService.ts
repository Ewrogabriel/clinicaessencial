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
            // Legacy permission system: user_permissions has columns
            // (user_id, resource, access_level, enabled). We map it onto the
            // PermissionEntry shape used by the auth layer.
            const { data, error } = await (supabase as any)
                .from("user_permissions")
                .select("id, resource, access_level, enabled")
                .eq("user_id", userId)
                .eq("enabled", true);

            if (error) {
                // Table may not exist or columns missing – fail open silently
                if (error.code === "PGRST205" || error.code === "42703" || error.code === "42P01") return [];
                throw error;
            }

            return ((data ?? []) as any[]).map((r) => ({
                id: r.id,
                module: r.resource,
                action: r.access_level,
                scope_type: "global",
            })) as PermissionEntry[];
        } catch (error) {
            // Don't toast — this is non-critical context loading
            console.warn("getPermissions:", error);
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
