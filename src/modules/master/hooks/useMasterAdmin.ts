import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
import { toast } from "sonner";
  getClinics,
  getClinicStats,
  getMasterUsers,
} from "@/modules/master/services/masterService";

// ─── useClinics ─────────────────────────────────────────────

export function useClinics() {
  return useQuery({
    queryKey: ["master-clinics"],
    queryFn: getClinics,
  });
}

// ─── useClinicStats ─────────────────────────────────────────

export function useClinicStats(clinicId: string | undefined) {
  return useQuery({
    queryKey: ["master-clinic-stats", clinicId],
    queryFn: () => getClinicStats(clinicId!),
    enabled: !!clinicId,
  });
}

// ─── useActivateClinic ──────────────────────────────────────

export function useActivateClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clinicId: string) => {
      const { error } = await (supabase.from("clinicas") as any)
        .update({ ativo: true, updated_at: new Date().toISOString() })
        .eq("id", clinicId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Clínica ativada com sucesso ✅" });
      queryClient.invalidateQueries({ queryKey: ["master-clinics"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao ativar clínica", description: e.message, variant: "destructive" }),
  });
}

// ─── useDeactivateClinic ────────────────────────────────────

export function useDeactivateClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clinicId: string) => {
      const { error } = await (supabase.from("clinicas") as any)
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", clinicId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Clínica desativada" });
      queryClient.invalidateQueries({ queryKey: ["master-clinics"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao desativar clínica", description: e.message, variant: "destructive" }),
  });
}

// ─── useMasterUsers ─────────────────────────────────────────

export function useMasterUsers() {
  return useQuery({
    queryKey: ["master-users"],
    queryFn: getMasterUsers,
  });
}
