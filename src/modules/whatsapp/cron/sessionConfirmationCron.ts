// ============================================================
// WhatsApp Automation – Session Confirmation Cron
//
// Intended execution frequency: every 1 hour.
//
// Responsibilities:
//  1. Find appointments falling inside the "confirmation window"
//     (configurable hours_before per clinic).
//  2. Skip appointments that already have a sent/delivered/read
//     log entry (de-duplication).
//  3. Trigger AutomationEngine.processSessionConfirmations().
//  4. Log execution summary to the console.
//
// This module exports a single `runSessionConfirmationCron`
// function that can be called by CronScheduler or the
// whatsapp-automation Edge Function.
// ============================================================

import { automationEngine } from "@/lib/whatsapp/automationEngine";

/**
 * Processes pending session-confirmation messages for all
 * clinics that have the automation enabled.
 *
 * Returns the number of messages successfully dispatched.
 */
export async function runSessionConfirmationCron(): Promise<number> {
  console.info("[SessionConfirmationCron] Iniciando processamento de confirmações de sessão…");

  const start = Date.now();

  let sent = 0;
  try {
    sent = await automationEngine.processSessionConfirmations();
  } catch (err) {
    console.error("[SessionConfirmationCron] Erro inesperado:", err);
  }

  const elapsed = Date.now() - start;
  console.info(
    `[SessionConfirmationCron] Concluído em ${elapsed}ms — ${sent} mensagem(ns) enviada(s).`
  );

  return sent;
}
