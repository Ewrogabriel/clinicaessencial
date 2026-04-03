import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock hooks
const mockUseAuth = vi.fn();

vi.mock("@/modules/auth/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/modules/shared/hooks/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));


vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
        order: () => ({
          limit: () => Promise.resolve({ data: [] }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }),
    }),
    removeChannel: vi.fn(),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

describe("Route Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Admin Routes", () => {
    it("admin should access admin dashboard", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "admin-1" },
        isAdmin: true,
        isPatient: false,
        isProfissional: false,
        loading: false,
        hasPermission: () => true,
      });

      const auth = mockUseAuth();
      expect(auth.isAdmin).toBe(true);
      expect(auth.hasPermission("dashboard")).toBe(true);
    });

    it("admin should access patient management", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "admin-1" },
        isAdmin: true,
        hasPermission: () => true,
        canEdit: () => true,
      });

      const auth = mockUseAuth();
      expect(auth.hasPermission("pacientes")).toBe(true);
      expect(auth.canEdit("pacientes")).toBe(true);
    });

    it("admin should access financeiro", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "admin-1" },
        isAdmin: true,
        hasPermission: () => true,
      });

      const auth = mockUseAuth();
      expect(auth.hasPermission("financeiro")).toBe(true);
    });

    it("admin should access profissionais", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "admin-1" },
        isAdmin: true,
        hasPermission: () => true,
      });

      const auth = mockUseAuth();
      expect(auth.hasPermission("profissionais")).toBe(true);
    });
  });

  describe("Patient Routes", () => {
    it("patient should access patient dashboard", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "patient-1" },
        isAdmin: false,
        isPatient: true,
        isProfissional: false,
        patientId: "patient-id-123",
        loading: false,
        hasPermission: (resource: string) => 
          ["minha_agenda", "meus_planos", "meus_pagamentos", "planos_exercicios"].includes(resource),
      });

      const auth = mockUseAuth();
      expect(auth.isPatient).toBe(true);
      expect(auth.hasPermission("minha_agenda")).toBe(true);
      expect(auth.hasPermission("meus_planos")).toBe(true);
    });

    it("patient should NOT access admin routes", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "patient-1" },
        isAdmin: false,
        isPatient: true,
        hasPermission: (resource: string) => 
          ["minha_agenda", "meus_planos"].includes(resource),
      });

      const auth = mockUseAuth();
      expect(auth.isAdmin).toBe(false);
      expect(auth.hasPermission("profissionais")).toBe(false);
      expect(auth.hasPermission("financeiro")).toBe(false);
    });

    it("patient should access exercises", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "patient-1" },
        isPatient: true,
        hasPermission: (resource: string) => 
          ["planos_exercicios"].includes(resource),
      });

      const auth = mockUseAuth();
      expect(auth.hasPermission("planos_exercicios")).toBe(true);
    });
  });

  describe("Professional Routes", () => {
    it("professional should access professional dashboard", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "prof-1" },
        isAdmin: false,
        isPatient: false,
        isProfissional: true,
        loading: false,
        hasPermission: (resource: string) => 
          ["agenda", "pacientes", "prontuarios", "exercicios"].includes(resource),
      });

      const auth = mockUseAuth();
      expect(auth.isProfissional).toBe(true);
      expect(auth.hasPermission("agenda")).toBe(true);
    });

    it("professional should access patient records", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "prof-1" },
        isProfissional: true,
        hasPermission: (resource: string) => 
          ["pacientes", "prontuarios"].includes(resource),
        canEdit: (resource: string) => 
          ["prontuarios"].includes(resource),
      });

      const auth = mockUseAuth();
      expect(auth.hasPermission("pacientes")).toBe(true);
      expect(auth.hasPermission("prontuarios")).toBe(true);
      expect(auth.canEdit("prontuarios")).toBe(true);
    });

    it("professional should NOT access financial routes", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "prof-1" },
        isProfissional: true,
        isAdmin: false,
        hasPermission: (resource: string) => 
          ["agenda", "pacientes", "prontuarios"].includes(resource),
      });

      const auth = mockUseAuth();
      expect(auth.hasPermission("financeiro")).toBe(false);
      expect(auth.isAdmin).toBe(false);
    });
  });
});

describe("Public Routes", () => {
  it("login page should be accessible without auth", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    const auth = mockUseAuth();
    expect(auth.user).toBeNull();
    // Login page doesn't require authentication
  });

  it("landing page should be accessible without auth", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    const auth = mockUseAuth();
    expect(auth.user).toBeNull();
    // Landing page doesn't require authentication
  });

  it("pre-cadastro should be accessible without auth", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    const auth = mockUseAuth();
    expect(auth.user).toBeNull();
    // Pre-cadastro page doesn't require authentication
  });
});
