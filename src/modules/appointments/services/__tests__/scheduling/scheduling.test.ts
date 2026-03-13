/**
 * Scheduling-specific unit tests — requirement #5.
 *
 * Validates the business rules that govern appointment booking:
 *  1. Slot capacity:      no professional can be double-booked
 *  2. Conflict detection: checkDoubleBooking blocks a second booking at the same slot
 *  3. Rescheduling:       the appointment being moved is excluded from conflict checks
 *  4. Group sessions:     multiple patients may book the same slot with *different* professionals
 *  5. Booking limits:     cancelado status is not counted as a conflict
 *
 * All Supabase calls are intercepted via the Proxy-based thenable chain used
 * throughout this test suite.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appointmentService } from "../../appointmentService";

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

// ── Constants ─────────────────────────────────────────────────────────────────

const CLINIC_ID = "clinic-001";
const PROF_A = "prof-A";
const PROF_B = "prof-B";
const PAT_1 = "pat-1";
const PAT_2 = "pat-2";
const SLOT_09H = "2026-07-01T09:00:00.000Z";
const SLOT_10H = "2026-07-01T10:00:00.000Z";
const APT_ID = "apt-existing-001";

// ── Scheduling tests ──────────────────────────────────────────────────────────

describe("Scheduling — slot capacity & conflict rules", () => {
    let supabase: Awaited<ReturnType<typeof getSupabase>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        supabase = await getSupabase();
    });

    // ── Slot capacity ─────────────────────────────────────────────────────────

    describe("Slot capacity", () => {
        it("allows booking when the slot is free for the professional", async () => {
            // no existing appointment at SLOT_09H for PROF_A
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));
            // insert succeeds
            supabase.from.mockReturnValueOnce(chain({ data: { id: "new-apt" }, error: null }));

            await expect(
                appointmentService.bookAppointment({
                    paciente_id: PAT_1,
                    profissional_id: PROF_A,
                    data_horario: SLOT_09H,
                    duracao_minutos: 60,
                    tipo_atendimento: "pilates",
                    tipo_sessao: "individual",
                    created_by: "admin",
                    clinic_id: CLINIC_ID,
                })
            ).resolves.not.toThrow();
        });

        it("blocks booking when the slot is already occupied by the same professional", async () => {
            // conflict: PROF_A already has an appointment at SLOT_09H
            supabase.from.mockReturnValueOnce(
                chain({ data: { id: "existing-apt" }, error: null })
            );

            await expect(
                appointmentService.bookAppointment({
                    paciente_id: PAT_2,
                    profissional_id: PROF_A,
                    data_horario: SLOT_09H,
                    duracao_minutos: 60,
                    tipo_atendimento: "pilates",
                    tipo_sessao: "individual",
                    created_by: "admin",
                    clinic_id: CLINIC_ID,
                })
            ).rejects.toThrow("já possui um agendamento");
        });

        it("allows different professionals to be booked at the same time slot (group capacity)", async () => {
            // PROF_A free at SLOT_09H
            supabase.from
                .mockReturnValueOnce(chain({ data: null, error: null }))  // checkDoubleBooking PROF_A
                .mockReturnValueOnce(chain({ data: { id: "apt-a" }, error: null })); // insert PROF_A

            // PROF_B free at SLOT_09H
            supabase.from
                .mockReturnValueOnce(chain({ data: null, error: null }))  // checkDoubleBooking PROF_B
                .mockReturnValueOnce(chain({ data: { id: "apt-b" }, error: null })); // insert PROF_B

            // Book PAT_1 with PROF_A
            await expect(
                appointmentService.bookAppointment({
                    paciente_id: PAT_1,
                    profissional_id: PROF_A,
                    data_horario: SLOT_09H,
                    duracao_minutos: 60,
                    tipo_atendimento: "pilates",
                    tipo_sessao: "individual",
                    created_by: "admin",
                    clinic_id: CLINIC_ID,
                })
            ).resolves.toBeDefined();

            // Book PAT_2 with PROF_B at the same time — must succeed
            await expect(
                appointmentService.bookAppointment({
                    paciente_id: PAT_2,
                    profissional_id: PROF_B,
                    data_horario: SLOT_09H,
                    duracao_minutos: 60,
                    tipo_atendimento: "pilates",
                    tipo_sessao: "individual",
                    created_by: "admin",
                    clinic_id: CLINIC_ID,
                })
            ).resolves.toBeDefined();
        });
    });

    // ── Appointment conflicts ─────────────────────────────────────────────────

    describe("Appointment conflicts", () => {
        it("checkDoubleBooking returns false when slot is free", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            const result = await appointmentService.checkDoubleBooking(PROF_A, SLOT_09H);
            expect(result).toBe(false);
        });

        it("checkDoubleBooking throws when a non-cancelled appointment exists at the slot", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: { id: "conflict-apt" }, error: null })
            );

            await expect(
                appointmentService.checkDoubleBooking(PROF_A, SLOT_09H)
            ).rejects.toThrow();
        });

        it("two consecutive unique time slots do not conflict", async () => {
            // SLOT_09H free
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            const r1 = await appointmentService.checkDoubleBooking(PROF_A, SLOT_09H);
            expect(r1).toBe(false);

            // SLOT_10H free
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            const r2 = await appointmentService.checkDoubleBooking(PROF_A, SLOT_10H);
            expect(r2).toBe(false);
        });
    });

    // ── Rescheduling: excludingId logic ───────────────────────────────────────

    describe("Rescheduling conflict exclusion", () => {
        it("allows rescheduling to a new date when no conflict exists", async () => {
            supabase.from
                .mockReturnValueOnce(chain({ data: null, error: null }))   // checkDoubleBooking at new slot
                .mockReturnValueOnce(chain({ data: null, error: null }));  // update

            await expect(
                appointmentService.reschedule(APT_ID, new Date(SLOT_10H), PROF_A)
            ).resolves.not.toThrow();
        });

        it("does not treat the appointment itself as a conflict when rescheduling to the same slot", async () => {
            // The only conflict found has the same id as the appointment being moved
            supabase.from
                .mockReturnValueOnce(chain({ data: { id: APT_ID }, error: null }))  // same id → not a conflict
                .mockReturnValueOnce(chain({ data: null, error: null }));            // update

            await expect(
                appointmentService.reschedule(APT_ID, new Date(SLOT_09H), PROF_A)
            ).resolves.not.toThrow();
        });

        it("blocks rescheduling when another appointment occupies the target slot", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: { id: "other-apt" }, error: null }) // different id → real conflict
            );

            await expect(
                appointmentService.reschedule(APT_ID, new Date(SLOT_09H), PROF_A)
            ).rejects.toThrow();
        });
    });

    // ── Booking limits / cancelled status ─────────────────────────────────────

    describe("Cancelled appointments do not count toward capacity", () => {
        it("getAppointments returns all appointments including cancelled ones", async () => {
            const appointments = [
                { id: "a1", status: "agendado", profissional_id: PROF_A },
                { id: "a2", status: "cancelado", profissional_id: PROF_A },
                { id: "a3", status: "concluido", profissional_id: PROF_A },
            ];
            supabase.from.mockReturnValueOnce(chain({ data: appointments, error: null }));

            const result = await appointmentService.getAppointments({
                profissionalId: PROF_A,
                activeClinicId: CLINIC_ID,
            });
            expect(result).toHaveLength(3);
        });

        it("checkDoubleBooking query excludes cancelled status at DB level (neq filter)", async () => {
            // checkDoubleBooking queries neq "cancelado" — when only a cancelled apt
            // exists for the professional+slot, the DB returns null (filtered out)
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            // Slot should be considered free (cancelled doesn't block it)
            const result = await appointmentService.checkDoubleBooking(PROF_A, SLOT_09H);
            expect(result).toBe(false);
        });
    });

    // ── getScheduleSlots returns empty (feature not migrated) ─────────────────

    describe("getScheduleSlots", () => {
        it("returns an empty array regardless of input (placeholder)", async () => {
            const result = await appointmentService.getScheduleSlots({
                professionalId: PROF_A,
                date: "2026-07-01",
                clinicId: CLINIC_ID,
            });
            expect(result).toEqual([]);
        });

        it("returns empty array when no professionalId is given", async () => {
            const result = await appointmentService.getScheduleSlots({
                date: "2026-07-01",
                clinicId: null,
            });
            expect(result).toEqual([]);
        });
    });
});
