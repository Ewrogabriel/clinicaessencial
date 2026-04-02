import { useCallback } from "react";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  notificationService,
  NotificationPayload,
} from "@/modules/finance/services/notificationService";

export function useNotificationDispatcher() {
  const { activeClinicId } = useClinic();
  const { user } = useAuth();

  const notify = useCallback(
    async (payload: Omit<NotificationPayload, "clinicId">) => {
      if (!activeClinicId) return;

      const fullPayload: NotificationPayload = {
        ...payload,
        clinicId: activeClinicId,
        userId: user?.id,
      };

      // Criar no banco
      await notificationService.createNotification(fullPayload);

      // Buscar preferências do usuário
      const prefs = await notificationService.getPreferences(user?.id || "");

      // Verificar se deve notificar
      if (!notificationService.shouldNotify(prefs, payload.severity)) {
        return;
      }

      // Enviar via canais configurados
      if (prefs?.slack_enabled) {
        await notificationService.sendSlackAlert(
          activeClinicId,
          `${payload.title}: ${payload.message}`,
          payload.severity
        );
      }

      if (prefs?.email_enabled && user?.email) {
        await notificationService.sendEmailAlert(
          user.email,
          payload.title,
          payload.title,
          payload.message,
          payload.severity
        );
      }

      if (prefs?.push_enabled && user?.id) {
        await notificationService.sendPushNotification(
          user.id,
          payload.title,
          payload.message,
          payload.data
        );
      }
    },
    [activeClinicId, user]
  );

  return { notify };
}
