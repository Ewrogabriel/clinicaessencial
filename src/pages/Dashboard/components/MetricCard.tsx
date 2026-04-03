import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  onClick?: () => void;
  className?: string;
}

const variants: Record<string, string> = {
  default: "border-blue-100 bg-blue-50/50 text-blue-700",
  success: "border-green-100 bg-green-50/50 text-green-700",
  warning: "border-yellow-100 bg-yellow-50/50 text-yellow-700",
  danger: "border-red-100 bg-red-50/50 text-red-700",
  info: "border-purple-100 bg-purple-50/50 text-purple-700",
};

export function MetricCard({
  label,
  value,
  icon,
  variant = "default",
  trend,
  onClick,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        variants[variant],
        onClick && "cursor-pointer hover:shadow-md transition-all",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          {icon && <span className="h-3.5 w-3.5 flex items-center">{icon}</span>}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-bold">{value}</p>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs font-semibold",
                trend.direction === "up" ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.direction === "up" ? "↑" : "↓"}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
