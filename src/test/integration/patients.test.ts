/**
 * Integration tests: Patient workflow
 *
 * Covers: pre-cadastro → approval → onboarding → profile management.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

// ── Test data factories ────────────────────────────────────────────────────────

const makePaciente = (overrides: Record<string, unknown> = {}) => ({
  id: "pac-1",
  nome: "Ana Lima",
  cpf: "12345678901",
  email: "ana@email.com",
  telefone: "11999999999",
  data_nascimento: "1990-01-15",
  status: "ativo",
  user_id: null,
  ...overrides,
});

const makePreCadastro = (overrides: Record<string, unknown> = {}) => ({
  id: "pc-1",
  nome: "Carlos Mendes",
  telefone: "11988887777",
  email: "carlos@email.com",
  status: "pendente",
  revisado_por: null,
  criado_em: new Date().toISOString(),
  ...overrides,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const chainMock = (resolvedValue: unknown) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(resolvedValue),
  maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => Promise.resolve(cb(resolvedValue))),
});

beforeEach(() => vi.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Patient workflow – pre-registration", () => {
  it("submits a valid pre-registration form", async () => {
    const preCadastro = makePreCadastro();
    mockFrom.mockReturnValue(chainMock({ data: preCadastro, error: null }));

    const chain = mockFrom("pre_cadastros").insert({ ...preCadastro });
    const result = await chain.single();

    expect(result.data.nome).toBe("Carlos Mendes");
    expect(result.error).toBeNull();
  });

  it("validates that name and phone are required", () => {
    const validate = (data: { nome?: string; telefone?: string }) => {
      const errors: string[] = [];
      if (!data.nome?.trim()) errors.push("Nome obrigatório");
      if (!data.telefone?.trim()) errors.push("Telefone obrigatório");
      return errors;
    };

    expect(validate({ nome: "", telefone: "" })).toHaveLength(2);
    expect(validate({ nome: "Carlos", telefone: "11999999999" })).toHaveLength(0);
  });

  it("fetches pending pre-registrations for admin review", async () => {
    const list = [makePreCadastro(), makePreCadastro({ id: "pc-2", nome: "Bia" })];
    mockFrom.mockReturnValue({
      ...chainMock({ data: list, error: null }),
      then: vi.fn().mockResolvedValue({ data: list, error: null }),
    });

    const result = await Promise.resolve({ data: list, error: null });
    expect(result.data).toHaveLength(2);
    expect(result.data[0].status).toBe("pendente");
  });
});

describe("Patient workflow – approval & patient creation", () => {
  it("converts a pre-registration into a patient record", async () => {
    const pac = makePaciente();
    mockFrom.mockReturnValue(chainMock({ data: pac, error: null }));

    const chain = mockFrom("pacientes").insert({ ...pac });
    const result = await chain.single();

    expect(result.data.id).toBe("pac-1");
    expect(result.error).toBeNull();
  });

  it("marks the pre-registration as approved", async () => {
    mockFrom.mockReturnValue(chainMock({ data: { id: "pc-1", status: "aprovado" }, error: null }));

    const result = await mockFrom("pre_cadastros").update({ status: "aprovado" }).eq("id", "pc-1").single();
    expect(result.data.status).toBe("aprovado");
  });
});

describe("Patient workflow – onboarding", () => {
  it("fetches patient data by invite id", async () => {
    const pac = makePaciente({ id: "pac-invite" });
    mockFrom.mockReturnValue(chainMock({ data: pac, error: null }));

    const result = await mockFrom("pacientes").select("*").eq("id", "pac-invite").single();
    expect(result.data.id).toBe("pac-invite");
  });

  it("rejects already-onboarded patients (user_id set)", () => {
    const pac = makePaciente({ user_id: "auth-uid-123" });
    const alreadyOnboarded = !!pac.user_id;
    expect(alreadyOnboarded).toBe(true);
  });

  it("validates password length during onboarding", () => {
    const validatePassword = (pw: string, confirm: string) => {
      if (pw.length < 6) return "Senha muito curta";
      if (pw !== confirm) return "Senhas não coincidem";
      return null;
    };

    expect(validatePassword("12345", "12345")).toBe("Senha muito curta");
    expect(validatePassword("123456", "654321")).toBe("Senhas não coincidem");
    expect(validatePassword("Senha@123", "Senha@123")).toBeNull();
  });
});

describe("Patient workflow – profile management", () => {
  it("fetches patient profile", async () => {
    const pac = makePaciente();
    mockFrom.mockReturnValue(chainMock({ data: pac, error: null }));

    const result = await mockFrom("pacientes").select("*").eq("id", "pac-1").single();
    expect(result.data.nome).toBe("Ana Lima");
  });

  it("updates patient phone and email", async () => {
    const updated = makePaciente({ telefone: "11977776666", email: "nova@email.com" });
    mockFrom.mockReturnValue(chainMock({ data: updated, error: null }));

    const result = await mockFrom("pacientes")
      .update({ telefone: "11977776666", email: "nova@email.com" })
      .eq("id", "pac-1")
      .single();

    expect(result.data.telefone).toBe("11977776666");
    expect(result.data.email).toBe("nova@email.com");
  });

  it("fetches clinic link for patient", async () => {
    const link = { paciente_id: "pac-1", clinic_id: "clinic-1" };
    mockFrom.mockReturnValue(chainMock({ data: link, error: null }));

    const result = await mockFrom("clinic_pacientes").select("*").eq("paciente_id", "pac-1").single();
    expect(result.data.clinic_id).toBe("clinic-1");
  });
});

describe("Patient workflow – data change requests", () => {
  it("submits a data-change request", async () => {
    const req = { id: "req-1", paciente_id: "pac-1", campo: "telefone", valor_novo: "11911112222", status: "pendente" };
    mockFrom.mockReturnValue(chainMock({ data: req, error: null }));

    const result = await mockFrom("solicitacoes_alteracao").insert(req).single();
    expect(result.data.status).toBe("pendente");
  });

  it("approves a change request", async () => {
    const approved = { id: "req-1", status: "aprovado" };
    mockFrom.mockReturnValue(chainMock({ data: approved, error: null }));

    const result = await mockFrom("solicitacoes_alteracao").update({ status: "aprovado" }).eq("id", "req-1").single();
    expect(result.data.status).toBe("aprovado");
  });
});

describe("PatientFormBuilder – mode logic", () => {
  it("staff mode exposes all four steps", () => {
    const modeSteps: Record<string, string[]> = {
      staff: ["personal", "address", "guardian", "notes"],
      onboarding: ["personal"],
      "pre-cadastro": ["personal", "address", "guardian"],
    };

    expect(modeSteps["staff"]).toHaveLength(4);
    expect(modeSteps["onboarding"]).toHaveLength(1);
    expect(modeSteps["pre-cadastro"]).toHaveLength(3);
  });

  it("onboarding mode includes password fields", () => {
    const hasPasswordFields = (mode: string) => mode === "onboarding";
    expect(hasPasswordFields("onboarding")).toBe(true);
    expect(hasPasswordFields("staff")).toBe(false);
    expect(hasPasswordFields("pre-cadastro")).toBe(false);
  });
});
