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
    },
    [activeClinicId, user]
  );

  return { notify };
}
