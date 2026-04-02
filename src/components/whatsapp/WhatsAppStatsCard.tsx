import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, CheckCheck, XCircle, BookOpen } from "lucide-react";
import type { WhatsAppStats } from "@/modules/whatsapp/services/whatsappLogsService";

interface WhatsAppStatsCardProps {
  stats: WhatsAppStats;
  days: number;
  onDaysChange: (days: number) => void;
  isLoading?: boolean;
}

const STAT_ITEMS = [
  {
    key: "totalToday" as const,
    label: "Enviadas Hoje",
    icon: MessageSquare,
    color: "text-blue-600",
    bg: "bg-blue-50",
    format: (v: number) => String(v),
  },
  {
    key: "deliveryRate" as const,
    label: "Taxa de Entrega",
    icon: CheckCheck,
    color: "text-green-600",
    bg: "bg-green-50",
    format: (v: number) => `${v}%`,
  },
  {
    key: "failed" as const,
    label: "Falhas",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    format: (v: number) => String(v),
  },
  {
    key: "read" as const,
    label: "Lidas",
    icon: BookOpen,
    color: "text-purple-600",
    bg: "bg-purple-50",
    format: (v: number) => String(v),
  },
];

export function WhatsAppStatsCard({
  stats,
  days,
  onDaysChange,
  isLoading,
}: WhatsAppStatsCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Estatísticas — últimos {days} dias
        </h3>
        <Select value={String(days)} onValueChange={(v) => onDaysChange(Number(v))}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_ITEMS.map(({ key, label, icon: Icon, color, bg, format }) => (
          <Card key={key} className="border shadow-sm">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full p-1.5 ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </span>
                <span className={`text-2xl font-bold ${isLoading ? "opacity-50" : ""}`}>
                  {isLoading ? "…" : format(stats[key])}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
