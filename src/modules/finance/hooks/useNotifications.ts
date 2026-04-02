import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { notificationService } from "@/modules/finance/services/notificationService";

export function useNotifications() {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  // Buscar notificações
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", activeClinicId],
    queryFn: () => notificationService.getNotificationHistory(activeClinicId!),
    enabled: !!activeClinicId,
    refetchInterval: 30000, // 30 segundos
  });

  // Buscar preferências
  const { data: preferences } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: () => notificationService.getPreferences(user?.id || ""),
    enabled: !!user?.id,
  });

  // Marcar como lido
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", activeClinicId] });
    },
  });

  // Salvar preferências
  const savePreferencesMutation = useMutation({
    mutationFn: (prefs: any) =>
      notificationService.savePreferences(user?.id || "", prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", user?.id] });
    },
  });

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  return {
    notifications,
    preferences,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutateAsync,
    savePreferences: savePreferencesMutation.mutateAsync,
  };
}
