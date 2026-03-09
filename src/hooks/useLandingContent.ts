import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLandingContent() {
  return useQuery({
    queryKey: ["landing-content-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_content")
        .select("secao, conteudo");
      if (error) throw error;
      const map: Record<string, any> = {};
      data?.forEach((row: any) => {
        map[row.secao] = row.conteudo;
      });
      return map;
    },
    staleTime: 1000 * 60 * 5,
  });
}
