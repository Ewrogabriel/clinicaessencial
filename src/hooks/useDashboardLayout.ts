import { useState, useCallback } from "react";

export interface DashboardCard {
  id: string;
  label: string;
  visible: boolean;
}

const STORAGE_PREFIX = "dashboard_layout_";

function getStorageKey(dashboardType: string) {
  return `${STORAGE_PREFIX}${dashboardType}`;
}

export function useDashboardLayout(dashboardType: string, defaultCards: DashboardCard[]) {
  const [cards, setCards] = useState<DashboardCard[]>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(dashboardType));
      if (stored) {
        const parsed: DashboardCard[] = JSON.parse(stored);
        // Merge: keep stored order/visibility but add any new cards from defaults
        const storedIds = new Set(parsed.map(c => c.id));
        const merged = [
          ...parsed.filter(c => defaultCards.some(d => d.id === c.id)),
          ...defaultCards.filter(d => !storedIds.has(d.id)),
        ];
        return merged;
      }
    } catch { /* ignore */ }
    return defaultCards;
  });

  const persist = useCallback((newCards: DashboardCard[]) => {
    setCards(newCards);
    localStorage.setItem(getStorageKey(dashboardType), JSON.stringify(newCards));
  }, [dashboardType]);

  const moveCard = useCallback((fromIndex: number, toIndex: number) => {
    const updated = [...cards];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    persist(updated);
  }, [cards, persist]);

  const toggleCard = useCallback((cardId: string) => {
    const updated = cards.map(c => c.id === cardId ? { ...c, visible: !c.visible } : c);
    persist(updated);
  }, [cards, persist]);

  const resetToDefault = useCallback(() => {
    persist([...defaultCards]);
  }, [defaultCards, persist]);

  const reorderCards = useCallback((newOrder: DashboardCard[]) => {
    persist(newOrder);
  }, [persist]);

  const visibleCards = cards.filter(c => c.visible);

  return { cards, visibleCards, moveCard, toggleCard, resetToDefault, reorderCards };
}
