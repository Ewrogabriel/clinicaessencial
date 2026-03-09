import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePatientAgenda(patientId: string | null, enabled: boolean = true) {
  const futureAgenda = useQuery({
    queryKey: ["patient-agenda", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .gte("data_horario", new Date().toISOString())
        .in("status", ["pendente", "agendado", "confirmado"])
        .order("data_horario", { ascending: true })
        .limit(10);
      
      if (error) throw error;
      
      // Fetch professional names
      const profIds = [...new Set((data || []).map((a) => a.profissional_id))];
      let profMap: Record<string, { nome: string; telefone: string }> = {};
      
      if (profIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome, telefone")
          .in("user_id", profIds);
        
        (profs || []).forEach((p) => {
          profMap[p.user_id] = { nome: p.nome, telefone: p.telefone || "" };
        });
      }
      
      return (data || []).map((a) => ({
        ...a,
        profiles: { nome: profMap[a.profissional_id]?.nome || "Profissional" },
        profissional_telefone: profMap[a.profissional_id]?.telefone || ""
      }));
    },
    enabled: !!patientId && enabled,
  });

  const pastAgenda = useQuery({
    queryKey: ["patient-agenda-past", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", patientId)
        .lt("data_horario", new Date().toISOString())
        .order("data_horario", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      const profIds = [...new Set((data || []).map((a) => a.profissional_id))];
      let profMap: Record<string, { nome: string; telefone: string }> = {};
      
      if (profIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome, telefone")
          .in("user_id", profIds);
        
        (profs || []).forEach((p) => {
          profMap[p.user_id] = { nome: p.nome, telefone: p.telefone || "" };
        });
      }
      
      return (data || []).map((a) => ({
        ...a,
        profiles: { nome: profMap[a.profissional_id]?.nome || "Profissional" },
        profissional_telefone: profMap[a.profissional_id]?.telefone || ""
      }));
    },
    enabled: !!patientId && enabled,
  });

  const solicitacoes = useQuery({
    queryKey: ["patient-solicitacoes", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("solicitacoes_remarcacao")
        .select("agendamento_id, status")
        .eq("paciente_id", patientId)
        .eq("status", "pendente");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId && enabled,
  });

  return {
    futureAgenda: futureAgenda.data || [],
    pastAgenda: pastAgenda.data || [],
    solicitacoes: solicitacoes.data || [],
    isLoading: futureAgenda.isLoading || pastAgenda.isLoading || solicitacoes.isLoading,
  };
}
