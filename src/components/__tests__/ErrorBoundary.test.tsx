import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ThrowError = ({ message = "Test error" }: { message?: string }) => {
  throw new Error(message);
};

describe("ErrorBoundary", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("should render children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("should render fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("should render custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom error")).toBeInTheDocument();
  });

  it("should show update UI and call window.location.reload on dynamic import error", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError message="Failed to fetch dynamically imported module: https://example.com/assets/PacienteAccess-abc.js" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Atualização disponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recarregar agora/i })).toBeInTheDocument();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("should detect other dynamic import error patterns", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError message="Importing a module script failed." />
      </ErrorBoundary>
    );

    expect(screen.getByText("Atualização disponível")).toBeInTheDocument();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
