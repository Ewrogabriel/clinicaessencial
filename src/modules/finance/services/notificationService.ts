import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface NotificationPayload {
  clinicId: string;
  userId?: string;
  type: "discrepancy" | "reconciliation" | "error" | "success";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  actionUrl?: string;
  data?: Record<string, any>;
}

export const notificationService = {
  // Enviar notificação Slack
  async sendSlackAlert(
    clinicId: string,
    message: string,
    severity: "critical" | "warning" | "info"
  ): Promise<void> {
    try {
      // Buscar webhook Slack da clínica
      const { data: config } = await (supabase
        .from("clinic_integrations")
        .select("slack_webhook_url")
        .eq("clinic_id", clinicId)
        .single() as any);

      if (!config?.slack_webhook_url) return;

      const color =
        severity === "critical"
          ? "#dc2626"
          : severity === "warning"
            ? "#d97706"
            : "#0ea5e9";

      const payload = {
        attachments: [
          {
            color,
            title: `🔔 Alerta: ${severity.toUpperCase()}`,
            text: message,
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      const response = await fetch(config.slack_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }
    } catch (error) {
      handleError(error, "Erro ao enviar alerta Slack");
    }
  },

  // Enviar notificação Email
  async sendEmailAlert(
    email: string,
    subject: string,
    title: string,
    message: string,
    severity: "critical" | "warning" | "info"
  ): Promise<void> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "alerts@clinicaessencial.com",
          to: email,
          subject,
          html: `
            <h2>${title}</h2>
            <p>${message}</p>
            <p style="color: ${severity === "critical" ? "red" : severity === "warning" ? "orange" : "blue"}">
              Severidade: ${severity.toUpperCase()}
            </p>
            <p><a href="${import.meta.env.VITE_APP_URL}/financeiro/conciliacao">Ver no sistema</a></p>
          `,
        }),
      });

      if (!response.ok) {
        throw new Error(`Email API error: ${response.status}`);
      }
    } catch (error) {
      handleError(error, "Erro ao enviar email");
    }
  },

  // Enviar notificação Push
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${import.meta.env.VITE_FCM_SERVER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: `/topics/user_${userId}`,
          notification: { title, body },
          data: data || {},
          webpush: {
            fcmOptions: { link: "/financeiro/conciliacao" },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`FCM error: ${response.status}`);
      }
    } catch (error) {
      handleError(error, "Erro ao enviar push notification");
    }
  },

  // Criar notificação no banco
  async createNotification(payload: NotificationPayload): Promise<void> {
    try {
      const { error } = await (supabase
        .from("notifications")
        .insert([
          {
            clinic_id: payload.clinicId,
            user_id: payload.userId,
            type: payload.type,
            severity: payload.severity,
            title: payload.title,
            message: payload.message,
            action_url: payload.actionUrl,
            data: payload.data,
          },
        ]) as any);

      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao criar notificação");
    }
  },

  // Buscar histórico de notificações
  async getNotificationHistory(
    clinicId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const { data, error } = await (supabase
        .from("notifications")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(limit) as any);

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleError(error, "Erro ao buscar histórico");
      return [];
    }
  },

  // Marcar como lido
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await (supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId) as any);

      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao marcar como lido");
    }
  },

  // Buscar preferências
  async getPreferences(userId: string): Promise<any> {
    try {
      const { data, error } = await (supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .single() as any);

      if (error && error.code !== "PGRST116") throw error;
      return (
        data || {
          slack_enabled: true,
          email_enabled: true,
          push_enabled: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
          critical_only: false,
        }
      );
    } catch (error) {
      handleError(error, "Erro ao buscar preferências");
      return null;
    }
  },

  // Salvar preferências
  async savePreferences(userId: string, preferences: any): Promise<void> {
    try {
      const { error } = await (supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: userId,
            ...preferences,
          },
          { onConflict: "user_id" }
        ) as any);

      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao salvar preferências");
    }
  },

  // Verificar se deve notificar (respeita quiet hours)
  shouldNotify(
    preferences: any,
    severity?: "critical" | "warning" | "info"
  ): boolean {
    if (!preferences) return true;

    // Critical notifications always bypass quiet hours
    if (severity === "critical") return true;

    if (preferences.quiet_hours_start && preferences.quiet_hours_end) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = preferences.quiet_hours_start
        .split(":")
        .map(Number);
      const [endH, endM] = preferences.quiet_hours_end.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        // Same-day range (e.g., 08:00 to 20:00)
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          return false;
        }
      } else {
        // Overnight range (e.g., 22:00 to 06:00)
        if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
          return false;
        }
      }
    }

    return true;
  },
};
