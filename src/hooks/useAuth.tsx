import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type AppRole = "admin" | "profissional" | "paciente" | "gestor" | "secretario" | "master";

interface PermissionEntry {
  resource: string;
  access_level: "view" | "edit";
}

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
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
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

  const fetchProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(profile);

    const { data: paciente } = await supabase
      .from("pacientes")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    setPatientId(paciente?.id || null);
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles(data?.map((r) => r.role) ?? []);
  };

  const fetchPermissions = async (userId: string) => {
    const { data } = await supabase
      .from("user_permissions")
      .select("resource, access_level")
      .eq("user_id", userId)
      .eq("enabled", true);
    setPermissions(
      data?.map((p: { resource: string; access_level: string }) => ({ resource: p.resource, access_level: (p.access_level || "edit") as "view" | "edit" })) ?? []
    );
  };

  useEffect(() => {
    // Set up auth listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchRoles(session.user.id);
            fetchPermissions(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setPermissions([]);
        }
        setLoading(false);
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRoles(session.user.id);
        fetchPermissions(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setPermissions([]);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const isMaster = roles.includes("master");
  const isAdmin = roles.includes("admin") || isMaster;
  const isGestor = roles.includes("gestor");
  const isPatient = roles.includes("paciente");
  const isProfissional = roles.includes("profissional");
  const isSecretario = roles.includes("secretario");
  const clinicId = profile ? (profile as Record<string, unknown>).clinic_id as string | null ?? null : null;

  const hasPermission = (resource: string) => {
    if (isAdmin) return true;
    return permissions.some(p => p.resource === resource);
  };

  const canEdit = (resource: string) => {
    if (isAdmin) return true;
    const perm = permissions.find(p => p.resource === resource);
    return perm?.access_level === "edit";
  };

  return (
    <AuthContext.Provider
      value={{
        user, session, profile, roles, permissions, loading,
        isMaster, isAdmin, isGestor, isPatient, isProfissional, isSecretario,
        clinicId, patientId,
        hasPermission, canEdit,
        signIn, signUp, resetPassword, signOut
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
