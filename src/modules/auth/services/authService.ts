import { supabase } from "@/integrations/supabase/client";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { handleError } from "../../shared/utils/errorHandler";

export type AppRole = "admin" | "profissional" | "paciente" | "gestor" | "secretario" | "master";

export interface PermissionEntry {
    resource: string;
    access_level: "view" | "edit";
}

/** Column list for profile queries (avoids SELECT *). */
const PROFILE_COLUMNS =
    "id, user_id, nome, email, telefone, foto_url, created_at, updated_at" as const;

export const authService = {
    async getProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select(PROFILE_COLUMNS)
                .eq("user_id", userId)
                .maybeSingle();

            if (error) throw error;
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

            if (error) throw error;
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
            const { data, error } = await supabase
                .from("user_permissions")
                .select("resource, access_level")
                .eq("user_id", userId)
                .eq("enabled", true);

            if (error) throw error;
            return (
                data?.map((p) => ({
                    resource: p.resource,
                    access_level: (p.access_level || "edit") as "view" | "edit",
                })) ?? []
            );
        } catch (error) {
            handleError(error, "Erro ao buscar permissões do usuário.");
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
