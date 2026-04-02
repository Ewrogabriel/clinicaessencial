/**
 * Unit tests for statementImportService – parsing logic only.
 * DB calls are mocked out.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { statementImportService } from "../statementImportService";

// Polyfill File.prototype.text for jsdom (it doesn't ship with it)
beforeAll(() => {
  if (!File.prototype.text) {
    File.prototype.text = function () {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsText(this);
      });
    };
  }
});

// Mock supabase so save tests don't hit a real DB
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

vi.mock("@/modules/shared/utils/errorHandler", () => ({
  handleError: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(content: string, name: string): File {
  return new File([content], name, { type: "text/plain" });
}

// ── parseCSV (via parseFile) ──────────────────────────────────────────────────

describe("statementImportService.parseFile – CSV", () => {
  it("parses a well-formed CSV with Brazilian date and value formats", async () => {
    const csv = [
      "data;descricao;valor",
      "15/03/2024;Pagamento PIX;-150,00",
      "20/03/2024;Recebimento TED;3.000,50",
    ].join("\n");

    const result = await statementImportService.parseFile(makeFile(csv, "extrato.csv"));

    expect(result).toHaveLength(2);
    expect(result[0].data_transacao).toBe("2024-03-15");
    expect(result[0].valor).toBe(-150);
    expect(result[0].descricao).toBe("Pagamento PIX");

    expect(result[1].data_transacao).toBe("2024-03-20");
    expect(result[1].valor).toBeCloseTo(3000.5, 2);
  });

  it("parses a CSV with ISO date and comma-separated values", async () => {
    const csv = [
      "date,description,amount",
      "2024-01-10,Transfer in,500.00",
      "2024-01-15,Fee,-12.50",
    ].join("\n");

    const result = await statementImportService.parseFile(makeFile(csv, "bank.csv"));

    expect(result).toHaveLength(2);
    expect(result[0].data_transacao).toBe("2024-01-10");
    expect(result[0].valor).toBe(500);
    expect(result[1].valor).toBe(-12.5);
  });

  it("skips rows with missing required fields", async () => {
    const csv = [
      "data;descricao;valor",
      "01/01/2024;;100,00",   // empty description
      ";Sem data;50,00",       // empty date
      "02/01/2024;OK;200,00",
    ].join("\n");

    const result = await statementImportService.parseFile(makeFile(csv, "extrato.csv"));
    expect(result).toHaveLength(1);
    expect(result[0].descricao).toBe("OK");
  });

  it("returns empty array for CSV with only headers", async () => {
    const csv = "data;descricao;valor\n";
    const result = await statementImportService.parseFile(makeFile(csv, "empty.csv"));
    expect(result).toHaveLength(0);
  });

  it("throws for an unrecognised CSV column layout", async () => {
    const csv = "foo;bar;baz\n1;2;3\n";
    await expect(
      statementImportService.parseFile(makeFile(csv, "bad.csv"))
    ).rejects.toThrow();
  });

  it("infers tipo from valor sign", async () => {
    const csv = [
      "data;descricao;valor",
      "01/01/2024;Credit;100,00",
      "02/01/2024;Debit;-50,00",
    ].join("\n");

    const result = await statementImportService.parseFile(makeFile(csv, "extrato.csv"));
    expect(result[0].tipo).toBe("credito");
    expect(result[1].tipo).toBe("debito");
  });
});

// ── parseOFX (via parseFile) ──────────────────────────────────────────────────

describe("statementImportService.parseFile – OFX", () => {
  const sampleOFX = `
<OFX>
<STMTTRN>
<DTPOSTED>20240315
<TRNAMT>-200.00
<MEMO>Pagamento Boleto
<CHECKNUM>12345
</STMTTRN>
<STMTTRN>
<DTPOSTED>20240320120000
<TRNAMT>1500.00
<MEMO>Recebimento TED
</STMTTRN>
</OFX>`;

  it("parses OFX transactions correctly", async () => {
    const result = await statementImportService.parseFile(makeFile(sampleOFX, "extrato.ofx"));

    expect(result).toHaveLength(2);
    expect(result[0].data_transacao).toBe("2024-03-15");
    expect(result[0].valor).toBe(-200);
    expect(result[0].descricao).toBe("Pagamento Boleto");
    expect(result[0].documento).toBe("12345");

    expect(result[1].data_transacao).toBe("2024-03-20");
    expect(result[1].valor).toBe(1500);
  });

  it("parses QFX files the same way as OFX", async () => {
    const result = await statementImportService.parseFile(makeFile(sampleOFX, "extrato.qfx"));
    expect(result).toHaveLength(2);
  });
});

// ── validateTransactions ──────────────────────────────────────────────────────

describe("statementImportService.validateTransactions", () => {
  it("separates valid from invalid rows", () => {
    const txs = [
      { data_transacao: "2024-01-01", descricao: "OK", valor: 100 },
      { data_transacao: "", descricao: "Bad date", valor: 50 },
      { data_transacao: "2024-01-03", descricao: "", valor: 200 },
      { data_transacao: "2024-01-04", descricao: "NaN val", valor: NaN },
    ];

    const result = statementImportService.validateTransactions(txs as any);

    expect(result.total).toBe(4);
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(3);
  });
});

// ── parseFile – unsupported format ────────────────────────────────────────────

describe("statementImportService.parseFile – unsupported formats", () => {
  it("throws for Excel files with a helpful message", async () => {
    await expect(
      statementImportService.parseFile(makeFile("", "extrato.xlsx"))
    ).rejects.toThrow(/Excel/i);
  });

  it("throws for completely unknown extensions", async () => {
    await expect(
      statementImportService.parseFile(makeFile("", "file.pdf"))
    ).rejects.toThrow(/suportado/i);
  });
});
