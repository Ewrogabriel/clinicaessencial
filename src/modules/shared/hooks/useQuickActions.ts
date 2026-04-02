import { useState, useCallback } from "react";
import { useAuth } from "@/modules/auth/hooks/useAuth";

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  href: string;
  visible: boolean;
  order: number;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  { id: "schedule",    label: "Agenda",       icon: "Calendar",     href: "/agenda",     visible: true, order: 0 },
  { id: "pacientes",   label: "Pacientes",    icon: "Users",        href: "/pacientes",  visible: true, order: 1 },
  { id: "financeiro",  label: "Financeiro",   icon: "DollarSign",   href: "/financeiro", visible: true, order: 2 },
  { id: "relatorios",  label: "Relatórios",   icon: "BarChart2",    href: "/relatorios", visible: true, order: 3 },
  { id: "metas",       label: "Metas",        icon: "Target",       href: "/metas",      visible: true, order: 4 },
  { id: "mensagens",   label: "Mensagens",    icon: "MessageSquare",href: "/mensagens",  visible: true, order: 5 },
];

function getStorageKey(userId: string) {
  return `quick-actions-preferences-${userId}`;
}

function loadActions(userId: string | null): QuickAction[] {
  if (!userId) return DEFAULT_ACTIONS;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return DEFAULT_ACTIONS;
    const parsed: QuickAction[] = JSON.parse(raw);
    // Merge with defaults to pick up any new actions added over time
    const existingIds = new Set(parsed.map((a) => a.id));
    const merged = [
      ...parsed,
      ...DEFAULT_ACTIONS.filter((d) => !existingIds.has(d.id)).map((d, i) => ({
        ...d,
        order: parsed.length + i,
      })),
    ];
    return merged.sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_ACTIONS;
  }
}

function saveActions(userId: string | null, actions: QuickAction[]) {
  if (!userId) return; // No user — don't persist anonymous state
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(actions));
  } catch {
    // localStorage unavailable (private mode, etc.) — silently ignore
  }
}

export function useQuickActions() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [actions, setActions] = useState<QuickAction[]>(() =>
    userId ? loadActions(userId) : DEFAULT_ACTIONS
  );

  const persist = useCallback(
    (next: QuickAction[]) => {
      setActions(next);
      saveActions(userId, next);
    },
    [userId]
  );

  const reorderActions = useCallback(
    (reordered: QuickAction[]) => {
      const withOrder = reordered.map((a, i) => ({ ...a, order: i }));
      persist(withOrder);
    },
    [persist]
  );

  const toggleAction = useCallback(
    (id: string) => {
      const next = actions.map((a) => (a.id === id ? { ...a, visible: !a.visible } : a));
      persist(next);
    },
    [actions, persist]
  );

  const resetActions = useCallback(() => {
    persist(DEFAULT_ACTIONS);
  }, [persist]);

  return { actions, reorderActions, toggleAction, resetActions };
}
