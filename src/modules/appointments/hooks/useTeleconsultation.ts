import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  createSession,
  updateSessionStatus,
  endSession,
  getSession,
  type CreateSessionData,
  type SessionStatus,
} from "@/modules/appointments/services/telehealthService";

export function useTeleconsultationSession(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [realtimeData, setRealtimeData] = useState<any>(null);

  const query = useQuery({
    queryKey: ["teleconsulta-session", sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`teleconsulta-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teleconsulta_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setRealtimeData(payload.new);
          queryClient.invalidateQueries({ queryKey: ["teleconsulta-session", sessionId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  return {
    ...query,
    data: realtimeData ?? query.data,
  };
}

export function useCreateTeleconsultation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSessionData) => createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teleconsulta-sessions"] });
      toast.success("Teleconsulta criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao criar teleconsulta");
    },
  });
}

export function useUpdateSessionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, status }: { sessionId: string; status: SessionStatus }) =>
      updateSessionStatus(sessionId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teleconsulta-session", variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ["teleconsulta-sessions"] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao atualizar status da sessão");
    },
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, summary }: { sessionId: string; summary?: string }) =>
      endSession(sessionId, summary),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teleconsulta-session", variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ["teleconsulta-sessions"] });
      toast.success("Sessão encerrada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao encerrar sessão");
    },
  });
}
