// ============================================================
// WhatsApp Logs Service
// Manages querying, filtering, and stats for whatsapp_message_logs.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import type { MessageType, MessageStatus, WhatsAppMessageLog } from "@/modules/whatsapp/types";

// ── Filter types ─────────────────────────────────────────────

export interface LogFilters {
  messageType?: MessageType | "all";
  status?: MessageStatus | "all";
  patientSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  errorsOnly?: boolean;
}

export interface LogsPage {
  data: WhatsAppMessageLogWithPatient[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WhatsAppMessageLogWithPatient extends WhatsAppMessageLog {
  patient_name?: string | null;
  patient_phone?: string | null;
}

export interface WhatsAppStats {
  totalToday: number;
  deliveryRate: number;
  failed: number;
  read: number;
  totalPeriod: number;
}

// ── Helpers ──────────────────────────────────────────────────

const LOG_COLUMNS = `
  id,
  clinic_id,
  patient_id,
  appointment_id,
  message_type,
  status,
  message_content,
  phone_number,
  error_message,
  sent_at,
  delivered_at,
  pacientes!patient_id(nome)
`;

function mapRow(row: any): WhatsAppMessageLogWithPatient {
  return {
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    appointment_id: row.appointment_id,
    message_type: row.message_type as MessageType,
    status: row.status as MessageStatus,
    message_content: row.message_content,
    phone_number: row.phone_number,
    error_message: row.error_message,
    sent_at: row.sent_at,
    delivered_at: row.delivered_at,
    patient_name: row.pacientes?.nome ?? null,
  };
}

// ── Service functions ─────────────────────────────────────────

/**
 * Fetches a paginated, filtered list of WhatsApp message logs for a clinic.
 */
export async function getLogs(
  clinicId: string,
  filters: LogFilters = {},
  page = 1,
  pageSize = 20
): Promise<LogsPage> {
  try {
    let query = (supabase as any)
      .from("whatsapp_message_logs")
      .select(LOG_COLUMNS, { count: "exact" })
      .eq("clinic_id", clinicId)
      .order("sent_at", { ascending: false });

    if (filters.messageType && filters.messageType !== "all") {
      query = query.eq("message_type", filters.messageType);
    }
    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters.errorsOnly) {
      query = query.eq("status", "failed");
    }
    if (filters.dateFrom) {
      query = query.gte("sent_at", filters.dateFrom);
    }
    if (filters.dateTo) {
      // include the full day
      query = query.lte("sent_at", filters.dateTo + "T23:59:59.999Z");
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    let rows: WhatsAppMessageLogWithPatient[] = (data ?? []).map(mapRow);

    // Client-side patient name filter (Supabase doesn't support filtering on joined columns easily)
    if (filters.patientSearch) {
      const search = filters.patientSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.patient_name ?? "").toLowerCase().includes(search) ||
          (r.phone_number ?? "").includes(search)
      );
    }

    return {
      data: rows,
      total: count ?? 0,
      page,
      pageSize,
    };
  } catch (error) {
    handleError(error, "Erro ao buscar logs do WhatsApp.");
    return { data: [], total: 0, page, pageSize };
  }
}

/**
 * Returns complete detail for a single log entry.
 */
export async function getLogDetail(
  logId: string
): Promise<WhatsAppMessageLogWithPatient | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("whatsapp_message_logs")
      .select(LOG_COLUMNS)
      .eq("id", logId)
      .single();

    if (error) throw error;
    return mapRow(data);
  } catch (error) {
    handleError(error, "Erro ao buscar detalhes do log.");
    return null;
  }
}

/**
 * Re-enqueues (inserts) a copy of a failed log entry with status "sent".
 * The actual message sending must be triggered separately by the automation service.
 * Returns the new log id on success.
 */
export async function retryMessage(logId: string): Promise<string | null> {
  try {
    const original = await getLogDetail(logId);
    if (!original) throw new Error("Log não encontrado.");

    const { data, error } = await (supabase as any)
      .from("whatsapp_message_logs")
      .insert({
        clinic_id: original.clinic_id,
        patient_id: original.patient_id,
        appointment_id: original.appointment_id,
        message_type: original.message_type,
        status: "sent",
        message_content: original.message_content,
        phone_number: original.phone_number,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;
    return data?.id ?? null;
  } catch (error) {
    handleError(error, "Erro ao reenviar mensagem.");
    return null;
  }
}

/**
 * Computes delivery statistics for a clinic over the given number of days.
 */
export async function getStats(
  clinicId: string,
  days = 7
): Promise<WhatsAppStats> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await (supabase as any)
      .from("whatsapp_message_logs")
      .select("status, sent_at")
      .eq("clinic_id", clinicId)
      .gte("sent_at", since.toISOString());

    if (error) throw error;

    const rows: Array<{ status: string; sent_at: string }> = data ?? [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalToday = rows.filter(
      (r) => new Date(r.sent_at) >= todayStart
    ).length;

    const failed = rows.filter((r) => r.status === "failed").length;
    const read = rows.filter((r) => r.status === "read").length;
    const delivered = rows.filter(
      (r) => r.status === "delivered" || r.status === "read"
    ).length;
    const totalPeriod = rows.length;

    const deliveryRate =
      totalPeriod > 0
        ? Math.round((delivered / totalPeriod) * 100)
        : 0;

    return { totalToday, deliveryRate, failed, read, totalPeriod };
  } catch (error) {
    handleError(error, "Erro ao calcular estatísticas do WhatsApp.");
    return { totalToday: 0, deliveryRate: 0, failed: 0, read: 0, totalPeriod: 0 };
  }
}

/**
 * Exports log data as a CSV string.
 */
export async function exportLogsCSV(
  clinicId: string,
  filters: LogFilters = {}
): Promise<string> {
  const result = await getLogs(clinicId, filters, 1, 5000);

  const header = [
    "Data/Hora",
    "Paciente",
    "Tipo",
    "Status",
    "Telefone",
    "Erro",
  ].join(";");

  const typeLabel: Record<MessageType, string> = {
    session_confirmation: "Confirmação de Sessão",
    monthly_reminder: "Lembrete de Mensalidade",
    overdue_alert: "Alerta de Atraso",
  };

  const statusLabel: Record<MessageStatus, string> = {
    sent: "Enviado",
    delivered: "Entregue",
    read: "Lido",
    failed: "Falha",
  };

  const rows = result.data.map((r) =>
    [
      new Date(r.sent_at).toLocaleString("pt-BR"),
      r.patient_name ?? "",
      typeLabel[r.message_type] ?? r.message_type,
      statusLabel[r.status] ?? r.status,
      r.phone_number ?? "",
      r.error_message ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";")
  );

  return [header, ...rows].join("\n");
}
