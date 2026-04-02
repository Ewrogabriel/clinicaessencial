// ============================================================
// WhatsApp Automation – Overdue Alert Cron
//
// Intended execution frequency: every 2 hours.
//
// Responsibilities:
//  1. Find pagamentos with status = 'vencido' that exceeded the
//     configured overdue threshold (overdue_alert_days per clinic).
//  2. Filter patients according to overdue_alert_patient_ids
//     (null = all patients).
//  3. Optionally attach PIX data when overdue_alert_include_pix = true.
//  4. Trigger AutomationEngine.processOverdueAlerts().
//  5. Log execution summary to the console.
//
// This module exports a single `runOverdueAlertCron` function
// that can be called by CronScheduler or the whatsapp-automation
// Edge Function.
// ============================================================

import { automationEngine } from "@/lib/whatsapp/automationEngine";

/**
 * Processes pending overdue-payment alert messages for all
 * clinics that have the automation enabled.
 *
 * Returns the number of clinics for which the alert run was
 * dispatched successfully.
 */
export async function runOverdueAlertCron(): Promise<number> {
  console.info("[OverdueAlertCron] Iniciando processamento de alertas de inadimplência…");

  const start = Date.now();

  let processed = 0;
  try {
    processed = await automationEngine.processOverdueAlerts();
  } catch (err) {
    console.error("[OverdueAlertCron] Erro inesperado:", err);
  }

  const elapsed = Date.now() - start;
  console.info(
    `[OverdueAlertCron] Concluído em ${elapsed}ms — ${processed} clínica(s) processada(s).`
  );

  return processed;
}
