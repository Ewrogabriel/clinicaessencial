// ============================================================
// Session Confirmation – Canonical Message Template
//
// Single source of truth for the session-confirmation message
// used across ALL channels:
//   - ConfirmacoesDia.tsx    (manual WhatsApp dispatch via wa.me)
//   - whatsappAutomationService.ts  (automated 48h dispatch)
//   - SessionConfirmationSettings.tsx  (admin panel preview)
//   - whatsapp-automation Edge Function  (Supabase cron)
//
// Placeholders use single-brace syntax: {variable}
// ============================================================

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * The canonical session-confirmation message template.
 *
 * Available placeholders:
 *  {paciente}      – patient's full name
 *  {tipo}          – appointment type (e.g. "sessão", "consulta")
 *  {dia_semana}    – day of the week in Portuguese (capitalised)
 *  {data}          – date formatted as dd/MM/yyyy
 *  {hora}          – time formatted as HH:mm
 *  {profissional}  – professional's full name
 *  {link}          – full confirmation URL
 */
export const CONFIRMATION_TEMPLATE =
  "Olá {paciente}! 👋\n\n" +
  "Lembramos que você tem uma {tipo} agendada:\n" +
  "📅 *{dia_semana}, {data}* às *{hora}*\n" +
  "👤 Profissional: *{profissional}*\n\n" +
  "Por favor, confirme sua presença clicando no link abaixo:\n" +
  "🔗 {link}\n\n" +
  "Aguardamos você! 😊";

/** All placeholders accepted by the confirmation template. */
export const CONFIRMATION_VARIABLES = [
  "{paciente}",
  "{tipo}",
  "{dia_semana}",
  "{data}",
  "{hora}",
  "{profissional}",
  "{link}",
] as const;

// ── Parameter shape ──────────────────────────────────────────

export interface ConfirmationMessageParams {
  /** Patient's full name. */
  pacienteNome: string;
  /** Professional's full name. */
  profissionalNome: string;
  /** Appointment type (e.g. "sessão", "consulta"). */
  tipo: string;
  /** ISO 8601 date-time string of the appointment. */
  dataHorario: string;
  /** Full confirmation URL (e.g. https://app.example.com/confirmar-agendamento/uuid). */
  confirmationLink: string;
}

// ── Interpolation helper ─────────────────────────────────────

/**
 * Replaces `{variableName}` placeholders in a template string
 * with the corresponding value from `variables`.
 * Unknown placeholders are left as-is.
 */
function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => variables[key] ?? `{${key}}`);
}

// ── Public builder ────────────────────────────────────────────

/**
 * Builds the session-confirmation message text.
 *
 * @param params          - Appointment and participant data.
 * @param customTemplate  - Optional template override (must use the same {variable} syntax).
 *                          Falls back to `CONFIRMATION_TEMPLATE` when absent / null / empty.
 * @returns               Ready-to-send plain-text message (WhatsApp, SMS, or Email).
 */
export function buildConfirmationMessage(
  params: ConfirmationMessageParams,
  customTemplate?: string | null
): string {
  const date = parseISO(params.dataHorario);
  const diaSemana = format(date, "EEEE", { locale: ptBR });
  const diaSemanaCapitalized = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  return interpolate(customTemplate || CONFIRMATION_TEMPLATE, {
    paciente: params.pacienteNome,
    tipo: params.tipo,
    dia_semana: diaSemanaCapitalized,
    data: format(date, "dd/MM/yyyy", { locale: ptBR }),
    hora: format(date, "HH:mm"),
    profissional: params.profissionalNome,
    link: params.confirmationLink,
  });
}
