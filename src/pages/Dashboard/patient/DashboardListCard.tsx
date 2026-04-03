import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, type LucideIcon } from "lucide-react";

interface DashboardListCardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  onViewAll?: () => void;
  isEmpty: boolean;
  emptyMessage: string;
  emptyAction?: { label: string; onClick: () => void };
  children: ReactNode;
  headerExtra?: ReactNode;
  className?: string;
}

export function DashboardListCard({
  title, icon: Icon, iconColor, onViewAll, isEmpty, emptyMessage, emptyAction, children, headerExtra, className,
}: DashboardListCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
          {headerExtra}
        </CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs text-primary gap-1 h-7">
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Icon className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            {emptyAction && (
              <Button variant="outline" size="sm" className="mt-3" onClick={emptyAction.onClick}>
                {emptyAction.label}
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
