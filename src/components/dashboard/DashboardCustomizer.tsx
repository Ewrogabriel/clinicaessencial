import { useState } from "react";
import { DashboardCard } from "@/hooks/useDashboardLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Settings2, GripVertical, RotateCcw } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface Props {
  cards: DashboardCard[];
  onReorder: (cards: DashboardCard[]) => void;
  onToggle: (id: string) => void;
  onReset: () => void;
}

function SortableItem({ card, onToggle }: { card: DashboardCard; onToggle: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

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
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium">{card.label}</span>
      <Switch checked={card.visible} onCheckedChange={() => onToggle(card.id)} />
    </div>
  );
}

export function DashboardCustomizer({ cards, onReorder, onToggle, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [localCards, setLocalCards] = useState<DashboardCard[]>(cards);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setLocalCards([...cards]);
    setOpen(isOpen);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localCards.findIndex(c => c.id === active.id);
      const newIndex = localCards.findIndex(c => c.id === over.id);
      const reordered = arrayMove(localCards, oldIndex, newIndex);
      setLocalCards(reordered);
    }
  };

  const handleToggleLocal = (id: string) => {
    setLocalCards(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const handleSave = () => {
    onReorder(localCards);
    setOpen(false);
  };

  const handleReset = () => {
    onReset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" /> Personalizar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Dashboard</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          Arraste para reordenar e use o toggle para mostrar/ocultar seções.
        </p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {localCards.map(card => (
                <SortableItem key={card.id} card={card} onToggle={handleToggleLocal} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" /> Restaurar Padrão
          </Button>
          <Button size="sm" onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
