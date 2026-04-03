import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message = "Nenhum dado disponível",
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("py-8 text-center text-muted-foreground", className)}>
      {icon && <div className="flex justify-center mb-2">{icon}</div>}
      <p>{message}</p>
    </div>
  );
}
