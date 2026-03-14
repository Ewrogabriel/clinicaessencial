import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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
    // Ref keeps the safety timer in sync with the current loading state without
    // needing to add `loading` to the effect dependency array (which would cause
    // the effect to re-run on every loading change and re-subscribe to auth events).
    const loadingRef = useRef(true);

    const loadUserData = async (userId: string) => {
        try {
            console.log("[Auth] Loading data for user:", userId);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout loading user data")), 5000)
            );

            const dataPromise = Promise.all([
                authService.getProfile(userId),
                authService.getPatientId(userId),
                authService.getRoles(userId),
                authService.getPermissions(userId),
            ]);

            const [p, pId, r, perms] = await Promise.race([dataPromise, timeoutPromise]) as any;

            setProfile(p as Profile);
            setPatientId(pId);
            setRoles(r);
            setPermissions(perms);
            console.log("[Auth] Data loaded successfully");
        } catch (error) {
            console.error("[Auth] Data load failed or timed out:", error);
        }
    };

    useEffect(() => {
        let mounted = true;
        console.log("[Auth] Effect mounting...");

        const initialize = async () => {
            try {
                console.log("[Auth] Initializing session...");
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error("[Auth] getSession error:", error);
                }

                if (!mounted) return;

                if (session?.user) {
                    setSession(session);
                    setUser(session.user);
                    await loadUserData(session.user.id);
                } else {
                    console.log("[Auth] No active session found");
                }
            } catch (err) {
                console.error("[Auth] Fatal initialization error:", err);
            } finally {
                if (mounted) {
                    loadingRef.current = false;
                    setLoading(false);
                    console.log("[Auth] Initial logic finished, loading set to false");
                }
            }
        };

        initialize();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log("[Auth] onAuthStateChange fired:", event);
                if (!mounted) return;

                if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                    setSession(session);
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        await loadUserData(session.user.id);
                    }
                    loadingRef.current = false;
                    setLoading(false);
                } else if (event === "SIGNED_OUT") {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setRoles([]);
                    setPermissions([]);
                    setPatientId(null);
                    loadingRef.current = false;
                    setLoading(false);
                }
            }
        );

        // Safety timeout to ensure app unblocks even if getSession/onAuthStateChange fail.
        // Uses a ref instead of the `loading` state variable to avoid a stale closure
        // (the closure would always capture the initial value `true` of `loading`).
        const safetyTimer = setTimeout(() => {
            if (mounted && loadingRef.current) {
                console.warn("[Auth] Safety timeout triggered - forcing loading: false");
                loadingRef.current = false;
                setLoading(false);
            }
        }, 8000);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimer);
            console.log("[Auth] Effect unmounted");
        };
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
