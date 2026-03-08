import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Paciente, PacienteBasic } from "@/types/entities";
import { useClinic } from "@/hooks/useClinic";

interface UsePacientesOptions {
  status?: "ativo" | "inativo";
  enabled?: boolean;
}

/**
 * Hook to fetch list of patients filtered by active clinic
 */
export function usePacientes(options: UsePacientesOptions = {}) {
  const { status = "ativo", enabled = true } = options;
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["pacientes", status, activeClinicId],
    queryFn: async () => {
      // If we have an active clinic, fetch patients linked to it
      if (activeClinicId) {
        const { data: clinicPacientes } = await supabase
          .from("clinic_pacientes")
          .select("paciente_id")
          .eq("clinic_id", activeClinicId);

        const ids = clinicPacientes?.map((cp) => cp.paciente_id) ?? [];
        if (!ids.length) return [];

        let query = supabase
          .from("pacientes")
          .select("*")
          .in("id", ids)
          .order("nome");

        if (status) {
          query = query.eq("status", status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as Paciente[];
      }

      // Fallback: no clinic filter
      let query = supabase
        .from("pacientes")
        .select("*")
        .order("nome");

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Paciente[];
    },
    enabled,
  });
}

/**
 * Hook to fetch a simplified list of patients (id, nome only)
 */
export function usePacientesBasic(options: UsePacientesOptions = {}) {
  const { status = "ativo", enabled = true } = options;
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["pacientes-basic", status, activeClinicId],
    queryFn: async () => {
      if (activeClinicId) {
        const { data: clinicPacientes } = await supabase
          .from("clinic_pacientes")
          .select("paciente_id")
          .eq("clinic_id", activeClinicId);

        const ids = clinicPacientes?.map((cp) => cp.paciente_id) ?? [];
        if (!ids.length) return [];

        let query = supabase
          .from("pacientes")
          .select("id, nome")
          .in("id", ids)
          .order("nome");

        if (status) {
          query = query.eq("status", status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as PacienteBasic[];
      }

      let query = supabase
        .from("pacientes")
        .select("id, nome")
        .order("nome");

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PacienteBasic[];
    },
    enabled,
  });
}

/**
 * Hook to fetch a single patient by ID
 */
export function usePaciente(pacienteId: string | undefined) {
  return useQuery({
    queryKey: ["paciente", pacienteId],
    queryFn: async () => {
      if (!pacienteId) return null;
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", pacienteId)
        .single();
      if (error) throw error;
      return data as Paciente;
    },
    enabled: !!pacienteId,
  });
}

/**
 * Hook to find patient by user_id (for logged-in patients)
 */
export function usePacienteByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ["paciente-by-user", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as Paciente | null;
    },
    enabled: !!userId,
  });
}
