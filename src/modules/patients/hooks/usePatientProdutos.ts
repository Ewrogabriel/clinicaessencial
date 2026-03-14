import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePatientProdutos(patientId: string | null, enabled: boolean = true) {
  const produtosDisponiveis = useQuery({
    queryKey: ["produtos-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, descricao, preco, estoque, ativo, categoria")
        .gt("estoque", 0)
        .eq("ativo", true)
        .order("nome");
      
      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  const minhasReservas = useQuery({
    queryKey: ["minhas-reservas", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("reservas_produtos")
        .select("produto_id")
        .eq("paciente_id", patientId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId && enabled,
  });

  return {
    produtosDisponiveis: produtosDisponiveis.data || [],
    minhasReservas: minhasReservas.data || [],
    isLoading: produtosDisponiveis.isLoading || minhasReservas.isLoading,
  };
}
