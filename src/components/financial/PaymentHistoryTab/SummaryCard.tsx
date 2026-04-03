import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/modules/shared/utils/currencyFormatters";

interface SummaryCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
}

export function SummaryCard({ label, value, icon: Icon, colorClass }: SummaryCardProps) {
  return (
    <Card className={colorClass}>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1">
          <Icon className="h-3.5 w-3.5" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <p className="text-xl font-bold">{formatBRL(value)}</p>
      </CardContent>
    </Card>
  );
}
