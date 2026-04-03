import { describe, it, expect } from "vitest";
import { detectLocalAnomalies } from "../anomalyDetectionService";
import type { BankTransactionRow } from "../bankTransactionService";

function makeTx(overrides: Partial<BankTransactionRow> = {}): BankTransactionRow {
  return {
    id: "tx-1",
    clinic_id: "clinic-1",
    bank_account_id: "acc-1",
    data_transacao: new Date().toISOString().split("T")[0],
    descricao: "Test transaction",
    valor: 100,
    tipo: "credito",
    categoria: null,
    documento: null,
    saldo: null,
    status: "pendente",
    pagamento_id: null,
    observacoes: null,
    data_conciliacao: null,
    import_batch_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("anomalyDetectionService – detectLocalAnomalies", () => {
  it("returns empty record when no transactions", () => {
    const result = detectLocalAnomalies([]);
    expect(result).toEqual({});
  });

  it("detects duplicate transactions (same value, same day, same type)", () => {
    const tx1 = makeTx({ id: "tx-1", valor: 100, data_transacao: "2026-04-01", tipo: "credito" });
    const tx2 = makeTx({ id: "tx-2", valor: 100, data_transacao: "2026-04-01", tipo: "credito" });
    const result = detectLocalAnomalies([tx1, tx2]);
    expect(result["tx-1"]).toBeDefined();
    expect(result["tx-1"].some((a) => a.anomaly_type === "duplicate")).toBe(true);
    expect(result["tx-2"]).toBeDefined();
    expect(result["tx-2"].some((a) => a.anomaly_type === "duplicate")).toBe(true);
  });

  it("does not flag different values as duplicates", () => {
    const tx1 = makeTx({ id: "tx-1", valor: 100, data_transacao: "2026-04-01", tipo: "credito" });
    const tx2 = makeTx({ id: "tx-2", valor: 200, data_transacao: "2026-04-01", tipo: "credito" });
    const result = detectLocalAnomalies([tx1, tx2]);
    const dupes = Object.values(result).flat().filter((a) => a.anomaly_type === "duplicate");
    expect(dupes).toHaveLength(0);
  });

  it("detects unreconciled transaction older than 30 days", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);
    const tx = makeTx({
      id: "tx-old",
      data_transacao: oldDate.toISOString().split("T")[0],
      status: "pendente",
    });
    const result = detectLocalAnomalies([tx]);
    expect(result["tx-old"]).toBeDefined();
    expect(result["tx-old"].some((a) => a.anomaly_type === "unreconciled")).toBe(true);
  });

  it("detects orphan transaction older than 15 days (no payment link)", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 20);
    const tx = makeTx({
      id: "tx-orphan",
      data_transacao: oldDate.toISOString().split("T")[0],
      status: "pendente",
      pagamento_id: null,
    });
    const result = detectLocalAnomalies([tx]);
    expect(result["tx-orphan"]).toBeDefined();
    const orphan = result["tx-orphan"].find((a) => a.anomaly_type === "orphan");
    expect(orphan).toBeDefined();
  });

  it("detects negative credit as potential refund", () => {
    const tx = makeTx({ id: "tx-neg", valor: -100, tipo: "credito" });
    const result = detectLocalAnomalies([tx]);
    expect(result["tx-neg"]).toBeDefined();
    expect(result["tx-neg"].some((a) => a.anomaly_type === "negative")).toBe(true);
  });

  it("does not flag a recently reconciled transaction", () => {
    const tx = makeTx({
      id: "tx-ok",
      valor: 100,
      status: "conciliado",
      data_transacao: new Date().toISOString().split("T")[0],
    });
    const result = detectLocalAnomalies([tx]);
    expect(result["tx-ok"]).toBeUndefined();
  });

  it("returns correct severity for duplicate (error)", () => {
    const tx1 = makeTx({ id: "tx-a", valor: 100, data_transacao: "2026-04-01", tipo: "debito" });
    const tx2 = makeTx({ id: "tx-b", valor: 100, data_transacao: "2026-04-01", tipo: "debito" });
    const result = detectLocalAnomalies([tx1, tx2]);
    const dupAnomaly = result["tx-a"]?.find((a) => a.anomaly_type === "duplicate");
    expect(dupAnomaly?.severity).toBe("error");
  });
});
