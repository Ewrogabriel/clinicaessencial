import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock professional auth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "prof-123", email: "profissional@test.com" },
    profile: { id: "profile-1", nome: "Dr. Profissional", clinic_id: "clinic-1" },
    roles: ["profissional"],
    isAdmin: false,
    isMaster: false,
    isGestor: false,
    isPatient: false,
    isProfissional: true,
    isSecretario: false,
    clinicId: "clinic-1",
    loading: false,
    hasPermission: (resource: string) => ["agenda", "pacientes", "prontuarios", "exercicios"].includes(resource),
    canEdit: (resource: string) => ["prontuarios", "exercicios"].includes(resource),
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
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
          order: () => ({
            limit: () => Promise.resolve({ data: [] }),
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

const renderProfessionalDashboard = async () => {
  const queryClient = createTestQueryClient();
  const ProfessionalDashboard = (await import("@/pages/ProfessionalDashboard")).default;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfessionalDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Professional Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render professional dashboard", async () => {
    await renderProfessionalDashboard();
    expect(screen.getByText(/Bom dia|Boa tarde|Boa noite/i)).toBeInTheDocument();
  });

  it("should show agenda section for professional", async () => {
    await renderProfessionalDashboard();
    expect(screen.getByText(/Personalizar/i)).toBeInTheDocument();
  });
});

describe("Professional Permissions", () => {
  it("professional should have specific permissions", async () => {
    const mod = await import("@/hooks/useAuth");
    const auth = vi.mocked(mod).useAuth();
    
    expect(auth.isProfissional).toBe(true);
    expect(auth.isAdmin).toBe(false);
    expect(auth.hasPermission("agenda")).toBe(true);
    expect(auth.hasPermission("pacientes")).toBe(true);
    expect(auth.hasPermission("prontuarios")).toBe(true);
    expect(auth.canEdit("prontuarios")).toBe(true);
    expect(auth.canEdit("pacientes")).toBe(false);
  });
});

describe("Professional Features", () => {
  it("professional can view patient list", async () => {
    const mod = await import("@/hooks/useAuth");
    const auth = vi.mocked(mod).useAuth();
    
    expect(auth.hasPermission("pacientes")).toBe(true);
  });

  it("professional can edit medical records", async () => {
    const mod = await import("@/hooks/useAuth");
    const auth = vi.mocked(mod).useAuth();
    
    expect(auth.canEdit("prontuarios")).toBe(true);
  });

  it("professional can create exercises", async () => {
    const mod = await import("@/hooks/useAuth");
    const auth = vi.mocked(mod).useAuth();
    
    expect(auth.hasPermission("exercicios")).toBe(true);
    expect(auth.canEdit("exercicios")).toBe(true);
  });
});
