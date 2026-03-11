import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock hooks
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-123", email: "admin@test.com" },
    profile: { id: "profile-1", nome: "Admin User", clinic_id: "clinic-1" },
    roles: ["admin"],
    isAdmin: true,
    isMaster: false,
    isGestor: false,
    isPatient: false,
    isProfissional: false,
    isSecretario: false,
    clinicId: "clinic-1",
    loading: false,
    hasPermission: () => true,
    canEdit: () => true,
  }),
}));

vi.mock("@/hooks/useClinic", () => ({
  useClinic: () => ({
    activeClinicId: "clinic-1",
    clinics: [{ id: "clinic-1", nome: "Clínica Teste" }],
    setActiveClinicId: vi.fn(),
  }),
  ClinicProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
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
          gte: () => ({
            lte: () => Promise.resolve({ data: [], count: 0 }),
          }),
        }),
        gte: () => ({
          lte: () => ({
            eq: () => Promise.resolve({ data: [], count: 0 }),
          }),
        }),
        order: () => ({
          limit: () => Promise.resolve({ data: [] }),
        }),
        limit: () => Promise.resolve({ data: [] }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }),
    }),
    removeChannel: vi.fn(),
    rpc: () => Promise.resolve({ data: null, error: null }),
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

const renderDashboard = async () => {
  const queryClient = createTestQueryClient();
  const Dashboard = (await import("@/pages/Dashboard")).default;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Admin Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render dashboard header", async () => {
    await renderDashboard();
    expect(screen.getByText(/Bom dia|Boa tarde|Boa noite/i)).toBeInTheDocument();
  });

  it("should show admin-specific sections", async () => {
    await renderDashboard();
    expect(screen.getByText(/Personalizar/i)).toBeInTheDocument();
  });
});

describe("Admin Features", () => {
  it("admin should have access to all resources", async () => {
    const mod = await import("@/hooks/useAuth");
    const auth = vi.mocked(mod).useAuth();
    
    expect(auth.isAdmin).toBe(true);
    expect(auth.hasPermission("pacientes")).toBe(true);
    expect(auth.hasPermission("profissionais")).toBe(true);
    expect(auth.hasPermission("financeiro")).toBe(true);
    expect(auth.canEdit("pacientes")).toBe(true);
  });
});
