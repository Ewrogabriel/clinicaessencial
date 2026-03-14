/**
 * Unit tests for financeService.
 *
 * Uses a Proxy-based thenable chain so `await` resolves at any step of the
 * Supabase fluent API.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { financeService } from "../financeService";

// ── Thenable chain helper ─────────────────────────────────────────────────────

function chain(terminal: { data: unknown; error: unknown }) {
    const proxy: object = new Proxy(
        {},
        {
            get(_t, prop) {
                if (prop === "then") {
                    return (
                        resolve: (v: unknown) => void,
                        reject: (e: unknown) => void
                    ) => Promise.resolve(terminal).then(resolve, reject);
                }
                return () => proxy;
            },
        }
    );
    return proxy;
}

vi.mock("@/integrations/supabase/client", () => ({
    supabase: { from: vi.fn() },
}));

const getSupabase = async () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((await import("@/integrations/supabase/client")) as any).supabase;

// ── Tests ─────────────────────────────────────────────────────────────────────

const PATIENT_ID = "patient-001";

describe("financeService", () => {
    let supabase: Awaited<ReturnType<typeof getSupabase>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        supabase = await getSupabase();
    });

    // ── getPatientPendencias ──────────────────────────────────────────────────

    describe("getPatientPendencias", () => {
        it("returns pending payments for a patient", async () => {
            const rows = [{ id: "pay1", valor: 150, status: "pendente" }];
            supabase.from.mockReturnValueOnce(chain({ data: rows, error: null }));

            const result = await financeService.getPatientPendencias(PATIENT_ID);
            expect(result).toEqual(rows);
            expect(supabase.from).toHaveBeenCalledWith("pagamentos");
        });

        it("returns empty array on error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "err" } }));

            const result = await financeService.getPatientPendencias(PATIENT_ID);
            expect(result).toEqual([]);
        });

        it("returns empty array when no pending payments", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [], error: null }));

            const result = await financeService.getPatientPendencias(PATIENT_ID);
            expect(result).toEqual([]);
        });
    });

    // ── getFormasPagamento ────────────────────────────────────────────────────

    describe("getFormasPagamento", () => {
        it("returns active payment methods", async () => {
            const rows = [
                { id: "fp1", nome: "Cartão de Crédito", ativo: true, ordem: 1 },
                { id: "fp2", nome: "PIX", ativo: true, ordem: 2 },
            ];
            supabase.from.mockReturnValueOnce(chain({ data: rows, error: null }));

            const result = await financeService.getFormasPagamento();
            expect(result).toHaveLength(2);
            expect(result[0].nome).toBe("Cartão de Crédito");
            expect(supabase.from).toHaveBeenCalledWith("formas_pagamento");
        });

        it("returns empty array on error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "err" } }));

            const result = await financeService.getFormasPagamento();
            expect(result).toEqual([]);
        });
    });

    // ── getPagamentosMensalidade ──────────────────────────────────────────────

    describe("getPagamentosMensalidade", () => {
        it("returns monthly payments for a patient", async () => {
            const rows = [{ id: "m1", mes_referencia: "2026-06", valor: 300 }];
            supabase.from.mockReturnValueOnce(chain({ data: rows, error: null }));

            const result = await financeService.getPagamentosMensalidade(PATIENT_ID);
            expect(result).toHaveLength(1);
            expect(supabase.from).toHaveBeenCalledWith("pagamentos_mensalidade");
        });

        it("returns empty array on error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "err" } }));

            const result = await financeService.getPagamentosMensalidade(PATIENT_ID);
            expect(result).toEqual([]);
        });
    });

    // ── getPagamentosSessoes ──────────────────────────────────────────────────

    describe("getPagamentosSessoes", () => {
        it("returns session payments for a patient", async () => {
            const rows = [{ id: "s1", created_at: "2026-06-01", valor: 100 }];
            supabase.from.mockReturnValueOnce(chain({ data: rows, error: null }));

            const result = await financeService.getPagamentosSessoes(PATIENT_ID);
            expect(result).toHaveLength(1);
            expect(supabase.from).toHaveBeenCalledWith("pagamentos_sessoes");
        });

        it("returns empty array on error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "err" } }));

            const result = await financeService.getPagamentosSessoes(PATIENT_ID);
            expect(result).toEqual([]);
        });
    });

    // ── getConfigPix ──────────────────────────────────────────────────────────

    describe("getConfigPix", () => {
        it("returns a map keyed by forma_pagamento_id", async () => {
            const rows = [
                { forma_pagamento_id: "fp2", chave_pix: "11999990001", tipo_chave: "telefone", nome_beneficiario: "Clínica" },
                { forma_pagamento_id: "fp3", chave_pix: "clinica@example.com", tipo_chave: "email", nome_beneficiario: "Clínica" },
            ];
            supabase.from.mockReturnValueOnce(chain({ data: rows, error: null }));

            const result = await financeService.getConfigPix();
            expect(Object.keys(result)).toHaveLength(2);
            expect(result["fp2"].chave_pix).toBe("11999990001");
            expect(result["fp3"].tipo_chave).toBe("email");
            expect(supabase.from).toHaveBeenCalledWith("config_pix");
        });

        it("returns empty map on error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "err" } }));

            const result = await financeService.getConfigPix();
            expect(result).toEqual({});
        });

        it("returns empty map when no PIX configs exist", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [], error: null }));

            const result = await financeService.getConfigPix();
            expect(result).toEqual({});
        });
    });

    // ── createSessaoAvulsaPayment ─────────────────────────────────────────────

    describe("createSessaoAvulsaPayment", () => {
        const params = {
            pacienteId: "patient-001",
            profissionalId: "prof-001",
            agendamentoId: "appt-001",
            valor: 120,
            tipoAtendimento: "pilates",
            dataHorario: "2026-06-20T09:00:00.000Z",
            clinicId: "clinic-001",
            createdBy: "prof-001",
        };

        it("inserts a sessao_avulsa payment record", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [{ id: "pay-001" }], error: null }));

            await expect(financeService.createSessaoAvulsaPayment(params)).resolves.toBeUndefined();
            expect(supabase.from).toHaveBeenCalledWith("pagamentos");
        });

        it("throws when insert fails", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "insert failed" } }));

            await expect(financeService.createSessaoAvulsaPayment(params)).rejects.toBeDefined();
        });

        it("accepts null clinicId without error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [], error: null }));

            await expect(
                financeService.createSessaoAvulsaPayment({ ...params, clinicId: null })
            ).resolves.toBeUndefined();
        });
    });
});
