import { z } from "zod";

const optionalText = (minLen: number, msg: string) =>
    z.union([z.literal(""), z.string().min(minLen, msg)]).optional();

export const professionalSchema = z.object({
    nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.string().email("E-mail inválido"),
    telefone: optionalText(10, "Telefone inválido"),
    especialidade: z.string().min(2, "Especialidade é obrigatória"),
    registro_profissional: optionalText(2, "Registro deve ter pelo menos 2 caracteres"),
    tipo_contratacao: z.enum(["clt", "pj", "autonomo"]).optional(),
    commission_rate: z.number().min(0).max(100, "Taxa deve ser entre 0 e 100").optional(),
    commission_fixed: z.number().min(0, "Comissão fixa não pode ser negativa").optional(),
    cor_agenda: z.union([z.literal(""), z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida")]).optional(),
});

export type ProfessionalSchema = z.infer<typeof professionalSchema>;
