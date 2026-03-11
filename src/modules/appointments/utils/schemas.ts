import { z } from "zod";

export const appointmentSchema = z.object({
    paciente_id: z.string().uuid("Paciente é obrigatório"),
    profissional_id: z.string().uuid("Profissional é obrigatório"),
    data_horario: z.string().datetime("Data e hora inválidas"),
    status: z.enum(["agendado", "confirmado", "realizado", "cancelado", "falta"]).default("agendado"),
    modalidade_id: z.string().uuid("Modalidade é obrigatória").optional(),
    observacoes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional(),
});

export type AppointmentSchema = z.infer<typeof appointmentSchema>;
