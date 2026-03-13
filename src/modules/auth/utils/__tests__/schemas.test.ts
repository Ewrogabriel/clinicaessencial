import { describe, it, expect } from "vitest";
import { loginSchema, resetPasswordSchema } from "../schemas";

describe("Auth Schemas", () => {
    describe("loginSchema", () => {
        it("should accept valid credentials", () => {
            const result = loginSchema.safeParse({
                identifier: "user@clinic.com",
                senha: "senha123",
            });
            expect(result.success).toBe(true);
        });

        it("should accept CPF as identifier", () => {
            const result = loginSchema.safeParse({
                identifier: "123.456.789-09",
                senha: "senha123",
            });
            expect(result.success).toBe(true);
        });

        it("should reject empty identifier", () => {
            const result = loginSchema.safeParse({
                identifier: "",
                senha: "senha123",
            });
            expect(result.success).toBe(false);
            expect(result.error?.issues[0].message).toBe("E-mail ou CPF é obrigatório");
        });

        it("should reject password shorter than 6 characters", () => {
            const result = loginSchema.safeParse({
                identifier: "user@clinic.com",
                senha: "123",
            });
            expect(result.success).toBe(false);
            expect(result.error?.issues[0].message).toBe("Senha deve ter pelo menos 6 caracteres");
        });

        it("should reject missing fields", () => {
            const result = loginSchema.safeParse({});
            expect(result.success).toBe(false);
            expect(result.error?.issues.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe("resetPasswordSchema", () => {
        it("should accept valid email", () => {
            const result = resetPasswordSchema.safeParse({ email: "user@clinic.com" });
            expect(result.success).toBe(true);
        });

        it("should reject invalid email", () => {
            const result = resetPasswordSchema.safeParse({ email: "not-an-email" });
            expect(result.success).toBe(false);
            expect(result.error?.issues[0].message).toBe("E-mail inválido");
        });

        it("should reject empty email", () => {
            const result = resetPasswordSchema.safeParse({ email: "" });
            expect(result.success).toBe(false);
        });
    });
});
