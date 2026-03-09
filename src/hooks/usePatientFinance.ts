import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePatientFinance(patientId: string | null, enabled: boolean = true) {
  const pendencias = useQuery({
    queryKey: ["patient-pendencias", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .eq("status", "pendente")
        .order("data_vencimento", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId && enabled,
  });

  const formasPagamento = useQuery({
    queryKey: ["formas-pagamento-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      
      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  const pagamentosMensalidade = useQuery({
    queryKey: ["pagamentos-mensalidade-paciente", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("pagamentos_mensalidade")
        .select("*")
        .eq("paciente_id", patientId)
        .order("mes_referencia", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId && enabled,
  });

  const pagamentosSessoes = useQuery({
    queryKey: ["pagamentos-sessoes-paciente", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("pagamentos_sessoes")
        .select("*")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId && enabled,
  });

  const configPixMap = useQuery({
    queryKey: ["config-pix-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("config_pix")
        .select("forma_pagamento_id, chave_pix, tipo_chave, nome_beneficiario");
      
      const map: Record<string, any> = {};
      (data || []).forEach((p) => {
        map[p.forma_pagamento_id] = p;
      });
      return map;
    },
    enabled,
  });

  return {
    pendencias: pendencias.data || [],
    formasPagamento: formasPagamento.data || [],
    pagamentosMensalidade: pagamentosMensalidade.data || [],
    pagamentosSessoes: pagamentosSessoes.data || [],
    configPixMap: configPixMap.data || {},
    isLoading: pendencias.isLoading || formasPagamento.isLoading || 
               pagamentosMensalidade.isLoading || pagamentosSessoes.isLoading,
  };
}
