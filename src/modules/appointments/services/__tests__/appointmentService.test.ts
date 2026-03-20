/**
 * Unit tests for appointmentService.
 *
 * Uses a Proxy-based thenable chain so `await` resolves at any step of the
 * Supabase fluent API (e.g. .order(), .eq(), .single(), .maybeSingle()).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appointmentService } from "../appointmentService";

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

// ── Test data ─────────────────────────────────────────────────────────────────

const CLINIC_ID = "clinic-001";
const PROF_ID = "prof-001";
const PAT_ID = "pat-001";
const APT_ID = "apt-001";
const DATE_STR = "2026-06-20T09:00:00.000Z";

const BASE_APT = {
    id: APT_ID,
    paciente_id: PAT_ID,
    profissional_id: PROF_ID,
    clinic_id: CLINIC_ID,
    data_horario: DATE_STR,
    status: "agendado",
    tipo_atendimento: "pilates",
    tipo_sessao: "individual",
    valor_sessao: 120,
};

const BOOK_PARAMS = {
    paciente_id: PAT_ID,
    profissional_id: PROF_ID,
    data_horario: DATE_STR,
    duracao_minutos: 60,
    tipo_atendimento: "pilates",
    tipo_sessao: "individual" as const,
    created_by: "user-001",
    clinic_id: CLINIC_ID,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("appointmentService", () => {
    let supabase: Awaited<ReturnType<typeof getSupabase>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        supabase = await getSupabase();
    });

    // ── getAppointments ───────────────────────────────────────────────────────

    describe("getAppointments", () => {
        it("returns appointments for a clinic", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [BASE_APT], error: null }));

            const result = await appointmentService.getAppointments({ activeClinicId: CLINIC_ID });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(APT_ID);
            expect(supabase.from).toHaveBeenCalledWith("agendamentos");
        });

        it("returns appointments filtered by pacienteId", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [BASE_APT], error: null }));

            const result = await appointmentService.getAppointments({
                pacienteId: PAT_ID,
                activeClinicId: CLINIC_ID,
            });
            expect(result).toHaveLength(1);
        });

        it("returns appointments filtered by profissionalId", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [BASE_APT], error: null }));

            const result = await appointmentService.getAppointments({
                profissionalId: PROF_ID,
                activeClinicId: CLINIC_ID,
            });
            expect(result).toHaveLength(1);
        });

        it("returns empty array on db error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

            const result = await appointmentService.getAppointments({ activeClinicId: CLINIC_ID });
            expect(result).toEqual([]);
        });

        it("returns empty array when data is null and no error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            const result = await appointmentService.getAppointments({ activeClinicId: null });
            expect(result).toEqual([]);
        });

        it("returns appointments filtered by date range", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [BASE_APT], error: null }));

            const result = await appointmentService.getAppointments({
                activeClinicId: CLINIC_ID,
                dateStart: "2026-06-20T00:00:00.000Z",
                dateEnd: "2026-06-20T23:59:59.999Z",
            });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(APT_ID);
        });
    });

    // ── getScheduleSlots ──────────────────────────────────────────────────────

    describe("getScheduleSlots", () => {
        it("always returns an empty array (feature not yet migrated)", async () => {
            const result = await appointmentService.getScheduleSlots({
                professionalId: PROF_ID,
                date: "2026-06-20",
                clinicId: CLINIC_ID,
            });
            expect(result).toEqual([]);
        });
    });

    // ── checkDoubleBooking ────────────────────────────────────────────────────

    describe("checkDoubleBooking", () => {
        it("returns false when no conflicting appointment exists", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            const result = await appointmentService.checkDoubleBooking(PROF_ID, DATE_STR);
            expect(result).toBe(false);
        });

        it("throws when a conflicting appointment is found", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: { id: "other-apt" }, error: null }));

            await expect(
                appointmentService.checkDoubleBooking(PROF_ID, DATE_STR)
            ).rejects.toThrow("já possui um agendamento");
        });

        it("does not throw when the conflicting id matches the excludingId", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: { id: APT_ID }, error: null }));

            const result = await appointmentService.checkDoubleBooking(PROF_ID, DATE_STR, APT_ID);
            expect(result).toBe(false);
        });
    });

    // ── bookAppointment ───────────────────────────────────────────────────────

    describe("bookAppointment", () => {
        it("creates appointment and returns the row", async () => {
            // checkDoubleBooking: no conflict
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));
            // insert + select + single → BASE_APT
            supabase.from.mockReturnValueOnce(chain({ data: BASE_APT, error: null }));

            const result = await appointmentService.bookAppointment(BOOK_PARAMS);
            expect(result).toEqual(BASE_APT);
        });

        it("throws when double-booking guard fires", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: { id: "conflict" }, error: null }));

            await expect(appointmentService.bookAppointment(BOOK_PARAMS)).rejects.toThrow();
        });

        it("throws when insert fails", async () => {
            supabase.from
                .mockReturnValueOnce(chain({ data: null, error: null }))             // checkDoubleBooking ok
                .mockReturnValueOnce(chain({ data: null, error: { message: "Insert failed" } }));  // insert fails

            await expect(appointmentService.bookAppointment(BOOK_PARAMS)).rejects.toThrow();
        });
    });

    // ── updateStatus ──────────────────────────────────────────────────────────

    describe("updateStatus", () => {
        it("updates status without throwing", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            await expect(
                appointmentService.updateStatus(APT_ID, "confirmado")
            ).resolves.not.toThrow();
        });

        it("throws on db error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "fail" } }));

            await expect(
                appointmentService.updateStatus(APT_ID, "cancelado")
            ).rejects.toThrow();
        });
    });

    // ── checkin ───────────────────────────────────────────────────────────────

    describe("checkin", () => {
        it("records patient check-in successfully", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            await expect(
                appointmentService.checkin(APT_ID, "paciente")
            ).resolves.not.toThrow();
        });

        it("records professional check-in successfully", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            await expect(
                appointmentService.checkin(APT_ID, "profissional")
            ).resolves.not.toThrow();
        });

        it("throws on db error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "fail" } }));

            await expect(
                appointmentService.checkin(APT_ID, "paciente")
            ).rejects.toThrow();
        });
    });

    // ── reschedule ────────────────────────────────────────────────────────────

    describe("reschedule", () => {
        it("reschedules when the only conflict is the same appointment", async () => {
            supabase.from
                .mockReturnValueOnce(chain({ data: { id: APT_ID }, error: null }))  // checkDoubleBooking: same id
                .mockReturnValueOnce(chain({ data: null, error: null }));            // update

            await expect(
                appointmentService.reschedule(APT_ID, new Date(DATE_STR), PROF_ID)
            ).resolves.not.toThrow();
        });

        it("reschedules when no conflict exists", async () => {
            supabase.from
                .mockReturnValueOnce(chain({ data: null, error: null }))   // checkDoubleBooking: clear
                .mockReturnValueOnce(chain({ data: null, error: null }));  // update

            await expect(
                appointmentService.reschedule(APT_ID, new Date(DATE_STR), PROF_ID)
            ).resolves.not.toThrow();
        });

        it("throws when a double-booking conflict is found for different appointment", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: { id: "other-apt" }, error: null }));

            await expect(
                appointmentService.reschedule(APT_ID, new Date(DATE_STR), PROF_ID)
            ).rejects.toThrow();
        });

        it("throws when the update itself fails", async () => {
            supabase.from
                .mockReturnValueOnce(chain({ data: null, error: null }))                       // checkDoubleBooking ok
                .mockReturnValueOnce(chain({ data: null, error: { message: "fail" } }));      // update fails

            await expect(
                appointmentService.reschedule(APT_ID, new Date(DATE_STR), PROF_ID)
            ).rejects.toThrow();
        });
    });
});
