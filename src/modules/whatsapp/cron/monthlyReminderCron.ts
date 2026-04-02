// ============================================================
// WhatsApp Automation – Monthly Reminder Cron
//
// Intended execution frequency: daily at midnight.
//
// Responsibilities:
//  1. Find mensalidades vencendo nos próximos N dias
//     (N is configurable per clinic via monthly_reminder_days_before).
//  2. Filter patients according to monthly_reminder_patient_ids
//     (null = all patients).
//  3. Skip patients that already received a reminder today
//     (de-duplication via whatsapp_message_logs).
//  4. Trigger AutomationEngine.processMonthlyReminders().
//  5. Log execution summary to the console.
//
// This module exports a single `runMonthlyReminderCron` function
// that can be called by CronScheduler or the whatsapp-automation
// Edge Function.
// ============================================================

import { automationEngine } from "@/lib/whatsapp/automationEngine";

/**
 * Processes pending monthly-reminder messages for all clinics
 * that have the automation enabled.
 *
 * Returns the number of clinics for which the reminder run
 * was dispatched successfully.
 */
export async function runMonthlyReminderCron(): Promise<number> {
  console.info("[MonthlyReminderCron] Iniciando processamento de lembretes de mensalidade…");

  const start = Date.now();

  let processed = 0;
  try {
    processed = await automationEngine.processMonthlyReminders();
  } catch (err) {
    console.error("[MonthlyReminderCron] Erro inesperado:", err);
  }

  const elapsed = Date.now() - start;
  console.info(
    `[MonthlyReminderCron] Concluído em ${elapsed}ms — ${processed} clínica(s) processada(s).`
  );

  return processed;
}
