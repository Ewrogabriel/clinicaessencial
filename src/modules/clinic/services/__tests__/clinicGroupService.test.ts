import { describe, it, expect, vi, beforeEach } from "vitest";
import { clinicGroupService } from "../clinicGroupService";

// ── Supabase mock builders ────────────────────────────────────────────────────

/** Creates a fluent mock chain that resolves to { data, error }. */
function chainOf(data: unknown, error: unknown = null) {
    const terminal = { data, error };
    const chain: Record<string, unknown> = {};

    // All chainable methods return chain; terminal methods return terminal.
    const methods = [
        "select", "from", "eq", "in", "order",
        "maybeSingle", "single",
    ];
    methods.forEach((m) => {
        chain[m] = vi.fn().mockReturnValue(chain);
    });
    // Resolve promises for terminal methods
    (chain["maybeSingle"] as ReturnType<typeof vi.fn>).mockResolvedValue(terminal);
    (chain["single"] as ReturnType<typeof vi.fn>).mockResolvedValue(terminal);
    // order resolves (for list queries)
    (chain["order"] as ReturnType<typeof vi.fn>).mockResolvedValue(terminal);

    return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: vi.fn(),
    },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSupabaseMock = async (): Promise<any> => {
    const mod = await import("@/integrations/supabase/client");
    return mod.supabase;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("clinicGroupService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── getClinicGroups ───────────────────────────────────────────────────────

    describe("getClinicGroups", () => {
        it("returns clinic groups when successful", async () => {
            const groups = [
                { id: "g1", nome: "Essencial Health Network", ativo: true, created_by: "u1", created_at: "2026-01-01", updated_at: "2026-01-01" },
            ];
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf(groups));

            const result = await clinicGroupService.getClinicGroups();
            expect(result).toEqual(groups);
            expect(supabase.from).toHaveBeenCalledWith("clinic_groups");
        });

        it("returns empty array on error", async () => {
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf(null, { message: "DB error" }));

            const result = await clinicGroupService.getClinicGroups();
            expect(result).toEqual([]);
        });
    });

    // ── getClinicsInGroup ─────────────────────────────────────────────────────

    describe("getClinicsInGroup", () => {
        it("returns clinics belonging to the group", async () => {
            const clinics = [
                { id: "c1", nome: "Essencial Centro", ativo: true, clinic_group_id: "g1" },
                { id: "c2", nome: "Essencial Bairro", ativo: true, clinic_group_id: "g1" },
            ];
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf(clinics));

            const result = await clinicGroupService.getClinicsInGroup("g1");
            expect(result).toHaveLength(2);
            expect(result[0].nome).toBe("Essencial Centro");
        });

        it("returns empty array when group has no clinics", async () => {
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf([], null));

            const result = await clinicGroupService.getClinicsInGroup("g1");
            expect(result).toEqual([]);
        });

        it("returns empty array on error", async () => {
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf(null, { message: "error" }));

            const result = await clinicGroupService.getClinicsInGroup("g1");
            expect(result).toEqual([]);
        });
    });

    // ── getGroupMembers ───────────────────────────────────────────────────────

    describe("getGroupMembers", () => {
        it("returns group members", async () => {
            const members = [
                { id: "m1", group_id: "g1", clinic_id: "c1", cross_booking_enabled: true, created_at: "2026-01-01" },
                { id: "m2", group_id: "g1", clinic_id: "c2", cross_booking_enabled: false, created_at: "2026-01-02" },
            ];
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf(members));

            const result = await clinicGroupService.getGroupMembers("g1");
            expect(result).toHaveLength(2);
            expect(result[0].cross_booking_enabled).toBe(true);
        });

        it("returns empty array on error", async () => {
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf(null, { message: "error" }));

            const result = await clinicGroupService.getGroupMembers("g1");
            expect(result).toEqual([]);
        });
    });

    // ── isCrossBookingEnabled ─────────────────────────────────────────────────

    describe("isCrossBookingEnabled", () => {
        it("returns true when cross booking is enabled", async () => {
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(
                chainOf({ cross_booking_enabled: true }, null),
            );

            const result = await clinicGroupService.isCrossBookingEnabled("c1");
            expect(result).toBe(true);
        });

        it("returns false when cross booking is disabled", async () => {
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(
                chainOf({ cross_booking_enabled: false }, null),
            );

            const result = await clinicGroupService.isCrossBookingEnabled("c1");
            expect(result).toBe(false);
        });

        it("returns false when no membership record exists", async () => {
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf(null, null));

            const result = await clinicGroupService.isCrossBookingEnabled("c1");
            expect(result).toBe(false);
        });

        it("returns false on error", async () => {
            const supabase = await getSupabaseMock();
            supabase.from.mockReturnValue(chainOf(null, { message: "error" }));

            const result = await clinicGroupService.isCrossBookingEnabled("c1");
            expect(result).toBe(false);
        });
    });
});
