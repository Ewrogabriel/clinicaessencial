import { z } from "zod";

export const appointmentSchema = z.object({
    paciente_id: z.string().uuid("Paciente é obrigatório"),
    profissional_id: z.string().uuid("Profissional é obrigatório"),
    clinic_id: z.string().uuid("Unidade é obrigatória"),
    data_horario: z.string().refine((val) => !isNaN(Date.parse(val)), "Data inválida"),
    tipo_atendimento: z.string().min(2, "Tipo de atendimento é obrigatório"),
    valor_sessao: z.number().min(0, "Valor não pode ser negativo"),
    observacoes: z.string().optional(),
});

export type AppointmentSchema = z.infer<typeof appointmentSchema>;
