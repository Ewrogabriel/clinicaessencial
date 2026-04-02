// ============================================================
// WhatsApp Business Integration – Message Templates
// Provides default templates and an interpolation helper for
// each automation message type.
// ============================================================

import type {
  MessageType,
  SessionConfirmationData,
  MonthlyReminderData,
  OverdueAlertData,
} from "@/modules/whatsapp/types";

// ── Interpolation helper ─────────────────────────────────────

/**
 * Replaces `{{variableName}}` placeholders in a template string
 * with the corresponding value from `variables`.
 * Unknown placeholders are left as-is.
 */
export function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);
}

// ── Default templates ────────────────────────────────────────

const DEFAULT_SESSION_CONFIRMATION =
  "Olá, {{patientName}}! 😊\n\n" +
  "Lembramos que você tem uma sessão agendada com *{{professionalName}}* " +
  "em *{{sessionDate}}* às *{{sessionTime}}*.\n\n" +
  "Por favor, confirme sua presença clicando no link abaixo:\n" +
  "{{confirmationLink}}\n\n" +
  "Em caso de impossibilidade, entre em contato com antecedência. Obrigado!";

const DEFAULT_MONTHLY_REMINDER =
  "Olá, {{patientName}}! 👋\n\n" +
  "Passamos para lembrar que sua mensalidade no valor de *R$ {{amount}}* " +
  "vence em *{{dueDate}}*.\n\n" +
  "Qualquer dúvida estamos à disposição. 😊";

const DEFAULT_OVERDUE_ALERT =
  "Olá, {{patientName}}! ⚠️\n\n" +
  "Identificamos que sua mensalidade de *R$ {{amount}}* está em atraso há *{{daysOverdue}} dia(s)*.\n\n" +
  "Por favor, regularize sua situação o quanto antes para não interromper seus atendimentos.\n\n" +
  "{{pixInfo}}" +
  "Em caso de dúvidas, entre em contato conosco. Obrigado!";

// ── Builder functions ────────────────────────────────────────

export function buildSessionConfirmationMessage(
  data: SessionConfirmationData,
  customTemplate?: string | null
): string {
  const template = customTemplate || DEFAULT_SESSION_CONFIRMATION;
  return interpolate(template, {
    patientName: data.patientName,
    professionalName: data.professionalName,
    sessionDate: data.sessionDate,
    sessionTime: data.sessionTime,
    confirmationLink: data.confirmationLink,
  });
}

export function buildMonthlyReminderMessage(
  data: MonthlyReminderData,
  customTemplate?: string | null
): string {
  const template = customTemplate || DEFAULT_MONTHLY_REMINDER;
  return interpolate(template, {
    patientName: data.patientName,
    amount: data.amount.toFixed(2).replace(".", ","),
    dueDate: data.dueDate,
  });
}

export function buildOverdueAlertMessage(
  data: OverdueAlertData,
  customTemplate?: string | null
): string {
  const template = customTemplate || DEFAULT_OVERDUE_ALERT;

  let pixInfo = "";
  if (data.pixKey) {
    pixInfo =
      `*Chave PIX (${data.pixKeyType ?? "chave"}):* ${data.pixKey}\n` +
      (data.beneficiaryName ? `*Beneficiário:* ${data.beneficiaryName}\n` : "") +
      "\n";
  }

  return interpolate(template, {
    patientName: data.patientName,
    amount: data.amount.toFixed(2).replace(".", ","),
    daysOverdue: String(data.daysOverdue),
    pixInfo,
  });
}

// ── Template registry (for dynamic dispatch) ─────────────────

export type TemplateBuilderMap = {
  session_confirmation: (data: SessionConfirmationData, custom?: string | null) => string;
  monthly_reminder: (data: MonthlyReminderData, custom?: string | null) => string;
  overdue_alert: (data: OverdueAlertData, custom?: string | null) => string;
};

export const templateBuilders: TemplateBuilderMap = {
  session_confirmation: buildSessionConfirmationMessage,
  monthly_reminder: buildMonthlyReminderMessage,
  overdue_alert: buildOverdueAlertMessage,
};

/** Returns the default (untranslated) template string for a given message type. */
export function getDefaultTemplate(messageType: MessageType): string {
  switch (messageType) {
    case "session_confirmation":
      return DEFAULT_SESSION_CONFIRMATION;
    case "monthly_reminder":
      return DEFAULT_MONTHLY_REMINDER;
    case "overdue_alert":
      return DEFAULT_OVERDUE_ALERT;
  }
}
