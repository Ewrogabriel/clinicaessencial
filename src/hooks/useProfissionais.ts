import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profissional, ProfissionalBasic } from "@/types/entities";
import { useClinic } from "@/hooks/useClinic";

interface UseProfissionaisOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch professionals filtered by active clinic
 */
export function useProfissionais(options: UseProfissionaisOptions = {}) {
  const { enabled = true } = options;
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["profissionais", activeClinicId],
    queryFn: async () => {
      // Get user IDs with professional or admin roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["profissional", "admin"]);

      let ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];

      // Filter by clinic if active
      if (activeClinicId) {
        const { data: clinicUsers } = await supabase
          .from("clinic_users")
          .select("user_id")
          .eq("clinic_id", activeClinicId);

        const clinicUserIds = new Set(clinicUsers?.map((cu) => cu.user_id) ?? []);
        ids = ids.filter(id => clinicUserIds.has(id));
        if (!ids.length) return [];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, nome, email, telefone, especialidade, cor_agenda, commission_rate, commission_fixed, registro_profissional, tipo_contratacao")
        .in("user_id", ids)
        .order("nome");

      if (error) throw error;
      return (data || []) as Profissional[];
    },
    enabled,
  });
}

/**
 * Hook to fetch a simplified list of professionals
 */
export function useProfissionaisBasic(options: UseProfissionaisOptions = {}) {
  const { enabled = true } = options;
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["profissionais-basic", activeClinicId],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["profissional", "admin"]);

      let ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];

      if (activeClinicId) {
        const { data: clinicUsers } = await supabase
          .from("clinic_users")
          .select("user_id")
          .eq("clinic_id", activeClinicId);

        const clinicUserIds = new Set(clinicUsers?.map((cu) => cu.user_id) ?? []);
        ids = ids.filter(id => clinicUserIds.has(id));
        if (!ids.length) return [];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, nome, cor_agenda")
        .in("user_id", ids)
        .order("nome");

      if (error) throw error;
      return (data || []) as ProfissionalBasic[];
    },
    enabled,
  });
}

/**
 * Hook to fetch all profiles (for selects/dropdowns)
 */
export function useProfiles(options: UseProfissionaisOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, nome")
        .order("nome");

      if (error) throw error;
      return (data || []) as Array<{ id: string; user_id: string; nome: string }>;
    },
    enabled,
  });
}

/**
 * Build a color map for professionals (profissional_id -> color)
 */
export function buildProfColorMap(profissionais: ProfissionalBasic[]): Record<string, string> {
  const colorMap: Record<string, string> = {};
  profissionais.forEach((p) => {
    colorMap[p.user_id] = p.cor_agenda || "#3b82f6";
  });
  return colorMap;
}
