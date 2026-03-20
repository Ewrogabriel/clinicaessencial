import { describe, it, expect } from "vitest";
import { appointmentSchema } from "../schemas";

const validAppointment = {
    paciente_id: "550e8400-e29b-41d4-a716-446655440000",
    profissional_id: "660e8400-e29b-41d4-a716-446655440001",
    clinic_id: "770e8400-e29b-41d4-a716-446655440002",
    data_horario: "2026-06-15T10:00:00.000Z",
    tipo_atendimento: "pilates",
    valor_sessao: 120,
};

describe("appointmentSchema", () => {
    it("should accept a valid appointment", () => {
        expect(appointmentSchema.safeParse(validAppointment).success).toBe(true);
    });

    it("should accept appointment with optional observacoes", () => {
        const result = appointmentSchema.safeParse({
            ...validAppointment,
            observacoes: "Patient prefers morning slots",
        });
        expect(result.success).toBe(true);
    });

    it("should accept zero valor_sessao", () => {
        const result = appointmentSchema.safeParse({ ...validAppointment, valor_sessao: 0 });
        expect(result.success).toBe(true);
    });

    it("should reject missing paciente_id", () => {
        const { paciente_id: _, ...rest } = validAppointment;
        expect(appointmentSchema.safeParse(rest).success).toBe(false);
    });

    it("should reject non-UUID paciente_id", () => {
        const result = appointmentSchema.safeParse({ ...validAppointment, paciente_id: "not-a-uuid" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Paciente é obrigatório");
    });

    it("should reject missing clinic_id", () => {
        const { clinic_id: _, ...rest } = validAppointment;
        const result = appointmentSchema.safeParse(rest);
        expect(result.success).toBe(false);
        // Zod reports "Required" for missing fields (custom message only fires on invalid format)
        expect(result.error?.issues[0].path).toContain("clinic_id");
    });

    it("should reject non-UUID clinic_id", () => {
        const result = appointmentSchema.safeParse({ ...validAppointment, clinic_id: "not-a-uuid" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Unidade é obrigatória");
    });

    it("should reject invalid date", () => {
        const result = appointmentSchema.safeParse({ ...validAppointment, data_horario: "not-a-date" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Data inválida");
    });

    it("should reject tipo_atendimento shorter than 2 chars", () => {
        const result = appointmentSchema.safeParse({ ...validAppointment, tipo_atendimento: "p" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Tipo de atendimento é obrigatório");
    });

    it("should reject negative valor_sessao", () => {
        const result = appointmentSchema.safeParse({ ...validAppointment, valor_sessao: -1 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Valor não pode ser negativo");
    });
});
