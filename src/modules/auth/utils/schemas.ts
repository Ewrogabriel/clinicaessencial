import { z } from "zod";

export const loginSchema = z.object({
    identifier: z.string().min(1, "E-mail ou CPF é obrigatório"),
    senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export const resetPasswordSchema = z.object({
    email: z.string().email("E-mail inválido"),
});

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
