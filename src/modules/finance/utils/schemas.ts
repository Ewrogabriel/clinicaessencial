import { z } from "zod";

export const financeSchema = z.object({
    paciente_id: z.string().uuid("Paciente é obrigatório"),
    valor: z.number().min(0.01, "Valor deve ser maior que zero"),
    data_vencimento: z.string().datetime("Data de vencimento inválida"),
    status: z.enum(["pendente", "pago", "cancelado"]).default("pendente"),
    forma_pagamento_id: z.string().uuid("Forma de pagamento é obrigatória").optional(),
    descricao: z.string().max(200, "Descrição muito longa").optional(),
});

export type FinanceSchema = z.infer<typeof financeSchema>;
