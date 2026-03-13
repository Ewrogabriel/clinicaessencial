import { describe, it, expect } from "vitest";
import { professionalSchema } from "../schemas";

describe("Professional Schema", () => {
    const validProfessional = {
        nome: "Dra. Ana Souza",
        email: "ana.souza@clinica.com",
        especialidade: "Fisioterapia",
    };

    it("should accept valid professional data", () => {
        const result = professionalSchema.safeParse(validProfessional);
        expect(result.success).toBe(true);
    });

    it("should accept valid professional with all optional fields", () => {
        const result = professionalSchema.safeParse({
            ...validProfessional,
            telefone: "11999998888",
            registro_profissional: "CREFITO-3 12345-F",
            tipo_contratacao: "pj",
            commission_rate: 40,
            commission_fixed: 0,
            cor_agenda: "#3B82F6",
        });
        expect(result.success).toBe(true);
    });

    it("should accept empty string for optional text fields", () => {
        const result = professionalSchema.safeParse({
            ...validProfessional,
            telefone: "",
            registro_profissional: "",
            cor_agenda: "",
        });
        expect(result.success).toBe(true);
    });

    it("should reject name shorter than 3 characters", () => {
        const result = professionalSchema.safeParse({ ...validProfessional, nome: "Ab" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Nome deve ter pelo menos 3 caracteres");
    });

    it("should reject invalid email", () => {
        const result = professionalSchema.safeParse({ ...validProfessional, email: "not-email" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("E-mail inválido");
    });

    it("should reject commission_rate above 100", () => {
        const result = professionalSchema.safeParse({ ...validProfessional, commission_rate: 101 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Taxa deve ser entre 0 e 100");
    });

    it("should reject negative commission_fixed", () => {
        const result = professionalSchema.safeParse({ ...validProfessional, commission_fixed: -10 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Comissão fixa não pode ser negativa");
    });

    it("should reject invalid color format", () => {
        const result = professionalSchema.safeParse({ ...validProfessional, cor_agenda: "red" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Cor inválida");
    });

    it("should reject invalid tipo_contratacao", () => {
        const result = professionalSchema.safeParse({ ...validProfessional, tipo_contratacao: "freelancer" });
        expect(result.success).toBe(false);
    });

    it("should reject missing required fields", () => {
        const result = professionalSchema.safeParse({ nome: "Ana Souza" });
        expect(result.success).toBe(false);
        expect(result.error?.issues.length).toBeGreaterThanOrEqual(2);
    });
});
