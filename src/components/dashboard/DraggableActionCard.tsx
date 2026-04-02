import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { type QuickAction } from "@/modules/shared/hooks/useQuickActions";
import * as LucideIcons from "lucide-react";

interface DraggableActionCardProps {
  action: QuickAction;
  onToggle: (id: string) => void;
}

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as Record<string, any>)[name];
  if (!Icon) return <LucideIcons.LayoutGrid className={className} />;
  return <Icon className={className} />;
}

export function DraggableActionCard({ action, onToggle }: DraggableActionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card",
        isDragging && "opacity-50 shadow-lg z-50",
        !action.visible && "opacity-60"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Icon */}
      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <DynamicIcon name={action.icon} className="h-3.5 w-3.5 text-primary" />
      </div>

      {/* Label */}
      <span className={cn("flex-1 text-sm font-medium", !action.visible && "line-through text-muted-foreground")}>
        {action.label}
      </span>

      {/* Visibility icon hint */}
      {action.visible ? (
        <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      ) : (
        <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}

      {/* Toggle */}
      <Switch
        checked={action.visible}
        onCheckedChange={() => onToggle(action.id)}
        aria-label={`${action.visible ? "Ocultar" : "Mostrar"} ${action.label}`}
      />
    </div>
  );
}
