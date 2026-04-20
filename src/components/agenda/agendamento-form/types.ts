import { z } from "zod";

export const DIAS_SEMANA = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

export const formSchema = z.object({
  paciente_id: z.string().min(1, "Selecione um paciente"),
  profissional_id: z.string().min(1, "Selecione um profissional"),
  data: z.date({ required_error: "Selecione a data" }),
  horario: z.string().min(1, "Informe o horário"),
  slot_id: z.string().optional(),
  duracao_minutos: z.number().min(15).max(120),
  tipo_atendimento: z.string().min(1, "Selecione a modalidade"),
  tipo_sessao: z.enum(["individual", "grupo"]),
  observacoes: z.string().optional(),
  recorrente: z.boolean().default(false),
  dias_semana: z.array(z.number()).default([]),
  frequencia_semanal: z.number().min(1).max(7).default(1),
  recorrencia_semanas: z.number().min(1).max(200).default(52),
  horarios_por_dia: z.record(z.string(), z.string()).default({}),
  valor_sessao: z.number().min(0).optional(),
  valor_mensal: z.number().min(0).optional(),
  forma_pagamento: z.string().optional(),
  data_vencimento: z.string().optional(),
  repetir: z.boolean().default(false),
  repetir_tipo: z.enum(["vezes", "semanas"]).default("vezes"),
  repetir_quantidade: z.number().min(1).max(52).default(4),
}).superRefine((values, ctx) => {
  if (values.data_vencimento && values.data) {
    const [year, month, day] = values.data_vencimento.split("-").map(Number);
    const vencimento = new Date(year, month - 1, day);
    const appointmentDate = new Date(values.data);
    appointmentDate.setHours(0, 0, 0, 0);
    if (vencimento < appointmentDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data de vencimento não pode ser anterior à data do agendamento.",
        path: ["data_vencimento"],
      });
    }
  }
});

export type FormData = z.infer<typeof formSchema>;

export interface Paciente {
  id: string;
  nome: string;
  cpf?: string | null;
}

export interface Profissional {
  id: string;
  user_id: string;
  nome: string;
}

export interface Modalidade {
  id: string;
  nome: string;
}

export interface FormaPagamento {
  id: string;
  nome: string;
}

export interface PlanoItem {
  id: string;
  paciente_id: string;
  profissional_id: string;
  tipo_atendimento: string;
  total_sessoes: number;
  sessoes_utilizadas: number;
  paciente_nome?: string;
}

export interface AgendamentoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: Date;
  defaultProfissionalId?: string;
  defaultPacienteId?: string;
  defaultPlanoId?: string;
  appointmentType?: "sessao_avulsa" | "sessao_plano";
}
