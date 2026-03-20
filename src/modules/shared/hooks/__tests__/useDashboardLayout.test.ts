import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboardLayout, DashboardCard } from "../useDashboardLayout";

const defaultCards: DashboardCard[] = [
  { id: "agenda", label: "Agenda", visible: true },
  { id: "patients", label: "Pacientes", visible: true },
  { id: "finance", label: "Financeiro", visible: true },
];

describe("useDashboardLayout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should return default cards", () => {
    const { result } = renderHook(() => useDashboardLayout("test", defaultCards));
    expect(result.current.cards).toHaveLength(3);
    expect(result.current.cards[0].id).toBe("agenda");
  });

  it("should toggle card visibility", () => {
    const { result } = renderHook(() => useDashboardLayout("test", defaultCards));

    act(() => {
      result.current.toggleCard("agenda");
    });

    const agenda = result.current.cards.find((c) => c.id === "agenda");
    expect(agenda?.visible).toBe(false);
  });

  it("should reset to default", () => {
    const { result } = renderHook(() => useDashboardLayout("test", defaultCards));

    act(() => {
      result.current.toggleCard("agenda");
    });

    act(() => {
      result.current.resetToDefault();
    });

    expect(result.current.cards.every((c) => c.visible)).toBe(true);
  });

  it("should filter visibleCards", () => {
    const { result } = renderHook(() => useDashboardLayout("test", defaultCards));

    act(() => {
      result.current.toggleCard("finance");
    });

    expect(result.current.visibleCards).toHaveLength(2);
    expect(result.current.visibleCards.find((c) => c.id === "finance")).toBeUndefined();
  });
});
