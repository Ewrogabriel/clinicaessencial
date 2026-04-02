import { supabase } from "@/integrations/supabase/client";

export type SessionStatus = "aguardando" | "em_andamento" | "finalizado";

export interface CreateSessionData {
  patientId: string;
  clinicId: string;
  agendamentoId?: string;
  scheduledAt?: string;
}

export async function createSession(data: CreateSessionData) {
  const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data: session, error } = await (supabase.from("teleconsulta_sessions") as any).insert({
    paciente_id: data.patientId,
    clinic_id: data.clinicId,
    agendamento_id: data.agendamentoId ?? null,
    scheduled_at: data.scheduledAt ?? null,
    status: "aguardando",
    room_id: roomId,
  }).select().single();
  if (error) throw error;
  return session;
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus) {
  const updates: Record<string, unknown> = { status };
  if (status === "em_andamento") updates.started_at = new Date().toISOString();
  const { data, error } = await (supabase.from("teleconsulta_sessions") as any)
    .update(updates)
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function generateSessionToken(sessionId: string): string {
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const payload = JSON.stringify({ sessionId, expiry });
  return btoa(payload);
}

export async function getSession(sessionId: string) {
  const { data, error } = await (supabase.from("teleconsulta_sessions") as any)
    .select("*, pacientes(nome, telefone, data_nascimento), agendamentos(data_horario, profissional_id)")
    .eq("id", sessionId)
    .single();
  if (error) throw error;
  return data;
}

export async function endSession(sessionId: string, summary?: string) {
  const updates: Record<string, unknown> = { status: "finalizado" };
  if (summary) updates.resumo_clinico = summary;

  // Calculate duration from started_at
  const { data: current } = await (supabase.from("teleconsulta_sessions") as any)
    .select("started_at")
    .eq("id", sessionId)
    .single();

  if (current?.started_at) {
    const durationSeconds = Math.floor(
      (Date.now() - new Date(current.started_at).getTime()) / 1000
    );
    updates.duration_seconds = durationSeconds;
  }

  const { data, error } = await (supabase.from("teleconsulta_sessions") as any)
    .update(updates)
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function sendSessionLink(sessionId: string, phone: string, patientName: string): string {
  const sessionUrl = `${window.location.origin}/teleconsulta?session=${sessionId}`;
  const rawPhone = phone.replace(/\D/g, "");
  const fullPhone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;
  const message = `Olá ${patientName}! 😊\n\nSua teleconsulta está pronta. Acesse pelo link abaixo:\n${sessionUrl}\n\nAguardamos você!`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}
