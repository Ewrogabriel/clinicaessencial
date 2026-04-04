// ============================================================
// WhatsApp Integration – TypeScript types
// Updated to support dual-provider: Meta + Evolution API
// ============================================================

export type MessageType = "session_confirmation" | "monthly_reminder" | "overdue_alert";
export type MessageStatus = "sent" | "failed" | "delivered" | "read";
export type WhatsAppProvider = "meta" | "evolution";
export type ConversationStatus = "open" | "waiting" | "closed";
export type MessageDirection = "incoming" | "outgoing";

// ── Database row shapes ──────────────────────────────────────

export interface WhatsAppConfig {
  id: string;
  clinic_id: string;
  /** 'meta' (default) or 'evolution' */
  provider: WhatsAppProvider;
  // ── Meta fields ───────────────────────────────────────────
  api_token: string | null;
  phone_number_id: string | null;
  // ── Evolution API fields ──────────────────────────────────
  evolution_api_url: string | null;
  evolution_instance: string | null;
  evolution_api_key: string | null;
  // ─────────────────────────────────────────────────────────
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppAutomationSettings {
  id: string;
  clinic_id: string;

  // Session confirmation
  session_confirmation_enabled: boolean;
  session_confirmation_hours_before: number;
  session_confirmation_message: string | null;

  // Monthly reminder
  monthly_reminder_enabled: boolean;
  monthly_reminder_days_before: number;
  monthly_reminder_message: string | null;
  /** NULL means all patients; otherwise an array of patient UUIDs. */
  monthly_reminder_patient_ids: string[] | null;

  // Overdue alert
  overdue_alert_enabled: boolean;
  overdue_alert_days: number;
  overdue_alert_include_pix: boolean;
  overdue_alert_message: string | null;
  /** NULL means all patients; otherwise an array of patient UUIDs. */
  overdue_alert_patient_ids: string[] | null;

  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessageLog {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  appointment_id: string | null;
  message_type: MessageType;
  status: MessageStatus;
  message_content: string | null;
  phone_number: string | null;
  error_message: string | null;
  sent_at: string;
  delivered_at: string | null;
}

// ── Conversation Inbox types ─────────────────────────────────

export interface WhatsAppConversation {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  phone_number: string;
  contact_name: string | null;
  assigned_professional_id: string | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields (from queries)
  patient?: { id: string; nome: string; foto_url?: string | null } | null;
  professional?: { user_id: string; nome: string } | null;
}

export interface WhatsAppConversationMessage {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  content: string;
  sent_by_professional_id: string | null;
  message_id_external: string | null;
  read_at: string | null;
  created_at: string;
  // Joined
  professional?: { nome: string } | null;
}

// ── API / service parameter shapes ──────────────────────────

export interface SendMessageParams {
  phoneNumber: string;
  messageType: MessageType;
  content: string;
  clinicId: string;
  patientId?: string;
  appointmentId?: string;
}

export interface WhatsAppApiResponse {
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  error: string | null;
}

// ── Automation trigger payload shapes ───────────────────────

export interface SessionConfirmationData {
  patientName: string;
  patientPhone: string;
  professionalName: string;
  sessionDate: string;
  sessionTime: string;
  confirmationLink: string;
}

export interface MonthlyReminderData {
  patientName: string;
  patientPhone: string;
  amount: number;
  dueDate: string;
}

export interface OverdueAlertData {
  patientName: string;
  patientPhone: string;
  amount: number;
  daysOverdue: number;
  pixKey?: string | null;
  pixKeyType?: string | null;
  beneficiaryName?: string | null;
}
