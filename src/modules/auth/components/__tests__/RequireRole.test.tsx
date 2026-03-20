import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReactNode } from "react";

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const { mockUseAuth } = vi.hoisted(() => ({
    mockUseAuth: vi.fn(),
}));

vi.mock("@/modules/auth/hooks/useAuth", () => ({
    useAuth: mockUseAuth,
}));

import { RequireRole } from "../RequireRole";

// Helper: wraps component in MemoryRouter so <Navigate> works
const renderInRouter = (ui: ReactNode, { initialPath = "/" } = {}) =>
    render(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>);

describe("RequireRole", () => {
    it("renders nothing while auth is loading", () => {
        mockUseAuth.mockReturnValue({ roles: [], loading: true });

        const { container } = renderInRouter(
            <RequireRole roles={["admin"]}>
                <div>Admin content</div>
            </RequireRole>
        );

        expect(container.firstChild).toBeNull();
        expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
    });

    it("renders children when the user has a required role", () => {
        mockUseAuth.mockReturnValue({ roles: ["admin"], loading: false });

        renderInRouter(
            <RequireRole roles={["admin", "gestor"]}>
                <div>Protected content</div>
            </RequireRole>
        );

        expect(screen.getByText("Protected content")).toBeInTheDocument();
    });

    it("renders children when user has any one of multiple required roles", () => {
        mockUseAuth.mockReturnValue({ roles: ["gestor"], loading: false });

        renderInRouter(
            <RequireRole roles={["admin", "gestor", "master"]}>
                <div>Gestor content</div>
            </RequireRole>
        );

        expect(screen.getByText("Gestor content")).toBeInTheDocument();
    });

    it("redirects to /dashboard when user lacks the required role", () => {
        mockUseAuth.mockReturnValue({ roles: ["paciente"], loading: false });

        render(
            <MemoryRouter initialEntries={["/financeiro"]}>
                <RequireRole roles={["admin", "gestor"]}>
                    <div>Finance content</div>
                </RequireRole>
            </MemoryRouter>
        );

        expect(screen.queryByText("Finance content")).not.toBeInTheDocument();
    });

    it("redirects to custom redirectTo path when provided", () => {
        mockUseAuth.mockReturnValue({ roles: ["profissional"], loading: false });

        renderInRouter(
            <RequireRole roles={["master"]} redirectTo="/not-found">
                <div>Master content</div>
            </RequireRole>
        );

        expect(screen.queryByText("Master content")).not.toBeInTheDocument();
    });

    it("renders children for master role on a master-only route", () => {
        mockUseAuth.mockReturnValue({ roles: ["master"], loading: false });

        renderInRouter(
            <RequireRole roles={["master"]}>
                <div>Master panel</div>
            </RequireRole>
        );

        expect(screen.getByText("Master panel")).toBeInTheDocument();
    });

    it("denies access when required roles array is empty", () => {
        mockUseAuth.mockReturnValue({ roles: ["admin"], loading: false });

        renderInRouter(
            <RequireRole roles={[]}>
                <div>No roles required</div>
            </RequireRole>
        );

        expect(screen.queryByText("No roles required")).not.toBeInTheDocument();
    });
});
