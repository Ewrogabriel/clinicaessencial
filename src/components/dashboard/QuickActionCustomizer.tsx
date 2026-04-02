import { useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings2, RotateCcw } from "lucide-react";
import { DraggableActionCard } from "@/components/dashboard/DraggableActionCard";
import { useQuickActions, type QuickAction } from "@/modules/shared/hooks/useQuickActions";

interface QuickActionCustomizerProps {
  /** Optional trigger element. If omitted, a default "Personalizar" button is rendered. */
  trigger?: React.ReactNode;
}

export function QuickActionCustomizer({ trigger }: QuickActionCustomizerProps) {
  const { actions, reorderActions, toggleAction, resetActions } = useQuickActions();
  const [open, setOpen] = useState(false);
  const [localActions, setLocalActions] = useState<QuickAction[]>(actions);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setLocalActions([...actions]);
    setOpen(isOpen);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localActions.findIndex((a) => a.id === active.id);
      const newIndex = localActions.findIndex((a) => a.id === over.id);
      setLocalActions(arrayMove(localActions, oldIndex, newIndex));
    }
  };

  const handleToggleLocal = (id: string) => {
    setLocalActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, visible: !a.visible } : a))
    );
  };

  const handleSave = () => {
    reorderActions(localActions);
    // Sync visibility changes
    localActions.forEach((local) => {
      const original = actions.find((a) => a.id === local.id);
      if (original && original.visible !== local.visible) {
        toggleAction(local.id);
      }
    });
    setOpen(false);
  };

  const handleReset = () => {
    resetActions();
    setOpen(false);
  };

  const visibleCount = localActions.filter((a) => a.visible).length;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" /> Personalizar Ações
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Ações Rápidas</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Arraste para reordenar e use o toggle para mostrar/ocultar atalhos.{" "}
          <span className="text-foreground font-medium">{visibleCount}</span> de{" "}
          {localActions.length} visíveis.
        </p>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 mt-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localActions.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {localActions.map((action) => (
                <DraggableActionCard
                  key={action.id}
                  action={action}
                  onToggle={handleToggleLocal}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" /> Restaurar Padrão
          </Button>
          <Button size="sm" onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
