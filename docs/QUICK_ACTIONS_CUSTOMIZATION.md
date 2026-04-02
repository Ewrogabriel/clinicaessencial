# Quick Actions Customization

## Overview

Quick Actions are the shortcut buttons displayed prominently in the patient and professional dashboards. Users can personalise which actions appear, change their order via drag-and-drop, and hide actions they don't use.

Customizations are stored in `localStorage`, keyed by user ID, so each user has an independent configuration that persists across sessions without requiring a database call.

---

## Components

| Component | Path | Description |
|-----------|------|-------------|
| `QuickActionCustomizer` | `components/quick-actions/QuickActionCustomizer` | Modal/panel for managing the actions list |
| `DraggableActionCard` | `components/quick-actions/DraggableActionCard` | Individual draggable action item within the customizer |

---

## Hook: `useQuickActions`

Located at `modules/quick-actions/hooks/useQuickActions`.

```tsx
const {
  actions,          // QuickAction[] — current ordered, filtered list
  allActions,       // QuickAction[] — full list including hidden items
  toggleAction,     // (id: string) => void — show/hide an action
  reorderActions,   // (newOrder: QuickAction[]) => void — save drag-drop result
  resetToDefaults,  // () => void — restore the default set and order
} = useQuickActions(userId);
```

### localStorage key format

```
quick_actions_{userId}
```

The stored value is a JSON array of `QuickAction` objects (ordered, with `visible` flag).

---

## Features

### Drag-and-Drop Reordering

Powered by **[dnd-kit](https://dndkit.com/)** (`@dnd-kit/core` + `@dnd-kit/sortable`). `DraggableActionCard` is wrapped with `useSortable`, and `QuickActionCustomizer` renders a `SortableContext` with a vertical list strategy.

On drop, `reorderActions` is called with the new order, which is immediately persisted to `localStorage`.

### Show / Hide Actions

Each `DraggableActionCard` has a visibility toggle (eye icon). Calling `toggleAction(id)` flips the `visible` flag and saves the updated list.

Hidden actions remain in the stored array so users can re-enable them later.

### Reset to Defaults

The **Reset** button in `QuickActionCustomizer` calls `resetToDefaults()`, which removes the user's `localStorage` key and reinitialises the list from `DEFAULT_QUICK_ACTIONS`.

---

## Default Actions

```ts
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: "agendar",         label: "Agendar consulta",      icon: "Calendar",    path: "/agenda" },
  { id: "prontuario",      label: "Prontuário",            icon: "FileText",    path: "/prontuarios" },
  { id: "pagamentos",      label: "Meus pagamentos",       icon: "CreditCard",  path: "/meus-pagamentos" },
  { id: "planos",          label: "Meus planos",           icon: "ClipboardList", path: "/meus-planos" },
  { id: "mensagens",       label: "Mensagens",             icon: "MessageSquare", path: "/mensagens" },
  { id: "historico",       label: "Histórico de sessões",  icon: "History",     path: "/meu-historico" },
  { id: "conquistas",      label: "Minhas conquistas",     icon: "Trophy",      path: "/gamificacao/ranking" },
  { id: "teleconsulta",    label: "Teleconsulta",          icon: "Video",       path: "/teleconsulta" },
];
```

---

## How to Add New Actions

1. Add an entry to `DEFAULT_QUICK_ACTIONS` in the constants file.
2. Provide a unique `id`, a `label`, a [Lucide](https://lucide.dev/) icon name, and a `path`.
3. Existing users who have a saved customization will not see the new action until they press **Reset to Defaults** or toggle it on manually in `QuickActionCustomizer`.

To auto-inject a new action for all users on next load, update the migration logic in `useQuickActions` to merge new default entries that are missing from the stored list.

---

## dnd-kit Usage

```tsx
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

// Inside QuickActionCustomizer
const sensors = useSensors(useSensor(PointerSensor));

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
    {actions.map(action => (
      <DraggableActionCard key={action.id} action={action} onToggle={toggleAction} />
    ))}
  </SortableContext>
</DndContext>
```

`handleDragEnd` uses `arrayMove` from `@dnd-kit/sortable` to compute the new order, then calls `reorderActions`.
