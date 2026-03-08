import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Agendamento, StatusAgendamento } from "@/types/entities";
import { toast } from "@/hooks/use-toast";
import { useClinic } from "@/hooks/useClinic";

interface UseAgendamentosOptions {
  pacienteId?: string;
  profissionalId?: string;
  enabled?: boolean;
}

export function useAgendamentos(options: UseAgendamentosOptions = {}) {
  const { pacienteId, profissionalId, enabled = true } = options;
  const { activeClinicId } = useClinic();

  return useQuery({
    queryKey: ["agendamentos", pacienteId, profissionalId, activeClinicId],
    queryFn: async () => {
      let query = supabase
        .from("agendamentos")
        .select(`
          *,
          pacientes (id, nome, telefone)
        `);

      if (activeClinicId) {
        query = query.eq("clinic_id", activeClinicId);
      }
      if (pacienteId) {
        query = query.eq("paciente_id", pacienteId);
      }
      if (profissionalId) {
        query = query.eq("profissional_id", profissionalId);
      }

      const { data, error } = await query.order("data_horario", { ascending: true });

      if (error) {
        console.error("Error fetching agendamentos:", error);
        return [];
      }

      return (data || []) as Agendamento[];
    },
    enabled,
  });
}

export function useUpdateAgendamentoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusAgendamento }) => {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export function useAgendamentoCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: "paciente" | "profissional" }) => {
      const updateData = type === "paciente"
        ? { checkin_paciente: true, checkin_paciente_at: new Date().toISOString() }
        : { checkin_profissional: true, checkin_profissional_at: new Date().toISOString() };
      
      const { error } = await supabase
        .from("agendamentos")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast({ title: "Check-in realizado! ✅" });
    },
    onError: () => {
      toast({ title: "Erro ao fazer check-in", variant: "destructive" });
    },
  });
}

export function useRescheduleAgendamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: Date }) => {
      const { error } = await supabase
        .from("agendamentos")
        .update({ data_horario: newDate.toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
    },
    onError: () => {
      toast({ title: "Erro ao mover sessão", variant: "destructive" });
    },
  });
}
