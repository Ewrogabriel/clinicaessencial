import { Skeleton } from "@/components/ui/skeleton";
import { dateFormats } from "@/modules/shared/utils/dateFormatters";
import React from "react";

export interface Activity {
  id: string;
  type: "appointment" | "payment" | "patient" | "system";
  title: string;
  description?: string;
  timestamp: string;
  icon?: React.ReactNode;
  avatar?: string;
  actionUrl?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
  limit?: number;
}

function ActivityItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0">
      {activity.avatar ? (
        <img
          src={activity.avatar}
          alt=""
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs flex-shrink-0">
          {activity.icon || "📌"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-muted-foreground">{activity.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {dateFormats.relative(activity.timestamp)}
        </p>
      </div>
    </div>
  );
}

export function ActivityFeed({ activities, loading = false, limit = 5 }: ActivityFeedProps) {
  if (loading) return <Skeleton className="h-64 w-full" />;

  const limited = activities.slice(0, limit);

  if (limited.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>Nenhuma atividade recente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {limited.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
