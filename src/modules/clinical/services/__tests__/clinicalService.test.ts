/**
 * Unit tests for clinicalService.
 *
 * Covers all three methods:
 * - getEvolucoes  (success, empty, error)
 * - getEvaluations (success, empty, error)
 * - createEvolucao (success, db error throws)
 *
 * Supabase is fully mocked via vi.mock + a Proxy-based thenable chain
 * so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { clinicalService } from "../clinicalService";

// ── Thenable Proxy chain helper ───────────────────────────────────────────────

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

// ── Test data ─────────────────────────────────────────────────────────────────

const PATIENT_ID = "pat-001";

const EVOLUCAO_1 = {
    id: "ev-1",
    paciente_id: PATIENT_ID,
    data_evolucao: "2026-06-10",
    descricao: "Evolução 1",
};
const EVOLUCAO_2 = {
    id: "ev-2",
    paciente_id: PATIENT_ID,
    data_evolucao: "2026-06-05",
    descricao: "Evolução 2",
};

const EVALUATION_1 = {
    id: "eval-1",
    paciente_id: PATIENT_ID,
    created_at: "2026-06-01T10:00:00Z",
    resultado: "Normal",
};

const NEW_EVOLUCAO = {
    paciente_id: PATIENT_ID,
    data_evolucao: "2026-06-20",
    descricao: "Nova evolução",
    profissional_id: "prof-001",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("clinicalService", () => {
    let supabase: Awaited<ReturnType<typeof getSupabase>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        supabase = await getSupabase();
    });

    // ── getEvolucoes ──────────────────────────────────────────────────────────

    describe("getEvolucoes", () => {
        it("returns evolutions ordered newest-first for a patient", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: [EVOLUCAO_1, EVOLUCAO_2], error: null })
            );

            const result = await clinicalService.getEvolucoes(PATIENT_ID);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe("ev-1");
            expect(supabase.from).toHaveBeenCalledWith("evolutions");
        });

        it("returns empty array when patient has no evolutions", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [], error: null }));

            const result = await clinicalService.getEvolucoes(PATIENT_ID);
            expect(result).toEqual([]);
        });

        it("returns empty array when data is null", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            const result = await clinicalService.getEvolucoes(PATIENT_ID);
            expect(result).toEqual([]);
        });

        it("returns empty array on db error", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: null, error: { message: "DB error" } })
            );

            const result = await clinicalService.getEvolucoes(PATIENT_ID);
            expect(result).toEqual([]);
        });
    });

    // ── getEvaluations ────────────────────────────────────────────────────────

    describe("getEvaluations", () => {
        it("returns evaluations for a patient", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: [EVALUATION_1], error: null })
            );

            const result = await clinicalService.getEvaluations(PATIENT_ID);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("eval-1");
            expect(supabase.from).toHaveBeenCalledWith("evaluations");
        });

        it("returns empty array when patient has no evaluations", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [], error: null }));

            const result = await clinicalService.getEvaluations(PATIENT_ID);
            expect(result).toEqual([]);
        });

        it("returns empty array on db error", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: null, error: { message: "Query failed" } })
            );

            const result = await clinicalService.getEvaluations(PATIENT_ID);
            expect(result).toEqual([]);
        });
    });

    // ── createEvolucao ────────────────────────────────────────────────────────

    describe("createEvolucao", () => {
        it("creates an evolution and returns the new row", async () => {
            const created = { ...NEW_EVOLUCAO, id: "ev-new" };
            supabase.from.mockReturnValueOnce(chain({ data: created, error: null }));

            const result = await clinicalService.createEvolucao(NEW_EVOLUCAO as Parameters<typeof clinicalService.createEvolucao>[0]);
            expect(result).toEqual(created);
            expect(supabase.from).toHaveBeenCalledWith("evolutions");
        });

        it("throws when db insert fails", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: null, error: { message: "Insert failed" } })
            );

            await expect(
                clinicalService.createEvolucao(NEW_EVOLUCAO as Parameters<typeof clinicalService.createEvolucao>[0])
            ).rejects.toThrow();
        });
    });
});
