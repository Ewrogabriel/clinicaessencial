import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClinicSettings {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  logo_url: string | null;
}

export function useClinicSettings() {
  return useQuery({
    queryKey: ["clinic-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("clinic_settings")
        .select("id, nome, cnpj, endereco, numero, bairro, cidade, estado, cep, telefone, whatsapp, email, instagram, logo_url")
        .limit(1)
        .maybeSingle() as any);
      if (error) throw error;
      return data as ClinicSettings | null;
    },
  });
}

export function useUpdateClinicSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<ClinicSettings> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await (supabase
        .from("clinic_settings")
        .update(rest)
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic-settings"] }),
  });
}
