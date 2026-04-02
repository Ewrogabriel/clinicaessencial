import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: any;
  onRead: () => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const severityConfig = {
    critical: {
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      badge: "destructive",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      badge: "secondary",
    },
    info: {
      icon: Info,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      badge: "outline",
    },
    success: {
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      badge: "default",
    },
  };

  const config =
    severityConfig[notification.severity as keyof typeof severityConfig] ??
    severityConfig.info;
  const Icon = config.icon;

  const handleClick = () => {
    onRead();
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start p-3 h-auto text-left rounded-none border-0",
        !notification.read && config.bgColor
      )}
      onClick={handleClick}
    >
      <Icon className={cn("h-5 w-5 mr-3 flex-shrink-0", config.color)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{notification.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={config.badge as any} className="text-xs">
            {notification.severity.toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(notification.created_at).toLocaleTimeString("pt-BR")}
          </span>
        </div>
      </div>
    </Button>
  );
}
