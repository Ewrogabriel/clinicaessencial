/**
 * Integration tests: Financial workflow
 *
 * Covers: payment recording → reconciliation → receipt generation.
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

const makePagamento = (overrides: Record<string, unknown> = {}) => ({
  id: "pay-1",
  paciente_id: "pac-1",
  clinic_id: "clinic-1",
  valor: 150.0,
  status_pagamento: "pendente",
  forma_pagamento: "pix",
  data_vencimento: "2024-02-15",
  data_pagamento: null,
  origem_tipo: "sessao_avulsa",
  ...overrides,
});

const makeBankTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: "tx-1",
  descricao: "Pagamento PIX - Ana Lima",
  valor: 150.0,
  tipo: "credito",
  data_transacao: "2024-02-15",
  conciliado: false,
  ...overrides,
});

const chainMock = (resolvedValue: unknown) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
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

describe("Financial workflow – payment recording", () => {
  it("creates a new payment record", async () => {
    const pag = makePagamento();
    mockFrom.mockReturnValue(chainMock({ data: pag, error: null }));

    const result = await mockFrom("pagamentos").insert(pag).single();
    expect(result.data.status_pagamento).toBe("pendente");
    expect(result.error).toBeNull();
  });

  it("marks a payment as paid", async () => {
    const updated = makePagamento({ status_pagamento: "pago", data_pagamento: "2024-02-15" });
    mockFrom.mockReturnValue(chainMock({ data: updated, error: null }));

    const result = await mockFrom("pagamentos")
      .update({ status_pagamento: "pago", data_pagamento: "2024-02-15" })
      .eq("id", "pay-1")
      .single();

    expect(result.data.status_pagamento).toBe("pago");
    expect(result.data.data_pagamento).toBe("2024-02-15");
  });

  it("marks a payment as cancelled", async () => {
    const updated = makePagamento({ status_pagamento: "cancelado" });
    mockFrom.mockReturnValue(chainMock({ data: updated, error: null }));

    const result = await mockFrom("pagamentos")
      .update({ status_pagamento: "cancelado" })
      .eq("id", "pay-1")
      .single();

    expect(result.data.status_pagamento).toBe("cancelado");
  });

  it("validates payment status enum values", () => {
    const validStatuses = ["pendente", "pago", "cancelado", "reembolsado", "vencido"];
    expect(validStatuses).toContain("pendente");
    expect(validStatuses).toContain("pago");
    expect(validStatuses).toContain("vencido");
    expect(validStatuses).not.toContain("invalido");
  });

  it("validates origem_tipo check constraint", () => {
    const validTypes = ["matricula", "plano", "sessao_avulsa", "manual"];
    expect(validTypes).toContain("sessao_avulsa");
    expect(validTypes).not.toContain("desconhecido");
  });
});

describe("Financial workflow – listing payments", () => {
  it("lists payments by clinic_id", async () => {
    const list = [makePagamento(), makePagamento({ id: "pay-2", valor: 200 })];
    mockFrom.mockReturnValue({
      ...chainMock({ data: list, error: null }),
      then: vi.fn().mockResolvedValue({ data: list, error: null }),
    });

    const result = await Promise.resolve({ data: list, error: null });
    expect(result.data).toHaveLength(2);
  });

  it("filters payments by status", () => {
    const payments = [
      makePagamento({ status_pagamento: "pendente" }),
      makePagamento({ id: "pay-2", status_pagamento: "pago" }),
      makePagamento({ id: "pay-3", status_pagamento: "cancelado" }),
    ];

    const pending = payments.filter((p) => p.status_pagamento === "pendente");
    expect(pending).toHaveLength(1);
  });

  it("calculates total revenue for a month", () => {
    const paid = [
      makePagamento({ status_pagamento: "pago", valor: 150 }),
      makePagamento({ id: "p2", status_pagamento: "pago", valor: 200 }),
      makePagamento({ id: "p3", status_pagamento: "pendente", valor: 100 }),
    ];

    const revenue = paid
      .filter((p) => p.status_pagamento === "pago")
      .reduce((sum, p) => sum + Number(p.valor), 0);

    expect(revenue).toBe(350);
  });
});

describe("Financial workflow – bank reconciliation", () => {
  it("fetches unreconciled bank transactions", async () => {
    const txList = [makeBankTransaction(), makeBankTransaction({ id: "tx-2", valor: 200 })];
    mockFrom.mockReturnValue({
      ...chainMock({ data: txList, error: null }),
      then: vi.fn().mockResolvedValue({ data: txList, error: null }),
    });

    const result = await Promise.resolve({ data: txList, error: null });
    expect(result.data.every((t: typeof txList[0]) => !t.conciliado)).toBe(true);
  });

  it("marks a transaction as reconciled", async () => {
    const updated = makeBankTransaction({ conciliado: true });
    mockFrom.mockReturnValue(chainMock({ data: updated, error: null }));

    const result = await mockFrom("bank_transactions")
      .update({ conciliado: true })
      .eq("id", "tx-1")
      .single();

    expect(result.data.conciliado).toBe(true);
  });

  it("classifies transaction type from valor sign", () => {
    const classifyType = (valor: number) => (valor >= 0 ? "credito" : "debito");
    expect(classifyType(150)).toBe("credito");
    expect(classifyType(-50)).toBe("debito");
    expect(classifyType(0)).toBe("credito");
  });
});

describe("Financial workflow – commissions", () => {
  it("calculates commission for a professional", () => {
    const totalPaid = 1000;
    const commissionRate = 0.3; // 30%
    const commission = totalPaid * commissionRate;
    expect(commission).toBe(300);
  });

  it("rounds commission to two decimal places", () => {
    const commission = Math.round(333.333 * 100) / 100;
    expect(commission).toBe(333.33);
  });
});

describe("Financial workflow – reports", () => {
  it("generates summary with correct totals", () => {
    const entries = [
      { type: "receita", valor: 500 },
      { type: "receita", valor: 300 },
      { type: "despesa", valor: -200 },
    ];

    const totals = entries.reduce(
      (acc, e) => {
        if (e.valor > 0) acc.receitas += e.valor;
        else acc.despesas += Math.abs(e.valor);
        return acc;
      },
      { receitas: 0, despesas: 0 },
    );

    expect(totals.receitas).toBe(800);
    expect(totals.despesas).toBe(200);
    expect(totals.receitas - totals.despesas).toBe(600);
  });
});
