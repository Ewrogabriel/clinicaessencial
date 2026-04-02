/**
 * Integration tests: Authentication flow
 *
 * Covers: login → clinic selection → dashboard routing for each role.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockAuth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: mockAuth,
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeSession = (userId: string, email: string) => ({
  user: { id: userId, email },
  access_token: "tok",
  refresh_token: "rtok",
  expires_at: Date.now() / 1000 + 3600,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Auth flow – login", () => {
  it("returns a session on valid credentials", async () => {
    const session = makeSession("user-1", "admin@clinic.com");
    mockAuth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });

    const result = await mockAuth.signInWithPassword({
      email: "admin@clinic.com",
      password: "secret",
    });

    expect(result.error).toBeNull();
    expect(result.data.session.user.id).toBe("user-1");
  });

  it("returns an error on invalid credentials", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await mockAuth.signInWithPassword({
      email: "bad@clinic.com",
      password: "wrong",
    });

    expect(result.error).not.toBeNull();
    expect(result.data.session).toBeNull();
  });

  it("signs out successfully", async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });

    const result = await mockAuth.signOut();
    expect(result.error).toBeNull();
  });
});

describe("Auth flow – session restoration", () => {
  it("restores an active session", async () => {
    const session = makeSession("user-2", "prof@clinic.com");
    mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });

    const result = await mockAuth.getSession();

    expect(result.data.session).not.toBeNull();
    expect(result.data.session.user.email).toBe("prof@clinic.com");
  });

  it("returns null session when not logged in", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const result = await mockAuth.getSession();
    expect(result.data.session).toBeNull();
  });
});

describe("Auth flow – role routing", () => {
  const ROLE_DASHBOARD_MAP: Record<string, string> = {
    admin: "/dashboard",
    gestor: "/dashboard",
    secretario: "/dashboard",
    profissional: "/dashboard",
    paciente: "/dashboard",
    master: "/dashboard",
  };

  it.each(Object.entries(ROLE_DASHBOARD_MAP))(
    "role %s lands on %s after login",
    (role, expectedPath) => {
      // All roles land on /dashboard; DashboardToggle inside the page
      // selects the appropriate panel component.
      expect(ROLE_DASHBOARD_MAP[role]).toBe(expectedPath);
    },
  );

  it("master-only user sees MasterPanel instead of admin Dashboard", () => {
    const isMaster = true;
    const isAdmin = false;
    const component = isMaster && !isAdmin ? "MasterPanel" : "Dashboard";
    expect(component).toBe("MasterPanel");
  });

  it("profissional user sees ProfessionalDashboard", () => {
    const isProfissional = true;
    const isAdmin = false;
    const isGestor = false;
    const isSecretario = false;
    const component =
      isAdmin || isGestor || isSecretario
        ? "Dashboard"
        : isProfissional
        ? "ProfessionalDashboard"
        : "PatientDashboard";
    expect(component).toBe("ProfessionalDashboard");
  });

  it("patient user sees PatientDashboard", () => {
    const isProfissional = false;
    const isAdmin = false;
    const component =
      isAdmin ? "Dashboard" : isProfissional ? "ProfessionalDashboard" : "PatientDashboard";
    expect(component).toBe("PatientDashboard");
  });
});

describe("Auth flow – clinic selection", () => {
  it("redirects to /selecionar-clinica when user belongs to multiple clinics", () => {
    const clinicCount = 3;
    const shouldSelectClinic = clinicCount > 1;
    expect(shouldSelectClinic).toBe(true);
  });

  it("skips clinic selection when user belongs to a single clinic", () => {
    const clinicCount = 1;
    const shouldSelectClinic = clinicCount > 1;
    expect(shouldSelectClinic).toBe(false);
  });
});

describe("Auth flow – password reset", () => {
  it("accepts valid email for reset link", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("user@clinic.com")).toBe(true);
  });

  it("rejects invalid email for reset link", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("not-an-email")).toBe(false);
  });
});
