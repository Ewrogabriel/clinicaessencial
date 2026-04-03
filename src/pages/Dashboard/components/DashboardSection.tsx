import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

interface DashboardSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}

export function DashboardSection({
  title,
  description,
  icon,
  action,
  children,
  loading = false,
  empty = false,
  emptyMessage = "Nenhum dado disponível",
}: DashboardSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-32 w-full" />}
        {!loading && empty && (
          <div className="py-8 text-center text-muted-foreground">
            <p>{emptyMessage}</p>
          </div>
        )}
        {!loading && !empty && children}
      </CardContent>
    </Card>
  );
}
