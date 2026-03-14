import { describe, it, expect } from "vitest";
import { queryKeys } from "../queryKeys";

describe("queryKeys", () => {
    // ── Patients ──────────────────────────────────────────────────────────────
    describe("patients", () => {
        it("all is a stable constant tuple", () => {
            expect(queryKeys.patients.all).toEqual(["pacientes"]);
        });

        it("list with clinicId only", () => {
            expect(queryKeys.patients.list("clinic-1")).toEqual(["pacientes", "clinic-1"]);
        });

        it("list with clinicId and status", () => {
            expect(queryKeys.patients.list("clinic-1", "ativo")).toEqual([
                "pacientes",
                "ativo",
                "clinic-1",
            ]);
        });

        it("list with null clinicId", () => {
            expect(queryKeys.patients.list(null)).toEqual(["pacientes", null]);
        });

        it("detail includes id", () => {
            expect(queryKeys.patients.detail("p-123")).toEqual([
                "pacientes",
                "detail",
                "p-123",
            ]);
        });
    });

    // ── Appointments ──────────────────────────────────────────────────────────
    describe("appointments", () => {
        it("all is a stable constant tuple", () => {
            expect(queryKeys.appointments.all).toEqual(["agendamentos"]);
        });

        it("list with clinicId", () => {
            expect(queryKeys.appointments.list("clinic-1")).toEqual([
                "agendamentos",
                "clinic-1",
                undefined,
            ]);
        });

        it("list with clinicId and patientId", () => {
            expect(queryKeys.appointments.list("clinic-1", "p-1")).toEqual([
                "agendamentos",
                "clinic-1",
                "p-1",
            ]);
        });

        it("today key is scoped to clinicId", () => {
            expect(queryKeys.appointments.today("clinic-1")).toEqual([
                "agendamentos",
                "today",
                "clinic-1",
            ]);
        });

        it("byProfessional key is scoped to profId and clinicId", () => {
            expect(queryKeys.appointments.byProfessional("prof-1", "clinic-1")).toEqual([
                "agendamentos",
                "professional",
                "prof-1",
                "clinic-1",
            ]);
        });

        it("slots key includes professionalId, date, and clinicId", () => {
            expect(queryKeys.appointments.slots("prof-1", "2026-07-01", "clinic-1")).toEqual([
                "schedule_slots",
                "prof-1",
                "2026-07-01",
                "clinic-1",
            ]);
        });

        it("slots key works with undefined professionalId", () => {
            expect(queryKeys.appointments.slots(undefined, "2026-07-01", null)).toEqual([
                "schedule_slots",
                undefined,
                "2026-07-01",
                null,
            ]);
        });
    });

    // ── Professionals ─────────────────────────────────────────────────────────
    describe("professionals", () => {
        it("all is a stable constant tuple", () => {
            expect(queryKeys.professionals.all).toEqual(["profissionais"]);
        });

        it("list scoped to clinicId", () => {
            expect(queryKeys.professionals.list("clinic-1")).toEqual([
                "profissionais",
                "clinic-1",
            ]);
        });

        it("detail scoped to userId", () => {
            expect(queryKeys.professionals.detail("user-1")).toEqual([
                "profissionais",
                "detail",
                "user-1",
            ]);
        });

        it("availability scoped to profId and clinicId", () => {
            expect(queryKeys.professionals.availability("prof-1", "clinic-1")).toEqual([
                "disponibilidade",
                "prof-1",
                "clinic-1",
            ]);
        });
    });

    // ── Finance ───────────────────────────────────────────────────────────────
    describe("finance", () => {
        it("all is a stable constant tuple", () => {
            expect(queryKeys.finance.all).toEqual(["financeiro"]);
        });

        it("payments scoped to clinicId", () => {
            expect(queryKeys.finance.payments("clinic-1")).toEqual([
                "financeiro",
                "pagamentos",
                "clinic-1",
            ]);
        });

        it("pendencias scoped to patientId", () => {
            expect(queryKeys.finance.pendencias("p-1")).toEqual([
                "financeiro",
                "pendencias",
                "p-1",
            ]);
        });

        it("commissions scoped to clinicId", () => {
            expect(queryKeys.finance.commissions("clinic-1")).toEqual([
                "comissoes",
                "clinic-1",
            ]);
        });

        it("dashboard scoped to start date and clinicId", () => {
            expect(queryKeys.finance.dashboard("2026-01-01", "clinic-1")).toEqual([
                "dashboard-finance",
                "2026-01-01",
                "clinic-1",
            ]);
        });
    });

    // ── Clinical ──────────────────────────────────────────────────────────────
    describe("clinical", () => {
        it("evolutions scoped to patientId", () => {
            expect(queryKeys.clinical.evolutions("p-1")).toEqual(["evolutions", "p-1"]);
        });

        it("evaluations scoped to patientId", () => {
            expect(queryKeys.clinical.evaluations("p-1")).toEqual(["evaluations", "p-1"]);
        });
    });

    // ── Clinics ───────────────────────────────────────────────────────────────
    describe("clinics", () => {
        it("settings scoped to clinicId", () => {
            expect(queryKeys.clinics.settings("clinic-1")).toEqual([
                "clinica-settings",
                "clinic-1",
            ]);
        });

        it("detail scoped to id", () => {
            expect(queryKeys.clinics.detail("clinic-1")).toEqual([
                "clinicas",
                "detail",
                "clinic-1",
            ]);
        });
    });

    // ── Dashboard ─────────────────────────────────────────────────────────────
    describe("dashboard", () => {
        it("stats scoped to clinicId", () => {
            expect(queryKeys.dashboard.stats("clinic-1")).toEqual([
                "dashboard",
                "stats",
                "clinic-1",
            ]);
        });
    });

    // ── Partial-invalidation compatibility ────────────────────────────────────
    it("patients.all is a prefix of patients.list", () => {
        const all = queryKeys.patients.all;
        const list = queryKeys.patients.list("clinic-1");
        // React Query uses startsWith logic for partial matches
        expect(list.slice(0, all.length)).toEqual(all);
    });

    it("appointments.all is a prefix of appointments.list", () => {
        const all = queryKeys.appointments.all;
        const list = queryKeys.appointments.list("clinic-1");
        expect(list.slice(0, all.length)).toEqual(all);
    });

    // ── Clinic Groups ─────────────────────────────────────────────────────────
    describe("clinicGroups", () => {
        it("all is a stable constant tuple", () => {
            expect(queryKeys.clinicGroups.all).toEqual(["clinic-groups"]);
        });

        it("list returns the all key", () => {
            expect(queryKeys.clinicGroups.list()).toEqual(["clinic-groups"]);
        });

        it("detail includes group id", () => {
            expect(queryKeys.clinicGroups.detail("g-1")).toEqual([
                "clinic-groups",
                "detail",
                "g-1",
            ]);
        });

        it("members includes group id", () => {
            expect(queryKeys.clinicGroups.members("g-1")).toEqual([
                "clinic-groups",
                "members",
                "g-1",
            ]);
        });

        it("byClinic includes clinic id", () => {
            expect(queryKeys.clinicGroups.byClinic("clinic-1")).toEqual([
                "clinic-groups",
                "by-clinic",
                "clinic-1",
            ]);
        });
    });

    // ── Inventory ─────────────────────────────────────────────────────────────
    describe("inventory", () => {
        it("all is a stable constant tuple", () => {
            expect(queryKeys.inventory.all).toEqual(["inventario"]);
        });

        it("list with clinicId", () => {
            expect(queryKeys.inventory.list("clinic-1")).toEqual([
                "inventario",
                "clinic-1",
            ]);
        });

        it("list with null clinicId", () => {
            expect(queryKeys.inventory.list(null)).toEqual(["inventario", null]);
        });

        it("detail includes id", () => {
            expect(queryKeys.inventory.detail("item-1")).toEqual([
                "inventario",
                "detail",
                "item-1",
            ]);
        });
    });
});
