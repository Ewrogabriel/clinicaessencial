/**
 * Unit tests for inventoryService.
 *
 * Uses a Proxy-based thenable chain so `await` resolves at any step of the
 * Supabase fluent API.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { inventoryService } from "../inventoryService";

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

const PRODUCT_1 = { id: "prod-1", nome: "Bola de Pilates", estoque: 10 };
const PRODUCT_2 = { id: "prod-2", nome: "Colchonete", estoque: 5 };

describe("inventoryService", () => {
    let supabase: Awaited<ReturnType<typeof getSupabase>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        supabase = await getSupabase();
    });

    // ── getProducts ───────────────────────────────────────────────────────────

    describe("getProducts", () => {
        it("returns all products ordered by name", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [PRODUCT_1, PRODUCT_2], error: null }));

            const result = await inventoryService.getProducts();
            expect(result).toHaveLength(2);
            expect(result[0].nome).toBe("Bola de Pilates");
            expect(supabase.from).toHaveBeenCalledWith("produtos");
        });

        it("returns empty array when no products exist", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [], error: null }));

            const result = await inventoryService.getProducts();
            expect(result).toEqual([]);
        });

        it("returns empty array on db error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

            const result = await inventoryService.getProducts();
            expect(result).toEqual([]);
        });

        it("returns empty array when data is null (no rows)", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            const result = await inventoryService.getProducts();
            expect(result).toEqual([]);
        });
    });

    // ── updateStock ───────────────────────────────────────────────────────────

    describe("updateStock", () => {
        it("updates product stock without throwing", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            await expect(
                inventoryService.updateStock("prod-1", 20)
            ).resolves.not.toThrow();
            expect(supabase.from).toHaveBeenCalledWith("produtos");
        });

        it("throws on db error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "Update failed" } }));

            await expect(
                inventoryService.updateStock("prod-1", 0)
            ).rejects.toThrow();
        });

        it("allows setting stock to zero", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            await expect(
                inventoryService.updateStock("prod-1", 0)
            ).resolves.not.toThrow();
        });

        it("allows large stock values", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            await expect(
                inventoryService.updateStock("prod-1", 99999)
            ).resolves.not.toThrow();
        });
    });
});
