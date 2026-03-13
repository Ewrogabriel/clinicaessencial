import { z } from "zod";

export const professionalSchema = z.object({
    nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.string().email("E-mail inválido"),
    telefone: z.string().min(10, "Telefone inválido").or(z.literal("")).optional(),
    especialidade: z.string().min(2, "Especialidade é obrigatória"),
    registro_profissional: z.string().min(2, "Registro deve ter pelo menos 2 caracteres").or(z.literal("")).optional(),
    tipo_contratacao: z.enum(["clt", "pj", "autonomo"]).optional(),
    commission_rate: z.number().min(0).max(100, "Taxa deve ser entre 0 e 100").optional(),
    commission_fixed: z.number().min(0, "Comissão fixa não pode ser negativa").optional(),
    cor_agenda: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida").or(z.literal("")).optional(),
});

export type ProfessionalSchema = z.infer<typeof professionalSchema>;
