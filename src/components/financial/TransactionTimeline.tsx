import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankTransaction } from "@/modules/finance/services/reconciliationService";

interface TimelineEvent {
  date: string;
  action: "created" | "approved" | "rejected" | "pending";
  actor?: string | null;
  description: string;
}

function buildTimeline(tx: BankTransaction): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    date: tx.created_at ?? tx.data_transacao,
    action: "created",
    description: "Transação importada",
  });

  if (tx.reviewed_at && tx.reviewed_by) {
    events.push({
      date: tx.reviewed_at,
      action: (tx.status ?? "pending") as TimelineEvent["action"],
      actor: tx.reviewed_by,
      description:
        tx.status === "aprovado"
          ? "Aprovado manualmente"
          : tx.status === "rejeitado"
          ? "Rejeitado"
          : "Revisado",
    });
  }

  return events;
}

const actionConfig: Record<
  TimelineEvent["action"],
  { icon: React.ElementType; color: string }
> = {
  created: { icon: Clock, color: "text-blue-500 bg-blue-50 dark:bg-blue-900/30" },
  approved: { icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-900/30" },
  rejected: { icon: XCircle, color: "text-red-600 bg-red-50 dark:bg-red-900/30" },
  pending: { icon: Clock, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30" },
};

interface TransactionTimelineProps {
  transaction: BankTransaction;
}

export function TransactionTimeline({ transaction }: TransactionTimelineProps) {
  const events = buildTimeline(transaction);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Histórico
      </h4>
      <ol className="relative border-l border-border ml-3 space-y-4">
        {events.map((event, idx) => {
          const cfg = actionConfig[event.action] ?? actionConfig.pending;
          const Icon = cfg.icon;
          return (
            <li key={idx} className="ml-5">
              <span
                className={cn(
                  "absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full",
                  cfg.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-medium">{event.description}</p>
              <time className="text-xs text-muted-foreground">
                {format(parseISO(event.date), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </time>
              {event.actor && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3" />
                  {event.actor}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
