import { supabase } from "@/integrations/supabase/client";

export type ConfirmacaoStatus = "confirmado" | "cancelado";

export interface ConfirmationStats {
  total: number;
  confirmado: number;
  cancelado: number;
  pendente: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export async function sendConfirmationRequest(agendamentoId: string, clinicId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("confirm-agendamento", {
    body: { agendamentoId, clinicId, action: "send" },
  });
  if (error) throw error;
}

export async function getConfirmationStatus(agendamentoId: string): Promise<ConfirmacaoStatus | null> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("confirmacao_presenca")
    .eq("id", agendamentoId)
    .single();
  if (error) throw error;
  return (data?.confirmacao_presenca as ConfirmacaoStatus) ?? null;
}

export async function bulkSendConfirmations(agendamentoIds: string[], clinicId: string): Promise<void> {
  await Promise.all(agendamentoIds.map((id) => sendConfirmationRequest(id, clinicId)));
}

export async function getConfirmationStats(
  clinicId: string,
  dateRange: DateRange
): Promise<ConfirmationStats> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("confirmacao_presenca")
    .eq("clinic_id", clinicId)
    .gte("data_horario", dateRange.start)
    .lte("data_horario", dateRange.end)
    .in("status", ["agendado", "confirmado", "pendente"]);

  if (error) throw error;

  const rows = data ?? [];
  return {
    total: rows.length,
    confirmado: rows.filter((r) => r.confirmacao_presenca === "confirmado").length,
    cancelado: rows.filter((r) => r.confirmacao_presenca === "cancelado").length,
    pendente: rows.filter((r) => !r.confirmacao_presenca).length,
  };
}

export async function updateConfirmation(
  agendamentoId: string,
  status: ConfirmacaoStatus
): Promise<void> {
  const { error } = await supabase
    .from("agendamentos")
    .update({ confirmacao_presenca: status })
    .eq("id", agendamentoId);
  if (error) throw error;
}
