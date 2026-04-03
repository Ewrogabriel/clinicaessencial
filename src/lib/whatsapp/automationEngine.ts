// ============================================================
// WhatsApp Business Integration – Automation Engine
// Orchestrates the three automated WhatsApp flows:
//   - Session confirmation (sent N hours before appointment)
//   - Monthly payment reminder (sent N days before due date)
//   - Overdue payment alert (sent N days after due date)
//
// All actions are logged to whatsapp_message_logs.
// Failed sends are retried up to MAX_RETRIES times with
// exponential back-off before being recorded as 'failed'.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import {
  sendSessionConfirmation,
  sendMonthlyReminder,
  sendOverdueAlert,
} from "@/modules/whatsapp/services/whatsappAutomationService";
import { getAutomationSettings } from "@/modules/whatsapp/services/whatsappConfigService";

// ── Constants ────────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;
/** Milliseconds in one hour. */
const MS_PER_HOUR = 3_600_000;

// ── Helpers ──────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes `fn` with exponential back-off retry.
 * On every attempt failure, waits `delayMs * attempt` before retrying.
 * Returns `true` on success, `false` when all retries are exhausted.
 */
async function withRetry(
  fn: () => Promise<void>,
  retries = MAX_RETRIES,
  delayMs = INITIAL_RETRY_DELAY_MS
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fn();
      return true;
    } catch (err) {
      if (attempt === retries) {
        handleError(err, `[AutomationEngine] Falha após ${retries} tentativas.`);
        return false;
      }
      await delay(delayMs * attempt);
    }
  }
  return false;
}

// ── AutomationEngine ─────────────────────────────────────────

export class AutomationEngine {
  /**
   * Schedules a session confirmation for the given appointment.
   *
   * This immediately logs the intent in `whatsapp_message_logs`
   * (status = 'sent') so duplicate-prevention works correctly.
   * The actual send is delegated to sendSessionConfirmation which
   * also writes the final status.
   */
  async scheduleSessionConfirmation(appointmentId: string): Promise<void> {
    await withRetry(() => sendSessionConfirmation(appointmentId));
  }

  /**
   * Processes ALL appointments that are due for a session confirmation
   * message across ALL clinics that have the automation enabled.
   *
   * - Fetches active clinics with session_confirmation_enabled = true.
   * - For each clinic, finds appointments in the confirmation window that
   *   have NOT yet received a confirmation (no matching log entry).
   * - Sends and logs each confirmation with retry.
   */
  async processSessionConfirmations(): Promise<number> {
    let sent = 0;

    const { data: clinics, error: clinicsError } = await (supabase as any)
      .from("whatsapp_automation_settings")
      .select("clinic_id, session_confirmation_enabled, session_confirmation_hours_before")
      .eq("session_confirmation_enabled", true);

    if (clinicsError || !clinics) {
      handleError(clinicsError, "[AutomationEngine] Erro ao buscar clínicas para confirmação de sessão.");
      return 0;
    }

    for (const setting of clinics as Array<{
      clinic_id: string;
      session_confirmation_hours_before: number;
    }>) {
      const hoursBefore = setting.session_confirmation_hours_before ?? 48;
      const now = new Date();
      const windowStart = new Date(now.getTime() + hoursBefore * MS_PER_HOUR);
      const windowEnd = new Date(windowStart.getTime() + MS_PER_HOUR); // 1-hour window

      // Find appointments in the notification window
      const { data: appointments, error: agError } = await (supabase
        .from("agendamentos")
        .select("id")
        .eq("clinic_id", setting.clinic_id)
        .in("status", ["agendado", "confirmado"])
        .gte("data_horario", windowStart.toISOString())
        .lte("data_horario", windowEnd.toISOString()) as any);

      if (agError || !appointments) continue;

      for (const ag of appointments as Array<{ id: string }>) {
        // De-duplicate: skip if a confirmation was already sent
        const { data: existingLog } = await (supabase as any)
          .from("whatsapp_message_logs")
          .select("id")
          .eq("appointment_id", ag.id)
          .eq("message_type", "session_confirmation")
          .in("status", ["sent", "delivered", "read"])
          .maybeSingle();

        if (existingLog) continue;

        const ok = await withRetry(() => sendSessionConfirmation(ag.id));
        if (ok) sent++;
      }
    }

    console.info(`[AutomationEngine] Confirmações de sessão processadas: ${sent}`);
    return sent;
  }

  /**
   * Processes ALL clinics with monthly_reminder_enabled = true and
   * delegates to sendMonthlyReminder for each.
   */
  async processMonthlyReminders(): Promise<number> {
    let processed = 0;

    const { data: clinics, error } = await (supabase as any)
      .from("whatsapp_automation_settings")
      .select("clinic_id")
      .eq("monthly_reminder_enabled", true);

    if (error || !clinics) {
      handleError(error, "[AutomationEngine] Erro ao buscar clínicas para lembrete de mensalidade.");
      return 0;
    }

    for (const { clinic_id } of clinics as Array<{ clinic_id: string }>) {
      const ok = await withRetry(() => sendMonthlyReminder(clinic_id));
      if (ok) processed++;
    }

    console.info(`[AutomationEngine] Lembretes de mensalidade processados: ${processed}`);
    return processed;
  }

  /**
   * Processes ALL clinics with overdue_alert_enabled = true and
   * delegates to sendOverdueAlert for each.
   */
  async processOverdueAlerts(): Promise<number> {
    let processed = 0;

    const { data: clinics, error } = await (supabase as any)
      .from("whatsapp_automation_settings")
      .select("clinic_id")
      .eq("overdue_alert_enabled", true);

    if (error || !clinics) {
      handleError(error, "[AutomationEngine] Erro ao buscar clínicas para alerta de inadimplência.");
      return 0;
    }

    for (const { clinic_id } of clinics as Array<{ clinic_id: string }>) {
      const ok = await withRetry(() => sendOverdueAlert(clinic_id));
      if (ok) processed++;
    }

    console.info(`[AutomationEngine] Alertas de inadimplência processados: ${processed}`);
    return processed;
  }

  /**
   * Convenience helper: fetches automation settings for a clinic and
   * returns them (or null).  Useful for callers that need to inspect
   * settings before triggering an automation.
   */
  async getSettings(clinicId: string) {
    return getAutomationSettings(clinicId);
  }
}

/** Singleton instance exported for direct use in cron scripts. */
export const automationEngine = new AutomationEngine();
