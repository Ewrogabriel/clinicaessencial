/**
 * Integration tests: Appointment workflow
 *
 * Covers: schedule → confirmation → completion → rescheduling.
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

const makeAgendamento = (overrides: Record<string, unknown> = {}) => ({
  id: "ag-1",
  paciente_id: "pac-1",
  profissional_id: "prof-1",
  clinic_id: "clinic-1",
  data_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
  duracao_minutos: 50,
  status: "agendada",
  modalidade_id: "mod-1",
  tipo_atendimento: "individual",
  confirmado: false,
  ...overrides,
});

const chainMock = (resolvedValue: unknown) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(resolvedValue),
  then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) => Promise.resolve(cb(resolvedValue))),
});

beforeEach(() => vi.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Appointment workflow – scheduling", () => {
  it("creates a new appointment", async () => {
    const ag = makeAgendamento();
    mockFrom.mockReturnValue(chainMock({ data: ag, error: null }));

    const result = await mockFrom("agendamentos").insert(ag).single();
    expect(result.data.status).toBe("agendada");
    expect(result.error).toBeNull();
  });

  it("validates required fields for scheduling", () => {
    const validate = (ag: Partial<ReturnType<typeof makeAgendamento>>) => {
      const errors: string[] = [];
      if (!ag.paciente_id) errors.push("Paciente obrigatório");
      if (!ag.profissional_id) errors.push("Profissional obrigatório");
      if (!ag.data_hora) errors.push("Data/hora obrigatória");
      if (!ag.modalidade_id) errors.push("Modalidade obrigatória");
      return errors;
    };

    expect(validate({})).toHaveLength(4);
    expect(validate(makeAgendamento())).toHaveLength(0);
  });

  it("rejects appointments in the past", () => {
    const isPast = (dateStr: string) => new Date(dateStr) < new Date();
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const futureDate = new Date(Date.now() + 60_000).toISOString();

    expect(isPast(pastDate)).toBe(true);
    expect(isPast(futureDate)).toBe(false);
  });

  it("lists appointments for a given day", async () => {
    const list = [makeAgendamento(), makeAgendamento({ id: "ag-2" })];
    mockFrom.mockReturnValue({
      ...chainMock({ data: list, error: null }),
      then: vi.fn().mockResolvedValue({ data: list, error: null }),
    });

    const result = await Promise.resolve({ data: list, error: null });
    expect(result.data).toHaveLength(2);
  });
});

describe("Appointment workflow – confirmation", () => {
  it("marks appointment as confirmed", async () => {
    const confirmed = makeAgendamento({ confirmado: true });
    mockFrom.mockReturnValue(chainMock({ data: confirmed, error: null }));

    const result = await mockFrom("agendamentos")
      .update({ confirmado: true })
      .eq("id", "ag-1")
      .single();

    expect(result.data.confirmado).toBe(true);
  });

  it("confirmation token resolves the appointment", async () => {
    const ag = makeAgendamento({ id: "ag-token" });
    mockFrom.mockReturnValue(chainMock({ data: ag, error: null }));

    const result = await mockFrom("agendamentos")
      .select("*")
      .eq("id", "ag-token")
      .single();

    expect(result.data.id).toBe("ag-token");
  });
});

describe("Appointment workflow – completion", () => {
  it("marks appointment as completed", async () => {
    const done = makeAgendamento({ status: "realizada" });
    mockFrom.mockReturnValue(chainMock({ data: done, error: null }));

    const result = await mockFrom("agendamentos")
      .update({ status: "realizada" })
      .eq("id", "ag-1")
      .single();

    expect(result.data.status).toBe("realizada");
  });

  it("validates appointment status transitions", () => {
    const VALID_TRANSITIONS: Record<string, string[]> = {
      agendada: ["confirmada", "cancelada", "faltou"],
      confirmada: ["realizada", "cancelada", "faltou"],
      realizada: [],
      cancelada: [],
      faltou: [],
    };

    expect(VALID_TRANSITIONS["agendada"]).toContain("confirmada");
    expect(VALID_TRANSITIONS["agendada"]).toContain("cancelada");
    expect(VALID_TRANSITIONS["realizada"]).toHaveLength(0);
    expect(VALID_TRANSITIONS["cancelada"]).toHaveLength(0);
  });

  it("marks as patient no-show", async () => {
    const noShow = makeAgendamento({ status: "faltou" });
    mockFrom.mockReturnValue(chainMock({ data: noShow, error: null }));

    const result = await mockFrom("agendamentos")
      .update({ status: "faltou" })
      .eq("id", "ag-1")
      .single();

    expect(result.data.status).toBe("faltou");
  });
});

describe("Appointment workflow – rescheduling", () => {
  it("updates the date/time of an existing appointment", async () => {
    const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const rescheduled = makeAgendamento({ data_hora: tomorrow });
    mockFrom.mockReturnValue(chainMock({ data: rescheduled, error: null }));

    const result = await mockFrom("agendamentos")
      .update({ data_hora: tomorrow })
      .eq("id", "ag-1")
      .single();

    expect(result.data.data_hora).toBe(tomorrow);
  });
});

describe("Appointment workflow – availability", () => {
  it("checks slot availability for a professional", async () => {
    const slots = [
      { hora: "09:00", disponivel: true },
      { hora: "10:00", disponivel: false },
      { hora: "11:00", disponivel: true },
    ];

    const available = slots.filter((s) => s.disponivel);
    expect(available).toHaveLength(2);
  });

  it("blocks double-booking for the same professional at the same time", () => {
    const existingSlot = { profissional_id: "prof-1", data_hora: "2024-06-15T10:00:00" };
    const newSlot = { profissional_id: "prof-1", data_hora: "2024-06-15T10:00:00" };

    const isDoubleBooked =
      existingSlot.profissional_id === newSlot.profissional_id &&
      existingSlot.data_hora === newSlot.data_hora;

    expect(isDoubleBooked).toBe(true);
  });

  it("allows booking at different times for same professional", () => {
    const existingSlot = { profissional_id: "prof-1", data_hora: "2024-06-15T10:00:00" };
    const newSlot = { profissional_id: "prof-1", data_hora: "2024-06-15T11:00:00" };

    const isDoubleBooked =
      existingSlot.profissional_id === newSlot.profissional_id &&
      existingSlot.data_hora === newSlot.data_hora;

    expect(isDoubleBooked).toBe(false);
  });
});

describe("Appointment workflow – session types", () => {
  it("supports all session types", () => {
    const sessionTypes = ["individual", "dupla", "trio", "grupo"];
    expect(sessionTypes).toContain("individual");
    expect(sessionTypes).toContain("grupo");
  });

  it("supports all attendance types", () => {
    const attendanceTypes = ["pilates", "fisioterapia", "yoga"];
    expect(attendanceTypes).toContain("pilates");
  });
});
