import type { ScheduleSlot } from "../types/appointment";

interface SlotCapacityBadgeProps {
    slot: Pick<ScheduleSlot, "max_capacity" | "current_capacity" | "is_available">;
    className?: string;
}

/**
 * Displays remaining capacity for a schedule slot.
 * Shows a color-coded badge: green (available), amber (almost full), red (full).
 */
export function SlotCapacityBadge({ slot, className = "" }: SlotCapacityBadgeProps) {
    const remaining = slot.max_capacity - slot.current_capacity;
    const pct = slot.max_capacity > 0 ? slot.current_capacity / slot.max_capacity : 1;

    let colorClass = "bg-green-100 text-green-800";
    if (!slot.is_available) {
        colorClass = "bg-red-100 text-red-800";
    } else if (pct >= 0.75) {
        colorClass = "bg-amber-100 text-amber-800";
    }

    if (!slot.is_available) {
        return (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass} ${className}`}>
                Lotado
            </span>
        );
    }

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass} ${className}`}>
            {remaining}/{slot.max_capacity} {remaining === 1 ? "vaga" : "vagas"}
        </span>
    );
}
