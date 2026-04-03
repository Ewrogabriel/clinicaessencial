import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface NotificationPayload {
  clinicId?: string;
  userId?: string;
  type: "discrepancy" | "reconciliation" | "error" | "success";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  actionUrl?: string;
  data?: Record<string, any>;
}

export const notificationService = {
  // Criar notificação no banco (usando tabela notificacoes existente)
  async createNotification(payload: NotificationPayload): Promise<void> {
    try {
      if (!payload.userId) return;

      const { error } = await (supabase
        .from("notificacoes")
        .insert({
          user_id: payload.userId,
          tipo: payload.type,
          titulo: payload.title,
          resumo: payload.message,
          conteudo: payload.message,
          link: payload.actionUrl || null,
          metadata: payload.data || null,
        }) as any);

      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao criar notificação");
    }
  },

  // Buscar histórico de notificações
  async getNotificationHistory(
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const { data, error } = await (supabase
        .from("notificacoes")
        .select("*")
        .eq("user_id", userId)
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
        .from("notificacoes")
        .update({ lida: true })
        .eq("id", notificationId) as any);

      if (error) throw error;
    } catch (error) {
      handleError(error, "Erro ao marcar como lido");
    }
  },

  // Verificar se deve notificar (respeita quiet hours)
  shouldNotify(
    preferences: any,
    severity?: "critical" | "warning" | "info"
  ): boolean {
    if (!preferences) return true;
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
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          return false;
        }
      } else {
        if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
          return false;
        }
      }
    }

    return true;
  },
};
