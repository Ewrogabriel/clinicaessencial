import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";

// Must use vi.hoisted so mocks are available in vi.mock factory
const { mockSupabaseAuth, mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseAuth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
  mockSupabaseFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: mockSupabaseAuth,
    from: mockSupabaseFrom,
  },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("useAuth Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockSupabaseAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  describe("Initial State", () => {
    it("should return initial state when not authenticated", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.roles).toEqual([]);
    });

    it("should throw error when used outside AuthProvider", () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow("useAuth deve ser usado dentro de um AuthProvider");
    });
  });

  describe("Role Checks", () => {
    it("should correctly identify admin role", async () => {
      const mockUser = { id: "user-123", email: "admin@test.com" };
      const mockSession = { user: mockUser };

      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: mockSession } });
      mockSupabaseAuth.onAuthStateChange.mockImplementation((callback) => {
        callback("SIGNED_IN", mockSession);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockSupabaseFrom.mockImplementation((table) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: "profile-1", user_id: "user-123" } }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [{ role: "admin" }] }),
            }),
          };
        }
        if (table === "user_permissions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [] }),
              }),
            }),
          };
        }
        if (table === "pacientes") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true);
      });
    });

    it("should correctly identify patient role", async () => {
      const mockUser = { id: "user-456", email: "patient@test.com" };
      const mockSession = { user: mockUser };

      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: mockSession } });
      mockSupabaseAuth.onAuthStateChange.mockImplementation((callback) => {
        callback("SIGNED_IN", mockSession);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockSupabaseFrom.mockImplementation((table) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: "profile-2", user_id: "user-456" } }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [{ role: "paciente" }] }),
            }),
          };
        }
        if (table === "user_permissions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [] }),
              }),
            }),
          };
        }
        if (table === "pacientes") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: "patient-123" } }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.isPatient).toBe(true);
      });
    });

    it("should correctly identify professional role", async () => {
      const mockUser = { id: "user-789", email: "prof@test.com" };
      const mockSession = { user: mockUser };

      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: mockSession } });
      mockSupabaseAuth.onAuthStateChange.mockImplementation((callback) => {
        callback("SIGNED_IN", mockSession);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockSupabaseFrom.mockImplementation((table) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: "profile-3", user_id: "user-789" } }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [{ role: "profissional" }] }),
            }),
          };
        }
        if (table === "user_permissions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [] }),
              }),
            }),
          };
        }
        if (table === "pacientes") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.isProfissional).toBe(true);
      });
    });
  });

  describe("Authentication Actions", () => {
    it("should call signIn with correct credentials", async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signIn("test@test.com", "password123");

      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
      });
    });

    it("should call signOut", async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signOut();

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });

    it("should call resetPassword", async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.resetPassword("test@test.com");

      expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith("test@test.com", {
        redirectTo: expect.stringContaining("/reset-password"),
      });
    });
  });

  describe("Permissions", () => {
    it("admin should have all permissions", async () => {
      const mockUser = { id: "admin-user", email: "admin@test.com" };
      const mockSession = { user: mockUser };

      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: mockSession } });
      mockSupabaseAuth.onAuthStateChange.mockImplementation((callback) => {
        callback("SIGNED_IN", mockSession);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockSupabaseFrom.mockImplementation((table) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: "profile-admin" } }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [{ role: "admin" }] }),
            }),
          };
        }
        if (table === "user_permissions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [] }),
              }),
            }),
          };
        }
        if (table === "pacientes") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true);
      });

      expect(result.current.hasPermission("any_resource")).toBe(true);
      expect(result.current.canEdit("any_resource")).toBe(true);
    });
  });
});
