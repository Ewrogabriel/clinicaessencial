import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn().mockReturnValue([]),
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const newArr = [...arr];
    const [item] = newArr.splice(from, 1);
    newArr.splice(to, 0, item);
    return newArr;
  },
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}));

import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import type { DashboardCard } from "@/modules/shared/hooks/useDashboardLayout";

describe("DashboardCustomizer Component", () => {
  const mockCards: DashboardCard[] = [
    { id: "sessoes", label: "Próximas Sessões", visible: true },
    { id: "exercicios", label: "Exercícios", visible: true },
    { id: "pagamentos", label: "Pagamentos", visible: false },
  ];

  const mockOnReorder = vi.fn();
  const mockOnToggle = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render customize button", () => {
    render(
      <DashboardCustomizer
        cards={mockCards}
        onReorder={mockOnReorder}
        onToggle={mockOnToggle}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText("Personalizar")).toBeInTheDocument();
  });

  it("should open dialog when button is clicked", async () => {
    render(
      <DashboardCustomizer
        cards={mockCards}
        onReorder={mockOnReorder}
        onToggle={mockOnToggle}
        onReset={mockOnReset}
      />
    );

    fireEvent.click(screen.getByText("Personalizar"));

    expect(screen.getByText("Personalizar Dashboard")).toBeInTheDocument();
  });

  it("should display all cards in the customizer", async () => {
    render(
      <DashboardCustomizer
        cards={mockCards}
        onReorder={mockOnReorder}
        onToggle={mockOnToggle}
        onReset={mockOnReset}
      />
    );

    fireEvent.click(screen.getByText("Personalizar"));

    expect(screen.getByText("Próximas Sessões")).toBeInTheDocument();
    expect(screen.getByText("Exercícios")).toBeInTheDocument();
    expect(screen.getByText("Pagamentos")).toBeInTheDocument();
  });

  it("should have save button in dialog", async () => {
    render(
      <DashboardCustomizer
        cards={mockCards}
        onReorder={mockOnReorder}
        onToggle={mockOnToggle}
        onReset={mockOnReset}
      />
    );

    fireEvent.click(screen.getByText("Personalizar"));

    expect(screen.getByText("Salvar")).toBeInTheDocument();
  });

  it("should have reset button in dialog", async () => {
    render(
      <DashboardCustomizer
        cards={mockCards}
        onReorder={mockOnReorder}
        onToggle={mockOnToggle}
        onReset={mockOnReset}
      />
    );

    fireEvent.click(screen.getByText("Personalizar"));

    expect(screen.getByText("Restaurar Padrão")).toBeInTheDocument();
  });

  it("should call onReset when reset button is clicked", async () => {
    render(
      <DashboardCustomizer
        cards={mockCards}
        onReorder={mockOnReorder}
        onToggle={mockOnToggle}
        onReset={mockOnReset}
      />
    );

    fireEvent.click(screen.getByText("Personalizar"));
    fireEvent.click(screen.getByText("Restaurar Padrão"));

    expect(mockOnReset).toHaveBeenCalled();
  });

  it("should call onReorder when save is clicked", async () => {
    render(
      <DashboardCustomizer
        cards={mockCards}
        onReorder={mockOnReorder}
        onToggle={mockOnToggle}
        onReset={mockOnReset}
      />
    );

    fireEvent.click(screen.getByText("Personalizar"));
    fireEvent.click(screen.getByText("Salvar"));

    expect(mockOnReorder).toHaveBeenCalled();
  });
});
