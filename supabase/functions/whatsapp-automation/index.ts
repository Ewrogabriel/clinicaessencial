// ============================================================
// Supabase Edge Function – whatsapp-automation
//
// Endpoint: POST /functions/v1/whatsapp-automation
//
// Request body (JSON):
//   {
//     "task": "session" | "monthly" | "overdue",
//     "clinic_id"?: string   // optional: restrict to a single clinic
//   }
//
// Security: requires the Authorization header to carry a valid
//   AUTOMATION_SECRET token (set in Supabase Function secrets as
//   AUTOMATION_SECRET).  Requests without a matching token are
//   rejected with 401.
//
// Response (JSON):
//   { "success": true, "task": "session", "count": 3 }
//   { "success": false, "error": "..." }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS headers ─────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-automation-token",
};

// ── Types ────────────────────────────────────────────────────

type Task = "session" | "monthly" | "overdue";

interface RequestBody {
  task: Task;
  clinic_id?: string;
}

// ── Helpers ──────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await delay(delayMs * attempt);
    }
  }
  // This point is never reached; the loop always throws or returns.
  /* istanbul ignore next */
  throw new Error("Máximo de tentativas atingido.");
}

// ── Automation runners ───────────────────────────────────────

/**
 * Fetches all clinic IDs that have the given setting enabled.
 */
async function getEnabledClinics(
  supabase: ReturnType<typeof createClient>,
  settingColumn: string,
  singleClinicId?: string
): Promise<string[]> {
  let query = (supabase as any)
    .from("whatsapp_automation_settings")
    .select("clinic_id")
    .eq(settingColumn, true);

  if (singleClinicId) {
    query = query.eq("clinic_id", singleClinicId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Array<{ clinic_id: string }>).map((r) => r.clinic_id);
}

/**
 * Logs a message entry in whatsapp_message_logs.
 * Errors are swallowed to avoid blocking the main flow.
 */
async function logMessage(
  supabase: ReturnType<typeof createClient>,
  params: {
    clinicId: string;
    patientId?: string | null;
    appointmentId?: string | null;
    messageType: string;
    status: string;
    content: string;
    phoneNumber: string;
    errorMessage?: string | null;
  }
): Promise<void> {
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
  } catch (_) {
    // logging failures must not block the main flow
  }
}

/** Interpolates {{key}} placeholders in a template string. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Normalises a phone number to E.164 format (adds "+" when missing). */
function normalisePhone(phone: string): string {
  const cleaned = phone.replace(/[\s().−-]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

// ── Session confirmation ──────────────────────────────────────

async function processSessionConfirmations(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  settings: Record<string, unknown>
): Promise<number> {
  const hoursBefore = (settings.session_confirmation_hours_before as number) ?? 48;
  const now = new Date();
  const windowStart = new Date(now.getTime() + hoursBefore * 3_600_000);
  const windowEnd = new Date(windowStart.getTime() + 3_600_000);

  const { data: appointments } = await (supabase as any)
    .from("agendamentos")
    .select("id, data_horario, paciente_id, profissional_id")
    .eq("clinic_id", clinicId)
    .in("status", ["agendado", "confirmado"])
    .gte("data_horario", windowStart.toISOString())
    .lte("data_horario", windowEnd.toISOString());

  if (!appointments?.length) return 0;

  // Load WhatsApp config
  const { data: waCfg } = await (supabase as any)
    .from("whatsapp_config")
    .select("api_token, phone_number_id, is_active")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!waCfg?.is_active || !waCfg.api_token || !waCfg.phone_number_id) return 0;

  const appUrl = Deno.env.get("APP_URL") ?? "";
  let sent = 0;

  for (const ag of appointments as Array<{ id: string; data_horario: string; paciente_id: string; profissional_id: string }>) {
    // De-duplicate
    const { data: existingLog } = await (supabase as any)
      .from("whatsapp_message_logs")
      .select("id")
      .eq("appointment_id", ag.id)
      .eq("message_type", "session_confirmation")
      .in("status", ["sent", "delivered", "read"])
      .maybeSingle();

    if (existingLog) continue;

    const { data: patient } = await (supabase as any)
      .from("pacientes")
      .select("id, nome, telefone, whatsapp")
      .eq("id", ag.paciente_id)
      .maybeSingle();

    const phone: string | null = patient?.whatsapp ?? patient?.telefone ?? null;
    if (!phone) continue;

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("nome")
      .eq("user_id", ag.profissional_id)
      .maybeSingle();

    const professionalName: string = profile?.nome ?? "seu profissional";

    const sessionDate = new Date(ag.data_horario).toLocaleDateString("pt-BR");
    const sessionTime = new Date(ag.data_horario).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const confirmationLink = `${appUrl}/confirmar-agendamento/${ag.id}`;

    const defaultTemplate =
      "Olá, {{patientName}}! 😊\n\n" +
      "Lembramos que você tem uma sessão agendada com *{{professionalName}}* " +
      "em *{{sessionDate}}* às *{{sessionTime}}*.\n\n" +
      "Por favor, confirme sua presença clicando no link abaixo:\n" +
      "{{confirmationLink}}\n\n" +
      "Em caso de impossibilidade, entre em contato com antecedência. Obrigado!";

    const content = interpolate(
      (settings.session_confirmation_message as string) || defaultTemplate,
      {
        patientName: patient?.nome ?? "Paciente",
        professionalName,
        sessionDate,
        sessionTime,
        confirmationLink,
      }
    );

    let status = "sent";
    let errorMessage: string | null = null;

    try {
      await withRetry(async () => {
        const resp = await fetch(
          `https://graph.facebook.com/v19.0/${waCfg.phone_number_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waCfg.api_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: normalisePhone(phone),
              type: "text",
              text: { preview_url: false, body: content },
            }),
          }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error((err as any)?.error?.message ?? `HTTP ${resp.status}`);
        }
      });
      sent++;
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[whatsapp-automation] session send error:", errorMessage);
    }

    await logMessage(supabase, {
      clinicId,
      patientId: patient?.id ?? null,
      appointmentId: ag.id,
      messageType: "session_confirmation",
      status,
      content,
      phoneNumber: phone,
      errorMessage,
    });
  }

  return sent;
}

// ── Monthly reminder ─────────────────────────────────────────

async function processMonthlyReminders(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  settings: Record<string, unknown>
): Promise<number> {
  const daysBeforeCutoff = (settings.monthly_reminder_days_before as number) ?? 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysBeforeCutoff);
  const cutoffIso = cutoffDate.toISOString().split("T")[0];

  let query = (supabase as any)
    .from("pagamentos_mensalidade")
    .select("id, paciente_id, valor, data_vencimento, pacientes(id, nome, telefone, whatsapp)")
    .eq("clinic_id", clinicId)
    .in("status", ["pendente", "vencido"])
    .lte("data_vencimento", cutoffIso);

  const patientFilter = settings.monthly_reminder_patient_ids as string[] | null;
  if (patientFilter && patientFilter.length > 0) {
    query = query.in("paciente_id", patientFilter);
  }

  const { data: rows, error } = await query;
  if (error || !rows?.length) return 0;

  const { data: waCfg } = await (supabase as any)
    .from("whatsapp_config")
    .select("api_token, phone_number_id, is_active")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!waCfg?.is_active || !waCfg.api_token || !waCfg.phone_number_id) return 0;

  const defaultTemplate =
    "Olá, {{patientName}}! 👋\n\n" +
    "Passamos para lembrar que sua mensalidade no valor de *R$ {{amount}}* " +
    "vence em *{{dueDate}}*.\n\n" +
    "Qualquer dúvida estamos à disposição. 😊";

  let sent = 0;

  for (const row of rows as Array<{ id: string; paciente_id: string; valor: number; data_vencimento: string; pacientes: { id: string; nome: string; telefone: string | null; whatsapp: string | null } | null }>) {
    const patient = row.pacientes;
    const phone = patient?.whatsapp ?? patient?.telefone ?? null;
    if (!phone) continue;

    const content = interpolate(
      (settings.monthly_reminder_message as string) || defaultTemplate,
      {
        patientName: patient?.nome ?? "Paciente",
        amount: row.valor.toFixed(2).replace(".", ","),
        dueDate: row.data_vencimento
          ? new Date(row.data_vencimento).toLocaleDateString("pt-BR")
          : "—",
      }
    );

    let status = "sent";
    let errorMessage: string | null = null;

    try {
      await withRetry(async () => {
        const resp = await fetch(
          `https://graph.facebook.com/v19.0/${waCfg.phone_number_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waCfg.api_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: normalisePhone(phone),
              type: "text",
              text: { preview_url: false, body: content },
            }),
          }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error((err as any)?.error?.message ?? `HTTP ${resp.status}`);
        }
      });
      sent++;
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[whatsapp-automation] monthly send error:", errorMessage);
    }

    await logMessage(supabase, {
      clinicId,
      patientId: patient?.id ?? null,
      messageType: "monthly_reminder",
      status,
      content,
      phoneNumber: phone,
      errorMessage,
    });
  }

  return sent;
}

// ── Overdue alert ─────────────────────────────────────────────

async function processOverdueAlerts(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  settings: Record<string, unknown>
): Promise<number> {
  const minOverdueDays = (settings.overdue_alert_days as number) ?? 1;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minOverdueDays);
  const cutoffIso = cutoffDate.toISOString().split("T")[0];

  let query = (supabase as any)
    .from("pagamentos_mensalidade")
    .select("id, paciente_id, valor, data_vencimento, pacientes(id, nome, telefone, whatsapp)")
    .eq("clinic_id", clinicId)
    .eq("status", "vencido")
    .lte("data_vencimento", cutoffIso);

  const patientFilter = settings.overdue_alert_patient_ids as string[] | null;
  if (patientFilter && patientFilter.length > 0) {
    query = query.in("paciente_id", patientFilter);
  }

  const { data: rows, error } = await query;
  if (error || !rows?.length) return 0;

  const { data: waCfg } = await (supabase as any)
    .from("whatsapp_config")
    .select("api_token, phone_number_id, is_active")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!waCfg?.is_active || !waCfg.api_token || !waCfg.phone_number_id) return 0;

  // Load PIX config when enabled
  let pixKey: string | null = null;
  let pixKeyType: string | null = null;
  let beneficiaryName: string | null = null;

  if (settings.overdue_alert_include_pix) {
    const { data: pixRows } = await (supabase as any)
      .from("config_pix")
      .select("chave_pix, tipo_chave, nome_beneficiario, formas_pagamento!inner(ativo)")
      .eq("formas_pagamento.ativo", true)
      .limit(1);

    const firstPix = (pixRows as any[])?.[0];
    if (firstPix) {
      pixKey = firstPix.chave_pix ?? null;
      pixKeyType = firstPix.tipo_chave ?? null;
      beneficiaryName = firstPix.nome_beneficiario ?? null;
    }
  }

  const defaultTemplate =
    "Olá, {{patientName}}! ⚠️\n\n" +
    "Identificamos que sua mensalidade de *R$ {{amount}}* está em atraso há *{{daysOverdue}} dia(s)*.\n\n" +
    "Por favor, regularize sua situação o quanto antes para não interromper seus atendimentos.\n\n" +
    "{{pixInfo}}" +
    "Em caso de dúvidas, entre em contato conosco. Obrigado!";

  const MS_PER_DAY = 86_400_000;
  const today = new Date();
  let sent = 0;

  for (const row of rows as Array<{ id: string; paciente_id: string; valor: number; data_vencimento: string; pacientes: { id: string; nome: string; telefone: string | null; whatsapp: string | null } | null }>) {
    const patient = row.pacientes;
    const phone = patient?.whatsapp ?? patient?.telefone ?? null;
    if (!phone) continue;

    const dueDate = row.data_vencimento ? new Date(row.data_vencimento) : null;
    const daysOverdue = dueDate
      ? Math.floor((today.getTime() - dueDate.getTime()) / MS_PER_DAY)
      : minOverdueDays;

    let pixInfo = "";
    if (pixKey) {
      pixInfo =
        `*Chave PIX (${pixKeyType ?? "chave"}):* ${pixKey}\n` +
        (beneficiaryName ? `*Beneficiário:* ${beneficiaryName}\n` : "") +
        "\n";
    }

    const content = interpolate(
      (settings.overdue_alert_message as string) || defaultTemplate,
      {
        patientName: patient?.nome ?? "Paciente",
        amount: row.valor.toFixed(2).replace(".", ","),
        daysOverdue: String(daysOverdue),
        pixInfo,
      }
    );

    let status = "sent";
    let errorMessage: string | null = null;

    try {
      await withRetry(async () => {
        const resp = await fetch(
          `https://graph.facebook.com/v19.0/${waCfg.phone_number_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waCfg.api_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: normalisePhone(phone),
              type: "text",
              text: { preview_url: false, body: content },
            }),
          }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error((err as any)?.error?.message ?? `HTTP ${resp.status}`);
        }
      });
      sent++;
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[whatsapp-automation] overdue send error:", errorMessage);
    }

    await logMessage(supabase, {
      clinicId,
      patientId: patient?.id ?? null,
      messageType: "overdue_alert",
      status,
      content,
      phoneNumber: phone,
      errorMessage,
    });
  }

  return sent;
}

// ── Edge Function entry point ─────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Security: validate automation token ──────────────────
  const automationSecret = Deno.env.get("AUTOMATION_SECRET");
  if (automationSecret) {
    const authHeader = req.headers.get("authorization") ?? "";
    const providedToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.headers.get("x-automation-token") ?? "";

    if (providedToken !== automationSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  // ── Parse request body ────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { task, clinic_id } = body;

  if (!task || !["session", "monthly", "overdue"].includes(task)) {
    return jsonResponse(
      { error: "task must be one of: session, monthly, overdue" },
      400
    );
  }

  // ── Build Supabase service-role client ────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Determine which clinics to process ────────────────────
  const settingColumnMap: Record<Task, string> = {
    session: "session_confirmation_enabled",
    monthly: "monthly_reminder_enabled",
    overdue: "overdue_alert_enabled",
  };

  const clinicIds = await getEnabledClinics(
    supabase,
    settingColumnMap[task],
    clinic_id
  );

  if (clinicIds.length === 0) {
    return jsonResponse({ success: true, task, count: 0, message: "Nenhuma clínica habilitada." });
  }

  // ── Execute the requested task ────────────────────────────
  let totalCount = 0;

  try {
    for (const cid of clinicIds) {
      // Load full settings row
      const { data: settings } = await (supabase as any)
        .from("whatsapp_automation_settings")
        .select("*")
        .eq("clinic_id", cid)
        .maybeSingle();

      if (!settings) continue;

      let count = 0;
      if (task === "session") {
        count = await processSessionConfirmations(supabase, cid, settings);
      } else if (task === "monthly") {
        count = await processMonthlyReminders(supabase, cid, settings);
      } else if (task === "overdue") {
        count = await processOverdueAlerts(supabase, cid, settings);
      }

      totalCount += count;
    }
  } catch (err) {
    console.error("[whatsapp-automation] Fatal error:", err);
    return jsonResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido.",
      },
      500
    );
  }

  console.info(`[whatsapp-automation] task=${task} count=${totalCount}`);
  return jsonResponse({ success: true, task, count: totalCount });
});
