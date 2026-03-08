import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Clinica {
  id: string;
  nome: string;
  cnpj: string | null;
  logo_url: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
}

interface ClinicContextType {
  clinics: Clinica[];
  activeClinic: Clinica | null;
  activeClinicId: string | null;
  setActiveClinicId: (id: string) => void;
  isLoading: boolean;
  isMultiClinic: boolean;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

const STORAGE_KEY = "essencial_active_clinic";

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const { data: clinics = [], isLoading } = useQuery({
    queryKey: ["user-clinics", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch clinics the user has access to
      const { data: userClinics } = await (supabase
        .from("clinic_users") as any)
        .select("clinic_id")
        .eq("user_id", user.id);

      if (!userClinics?.length) {
        // Fallback: fetch all clinics (for admin or if no junction data yet)
        const { data } = await (supabase
          .from("clinicas") as any)
          .select("id, nome, cnpj, logo_url, cidade, estado, ativo")
          .eq("ativo", true)
          .order("nome");
        return (data || []) as Clinica[];
      }

      const ids = userClinics.map((uc: any) => uc.clinic_id);
      const { data } = await (supabase
        .from("clinicas") as any)
        .select("id, nome, cnpj, logo_url, cidade, estado, ativo")
        .in("id", ids)
        .eq("ativo", true)
        .order("nome");

      return (data || []) as Clinica[];
    },
    enabled: !!user?.id,
  });

  // Auto-select first clinic if none selected
  useEffect(() => {
    if (clinics.length > 0 && !activeClinicId) {
      setActiveClinicIdState(clinics[0].id);
      localStorage.setItem(STORAGE_KEY, clinics[0].id);
    }
    // Validate stored clinic still exists
    if (activeClinicId && clinics.length > 0 && !clinics.find(c => c.id === activeClinicId)) {
      setActiveClinicIdState(clinics[0].id);
      localStorage.setItem(STORAGE_KEY, clinics[0].id);
    }
  }, [clinics, activeClinicId]);

  const setActiveClinicId = useCallback((id: string) => {
    setActiveClinicIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Invalidate all queries so they refetch with new clinic context
    queryClient.invalidateQueries();
  }, [queryClient]);

  const activeClinic = clinics.find(c => c.id === activeClinicId) || null;

  return (
    <ClinicContext.Provider
      value={{
        clinics,
        activeClinic,
        activeClinicId,
        setActiveClinicId,
        isLoading,
        isMultiClinic: clinics.length > 1,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error("useClinic deve ser usado dentro de um ClinicProvider");
  }
  return context;
}
