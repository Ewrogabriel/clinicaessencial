import { describe, it, expect, vi } from "vitest";
import { reportingService } from "../reportingService";
import type { ReconciliationReport } from "../reportingService";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/modules/shared/utils/errorHandler", () => ({
  handleError: vi.fn(),
}));

function makeReport(overrides: Partial<ReconciliationReport> = {}): ReconciliationReport {
  return {
    rows: [
      {
        id: "1",
        data_transacao: "2026-04-01",
        descricao: "Test",
        valor: 100,
        tipo: "credito",
        status: "conciliado",
        categoria: null,
        banco: "Banco A",
        pagamento_id: null,
        data_conciliacao: "2026-04-02",
      },
      {
        id: "2",
        data_transacao: "2026-04-02",
        descricao: "Test 2",
        valor: 200,
        tipo: "debito",
        status: "pendente",
        categoria: "aluguel",
        banco: "Banco A",
        pagamento_id: null,
        data_conciliacao: null,
      },
    ],
    summary: {
      total: 2,
      conciliados: 1,
      pendentes: 1,
      rejeitados: 0,
      totalValue: 300,
      reconciledValue: 100,
      taxaReconciliacao: 50,
    },
    period: { from: "2026-04-01", to: "2026-04-30" },
    ...overrides,
  };
}

describe("reportingService", () => {
  describe("exportCSV", () => {
    it("generates valid CSV with header row", () => {
      const report = makeReport();
      const csv = reportingService.exportCSV(report);
      const lines = csv.split("\n");
      expect(lines[0]).toContain("ID");
      expect(lines[0]).toContain("Data");
      expect(lines[0]).toContain("Valor");
      expect(lines).toHaveLength(3); // header + 2 rows
    });

    it("escapes double quotes in description", () => {
      const report = makeReport({
        rows: [
          {
            id: "1",
            data_transacao: "2026-04-01",
            descricao: 'Desc with "quotes"',
            valor: 100,
            tipo: "credito",
            status: "conciliado",
            categoria: null,
            banco: "Banco",
            pagamento_id: null,
            data_conciliacao: null,
          },
        ],
      });
      const csv = reportingService.exportCSV(report);
      expect(csv).toContain('""quotes""');
    });
  });

  describe("exportJSON", () => {
    it("generates valid JSON", () => {
      const report = makeReport();
      const json = reportingService.exportJSON(report);
      const parsed = JSON.parse(json);
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.summary.total).toBe(2);
    });
  });
});
