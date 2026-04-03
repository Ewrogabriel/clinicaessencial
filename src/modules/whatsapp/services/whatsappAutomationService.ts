// ============================================================
// WhatsApp Business Integration – Automation Service
// Orchestrates automated message sends for:
//   - Session confirmations
//   - Monthly payment reminders
//   - Overdue payment alerts
// Each send is logged to whatsapp_message_logs.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import { WhatsAppService } from "@/lib/whatsapp/whatsappService";
import { buildConfirmationMessage } from "@/lib/whatsapp/confirmationTemplates";
import {
  buildMonthlyReminderMessage,
  buildOverdueAlertMessage,
} from "@/lib/whatsapp/messageTemplates";
import { getConfig, getAutomationSettings } from "./whatsappConfigService";
import type {
  MessageType,
  MessageStatus,
  MonthlyReminderData,
  OverdueAlertData,
} from "@/modules/whatsapp/types";

// ── Internal helpers ─────────────────────────────────────────

/**
 * Writes a row to whatsapp_message_logs.
 * Errors are swallowed so logging failures never block the main flow.
 */
async function logMessage(params: {
  clinicId: string;
  patientId?: string | null;
  appointmentId?: string | null;
  messageType: MessageType;
  status: MessageStatus;
  content: string;
  phoneNumber: string;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    await (supabase as any).from("whatsapp_message_logs").insert({
      clinic_id: params.clinicId,
      patient_id: params.patientId ?? null,
      appointment_id: params.appointmentId ?? null,
      message_type: params.messageType,
      status: params.status,
      message_content: params.content,
      phone_number: params.phoneNumber,
      error_message: params.errorMessage ?? null,
    });
  } catch (_err) {
    // Logging failures must never propagate
  }
}

/** Builds a WhatsAppService from the clinic's stored credentials. */
async function buildServiceForClinic(clinicId: string): Promise<WhatsAppService> {
  const config = await getConfig(clinicId);

  if (!config) throw new Error("Configuração do WhatsApp não encontrada para esta clínica.");
  if (!config.is_active) throw new Error("Integração com WhatsApp não está ativa para esta clínica.");
  if (!config.api_token) throw new Error("Token da API WhatsApp não configurado.");
  if (!config.phone_number_id) throw new Error("Phone Number ID do WhatsApp não configurado.");

  return new WhatsAppService(config.api_token, config.phone_number_id);
}

// ── Public automation methods ────────────────────────────────

/**
 * Sends a session-confirmation WhatsApp message for a given appointment.
 *
 * Fetches the appointment, patient phone (prefers whatsapp field), and
 * professional name from Supabase, then builds and sends the message.
 */
export async function sendSessionConfirmation(appointmentId: string): Promise<void> {
  // 1. Load appointment with related data
  const { data: ag, error: agError } = await (supabase
    .from("agendamentos")
    .select(`
      id,
      data_horario,
      tipo_atendimento,
      clinic_id,
      paciente_id,
      profissional_id,
      pacientes (id, nome, telefone, whatsapp)
    `)
    .eq("id", appointmentId)
    .single() as any);

  if (agError || !ag) {
    handleError(agError, "Agendamento não encontrado.");
    return;
  }

  const clinicId: string = ag.clinic_id;
  const patient = ag.pacientes as {
    id: string;
    nome: string;
    telefone: string | null;
    whatsapp: string | null;
  } | null;

  const phone: string | null = patient?.whatsapp ?? patient?.telefone ?? null;
  if (!phone) {
    console.warn(`[WhatsApp] Paciente ${ag.paciente_id} sem telefone/whatsapp.`);
    return;
  }

  // 2. Load professional name from profiles
  const { data: profile } = await (supabase
    .from("profiles")
    .select("nome")
    .eq("user_id", ag.profissional_id)
    .maybeSingle() as any);

  const professionalName: string = (profile as { nome?: string } | null)?.nome ?? "seu profissional";

  // 3. Load automation settings for custom template
  const settings = await getAutomationSettings(clinicId);
  if (settings && !settings.session_confirmation_enabled) {
    console.info("[WhatsApp] Envio de confirmação desabilitado para esta clínica.");
    return;
  }

  // 4. Build message using the canonical confirmation template
  const appUrl = typeof window !== "undefined"
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL ?? "");

  const content = buildConfirmationMessage(
    {
      pacienteNome: patient?.nome ?? "Paciente",
      profissionalNome: professionalName,
      tipo: ag.tipo_atendimento || "sessão",
      dataHorario: ag.data_horario,
      confirmationLink: `${appUrl}/confirmar-agendamento/${appointmentId}`,
    },
    settings?.session_confirmation_message
  );

  // 5. Send
  const service = await buildServiceForClinic(clinicId);

  let status: MessageStatus = "sent";
  let errorMessage: string | null = null;

  try {
    await service.sendMessage(phone, "session_confirmation", content);
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    handleError(err, "Erro ao enviar confirmação de sessão via WhatsApp.");
  }

  await logMessage({
    clinicId,
    patientId: patient?.id,
    appointmentId,
    messageType: "session_confirmation",
    status,
    content,
    phoneNumber: phone,
    errorMessage,
  });
}

/**
 * Sends monthly-reminder WhatsApp messages to patients with pending
 * mensalidades for the given clinic.
 *
 * Respects `monthly_reminder_patient_ids` filter and `monthly_reminder_enabled` toggle.
 */
export async function sendMonthlyReminder(clinicId: string): Promise<void> {
  const settings = await getAutomationSettings(clinicId);
  if (!settings?.monthly_reminder_enabled) {
    console.info("[WhatsApp] Lembrete de mensalidade desabilitado para esta clínica.");
    return;
  }

  // Build query for pending mensalidades
  const daysBeforeCutoff = settings.monthly_reminder_days_before ?? 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysBeforeCutoff);
  const cutoffIso = cutoffDate.toISOString().split("T")[0];

  let query = (supabase
    .from("pagamentos_mensalidade")
    .select(`
      id,
      paciente_id,
      valor,
      data_vencimento,
      pacientes (id, nome, telefone, whatsapp)
    `)
    .eq("clinic_id", clinicId)
    .eq("status", "pendente")
    .lte("data_vencimento", cutoffIso) as any);

  if (settings.monthly_reminder_patient_ids && settings.monthly_reminder_patient_ids.length > 0) {
    query = query.in("paciente_id", settings.monthly_reminder_patient_ids);
  }

  const { data: rows, error } = await query;
  if (error) {
    handleError(error, "Erro ao buscar mensalidades para lembrete.");
    return;
  }

  const service = await buildServiceForClinic(clinicId).catch((err) => {
    handleError(err);
    return null;
  });
  if (!service) return;

  for (const row of rows as any[]) {
    const patient = row.pacientes as {
      id: string;
      nome: string;
      telefone: string | null;
      whatsapp: string | null;
    } | null;

    const phone = patient?.whatsapp ?? patient?.telefone ?? null;
    if (!phone) continue;

    const reminderData: MonthlyReminderData = {
      patientName: patient?.nome ?? "Paciente",
      patientPhone: phone,
      amount: row.valor,
      dueDate: row.data_vencimento
        ? new Date(row.data_vencimento).toLocaleDateString("pt-BR")
        : "—",
    };

    const content = buildMonthlyReminderMessage(reminderData, settings.monthly_reminder_message);

    let status: MessageStatus = "sent";
    let errorMessage: string | null = null;

    try {
      await service.sendMessage(phone, "monthly_reminder", content);
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await logMessage({
      clinicId,
      patientId: patient?.id,
      messageType: "monthly_reminder",
      status,
      content,
      phoneNumber: phone,
      errorMessage,
    });
  }
}

/**
 * Sends overdue-payment alert WhatsApp messages for the given clinic.
 *
 * Respects `overdue_alert_patient_ids` filter, `overdue_alert_days` threshold,
 * `overdue_alert_include_pix`, and `overdue_alert_enabled` toggle.
 */
export async function sendOverdueAlert(clinicId: string): Promise<void> {
  const settings = await getAutomationSettings(clinicId);
  if (!settings?.overdue_alert_enabled) {
    console.info("[WhatsApp] Alerta de inadimplência desabilitado para esta clínica.");
    return;
  }

  const minOverdueDays = settings.overdue_alert_days ?? 1;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minOverdueDays);
  const cutoffIso = cutoffDate.toISOString().split("T")[0];

  let query = (supabase
    .from("pagamentos_mensalidade")
    .select(`
      id,
      paciente_id,
      valor,
      data_vencimento,
      pacientes (id, nome, telefone, whatsapp)
    `)
    .eq("clinic_id", clinicId)
    .eq("status", "pendente")
    .lte("data_vencimento", cutoffIso) as any);

  if (settings.overdue_alert_patient_ids && settings.overdue_alert_patient_ids.length > 0) {
    query = query.in("paciente_id", settings.overdue_alert_patient_ids);
  }

  const { data: rows, error } = await query;
  if (error) {
    handleError(error, "Erro ao buscar inadimplentes para alerta.");
    return;
  }

  // Optionally load PIX config (first available for the clinic)
  let pixKey: string | null = null;
  let pixKeyType: string | null = null;
  let beneficiaryName: string | null = null;

  if (settings.overdue_alert_include_pix) {
    const { data: pixRows } = await (supabase
      .from("config_pix")
      .select("chave_pix, tipo_chave, nome_beneficiario, formas_pagamento!inner(ativo)")
      .eq("formas_pagamento.ativo", true)
      .limit(1) as any);

    const firstPix = (pixRows as any[])?.[0];
    if (firstPix) {
      pixKey = firstPix.chave_pix ?? null;
      pixKeyType = firstPix.tipo_chave ?? null;
      beneficiaryName = firstPix.nome_beneficiario ?? null;
    }
  }

  const service = await buildServiceForClinic(clinicId).catch((err) => {
    handleError(err);
    return null;
  });
  if (!service) return;

  const MS_PER_DAY = 86400000;
  const today = new Date();

  for (const row of rows as any[]) {
    const patient = row.pacientes as {
      id: string;
      nome: string;
      telefone: string | null;
      whatsapp: string | null;
    } | null;

    const phone = patient?.whatsapp ?? patient?.telefone ?? null;
    if (!phone) continue;

    const dueDate = row.data_vencimento ? new Date(row.data_vencimento) : null;
    const daysOverdue = dueDate
      ? Math.floor((today.getTime() - dueDate.getTime()) / MS_PER_DAY)
      : minOverdueDays;

    const alertData: OverdueAlertData = {
      patientName: patient?.nome ?? "Paciente",
      patientPhone: phone,
      amount: row.valor,
      daysOverdue: Math.max(daysOverdue, minOverdueDays),
      pixKey,
      pixKeyType,
      beneficiaryName,
    };

    const content = buildOverdueAlertMessage(alertData, settings.overdue_alert_message);

    let status: MessageStatus = "sent";
    let errorMessage: string | null = null;

    try {
      await service.sendMessage(phone, "overdue_alert", content);
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await logMessage({
      clinicId,
      patientId: patient?.id,
      messageType: "overdue_alert",
      status,
      content,
      phoneNumber: phone,
      errorMessage,
    });
  }
}
