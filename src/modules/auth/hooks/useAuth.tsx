import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authService, AppRole, PermissionEntry } from "../services/authService";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    roles: AppRole[];
    permissions: PermissionEntry[];
    loading: boolean;
    isMaster: boolean;
    isAdmin: boolean;
    isGestor: boolean;
    isPatient: boolean;
    isProfissional: boolean;
    isSecretario: boolean;
    clinicId: string | null;
    patientId: string | null;
    hasPermission: (resource: string) => boolean;
    canEdit: (resource: string) => boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [roles, setRoles] = useState<AppRole[]>([]);
    const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
    const [patientId, setPatientId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const loadUserData = async (userId: string) => {
        const [p, pId, r, perms] = await Promise.all([
            authService.getProfile(userId),
            authService.getPatientId(userId),
            authService.getRoles(userId),
            authService.getPermissions(userId),
        ]);

        setProfile(p as Profile);
        setPatientId(pId);
        setRoles(r);
        setPermissions(perms);
    };

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    await loadUserData(session.user.id);
                } else {
                    setProfile(null);
                    setRoles([]);
                    setPermissions([]);
                    setPatientId(null);
                }
                setLoading(false);
            }
        );

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                loadUserData(session.user.id);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await authService.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setPatientId(null);
    };

    const isMaster = roles.includes("master");
    const isAdmin = roles.includes("admin") || isMaster;
    const isGestor = roles.includes("gestor");
    const isPatient = roles.includes("paciente");
    const isProfissional = roles.includes("profissional");
    const isSecretario = roles.includes("secretario");
    const clinicId = profile ? (profile as any).clinic_id as string | null ?? null : null;

    const hasPermission = (resource: string) => {
        if (isAdmin) return true;
        return permissions.some(p => p.resource === resource);
    };

    const canEdit = (resource: string) => {
        if (isAdmin) return true;
        const perm = permissions.find(p => p.resource === resource);
        return perm?.access_level === "edit";
    };

    const signIn = async (email: string, password: string) => {
        await authService.signIn(email, password);
    };

    const resetPassword = async (email: string) => {
        await authService.resetPassword(email);
    };

    return (
        <AuthContext.Provider
            value={{
                user, session, profile, roles, permissions, loading,
                isMaster, isAdmin, isGestor, isPatient, isProfissional, isSecretario,
                clinicId, patientId,
                hasPermission, canEdit,
                signIn, signOut, resetPassword
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth deve ser usado dentro de um AuthProvider");
    }
    return context;
}
