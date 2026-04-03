import { Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimeSlot {
  id: string;
  start_time: string;
  end_time?: string;
  max_capacity: number;
  current_capacity: number;
  is_available?: boolean;
  status?: string;
}

interface TimeSlotCardsProps {
  slots: TimeSlot[];
  selectedSlotId: string;
  onSelect: (slot: TimeSlot) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
}

export function TimeSlotCards({ slots, selectedSlotId, onSelect, isLoading, emptyMessage, disabled }: TimeSlotCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[72px] rounded-xl border-2 border-border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <div className="text-center py-5 text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
        {emptyMessage || "Nenhum horário disponível."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {slots.map((slot) => {
        const isFull = slot.status === "full" || slot.current_capacity >= slot.max_capacity;
        const isSelected = selectedSlotId === slot.id;
        const available = slot.max_capacity - slot.current_capacity;

        return (
          <button
            key={slot.id}
            type="button"
            disabled={isFull || disabled}
            onClick={() => onSelect(slot)}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 p-2.5 transition-all duration-200",
              isFull
                ? "border-destructive/30 bg-destructive/5 opacity-60 cursor-not-allowed"
                : isSelected
                  ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20 scale-[1.02]"
                  : "border-border bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer"
            )}
          >
            <Clock className={cn("h-4 w-4 mb-1", isSelected ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm font-bold", isSelected ? "text-primary" : "text-foreground")}>
              {slot.start_time.slice(0, 5)}
            </span>
            <div className={cn(
              "flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              isFull
                ? "bg-destructive/10 text-destructive"
                : available <= 1
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            )}>
              <Users className="h-2.5 w-2.5" />
              {isFull ? "Lotado" : `${available}/${slot.max_capacity}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
