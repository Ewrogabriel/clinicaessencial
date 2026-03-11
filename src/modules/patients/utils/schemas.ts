import { z } from "zod";

export const patientSchema = z.object({
    nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido (000.000.000-00)"),
    telefone: z.string().min(10, "Telefone inválido"),
    email: z.string().email("E-mail inválido").optional().or(z.literal("")),
    data_nascimento: z.string().optional(),
    status: z.enum(["ativo", "inativo"]).default("ativo"),
    tipo_atendimento: z.string().optional(),
});

export type PatientSchema = z.infer<typeof patientSchema>;
