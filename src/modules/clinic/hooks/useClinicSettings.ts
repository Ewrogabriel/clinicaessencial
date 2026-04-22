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
  rubrica_url: string | null;
  assinatura_url: string | null;
  // Padrões de contrato
  pref_contract_multa_atraso_pct: number;
  pref_contract_juros_mensal_pct: number;
  pref_contract_prazo_cancelamento_h: number;
  pref_contract_dia_vencimento: number;
  pref_contract_prazo_reposicao_dias: number;
  pref_contract_vigencia_meses: number;
  pref_contract_raio_nao_concorrencia_km: number;
  pref_contract_multa_nao_captacao_fator: number;
  pref_contract_multa_nao_captacao_valor: number | null;
  pref_contract_dia_pagamento_comissao: number;
  pref_contract_prazo_aviso_previo_dias: number;
  pref_contract_multa_uso_marca_valor: number;
  pref_contract_cidade_foro: string | null;
  pref_contract_estado_foro: string | null;
  pref_contract_enrollment_fee: number | null;
  pref_contract_witness1_name: string | null;
  pref_contract_witness1_cpf: string | null;
  pref_contract_witness2_name: string | null;
  pref_contract_witness2_cpf: string | null;
}

export function useClinicSettings() {
  return useQuery({
    queryKey: ["clinic-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("clinic_settings")
        .select(`
          id, nome, cnpj, endereco, numero, bairro, cidade, estado, cep, 
          telefone, whatsapp, email, instagram, logo_url, rubrica_url, assinatura_url,
          pref_contract_multa_atraso_pct, pref_contract_juros_mensal_pct, pref_contract_prazo_cancelamento_h,
          pref_contract_dia_vencimento, pref_contract_prazo_reposicao_dias, pref_contract_vigencia_meses,
          pref_contract_raio_nao_concorrencia_km, pref_contract_multa_nao_captacao_fator, pref_contract_multa_nao_captacao_valor,
          pref_contract_dia_pagamento_comissao, pref_contract_prazo_aviso_previo_dias,
          pref_contract_multa_uso_marca_valor, pref_contract_cidade_foro, pref_contract_estado_foro,
          pref_contract_enrollment_fee, pref_contract_witness1_name, pref_contract_witness1_cpf,
          pref_contract_witness2_name, pref_contract_witness2_cpf
        `)
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
    mutationFn: async (updates: Partial<ClinicSettings> & { id?: string }) => {
      // Strip any legacy/foreign fields that don't belong to clinic_settings
      const { id, primary_color, ...rest } = updates as any;
      
      if (id) {
        const { data, error } = await (supabase
          .from("clinic_settings")
          .update(rest)
          .eq("id", id)
          .select() as any);
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase
          .from("clinic_settings")
          .insert({ nome: rest.nome || "Minha Clínica", ...rest })
          .select() as any);
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic-settings"] }),
  });
}
