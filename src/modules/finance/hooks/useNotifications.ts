import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { notificationService } from "@/modules/finance/services/notificationService";

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar notificações do usuário
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["finance-notifications", user?.id],
    queryFn: () => notificationService.getNotificationHistory(user!.id),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Marcar como lido
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-notifications", user?.id] });
    },
  });

  const unreadCount = notifications.filter((n: any) => !n.lida).length;

  return {
    notifications,
    preferences: null,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutateAsync,
    savePreferences: async (_prefs: any) => {},
  };
}
