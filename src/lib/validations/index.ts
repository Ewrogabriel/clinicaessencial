import { z } from "zod";

// ========== Utility Validators ==========

export const cpfSchema = z.string()
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => val === "" || val.length === 11, {
    message: "CPF deve ter 11 digitos",
  })
  .refine((val) => {
    if (val === "" || val.length !== 11) return true;
    // Validate CPF checksum
    if (/^(\d)\1+$/.test(val)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(val[i]) * (10 - i);
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(val[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(val[i]) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(val[10]);
  }, { message: "CPF invalido" });

export const phoneSchema = z.string()
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => val === "" || (val.length >= 10 && val.length <= 11), {
    message: "Telefone deve ter 10 ou 11 digitos",
  });

export const emailSchema = z.string()
  .email({ message: "E-mail invalido" })
  .or(z.literal(""));

export const cepSchema = z.string()
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => val === "" || val.length === 8, {
    message: "CEP deve ter 8 digitos",
  });

export const dateSchema = z.string()
  .refine((val) => val === "" || !isNaN(Date.parse(val)), {
    message: "Data invalida",
  });

// ========== Patient Schema ==========

export const pacienteSchema = z.object({
  nome: z.string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome muito longo"),
  cpf: cpfSchema.optional(),
  rg: z.string().max(20).optional(),
  telefone: phoneSchema.optional(),
  email: emailSchema.optional(),
  data_nascimento: dateSchema.optional(),
  foto_url: z.string().url().optional().or(z.literal("")),
  
  // Address
  cep: cepSchema.optional(),
  rua: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  
  // Clinical
  tipo_atendimento: z.string().min(1, "Selecione o tipo de atendimento"),
  status: z.enum(["ativo", "inativo"]).default("ativo"),
  observacoes: z.string().max(2000).optional(),
  
  // Legal guardian
  tem_responsavel_legal: z.boolean().default(false),
  responsavel_nome: z.string().max(100).optional(),
  responsavel_cpf: cpfSchema.optional(),
  responsavel_rg: z.string().max(20).optional(),
  responsavel_telefone: phoneSchema.optional(),
  responsavel_email: emailSchema.optional(),
  responsavel_parentesco: z.string().max(50).optional(),
  responsavel_cep: cepSchema.optional(),
  responsavel_rua: z.string().max(200).optional(),
  responsavel_numero: z.string().max(20).optional(),
  responsavel_complemento: z.string().max(100).optional(),
  responsavel_bairro: z.string().max(100).optional(),
  responsavel_cidade: z.string().max(100).optional(),
  responsavel_estado: z.string().max(2).optional(),
}).refine((data) => {
  // If has legal guardian, require at least the name
  if (data.tem_responsavel_legal && !data.responsavel_nome) {
    return false;
  }
  return true;
}, {
  message: "Nome do responsavel e obrigatorio quando tem responsavel legal",
  path: ["responsavel_nome"],
});

export type PacienteFormData = z.infer<typeof pacienteSchema>;

// ========== Matricula Schema ==========

export const matriculaSchema = z.object({
  paciente_id: z.string().uuid("Selecione um paciente"),
  plano_id: z.string().uuid("Selecione um plano"),
  profissional_id: z.string().uuid("Selecione um profissional").optional(),
  modalidade_id: z.string().uuid("Selecione uma modalidade"),
  data_inicio: z.string().min(1, "Data de inicio e obrigatoria"),
  data_fim: z.string().optional(),
  valor_mensal: z.number().min(0, "Valor deve ser positivo").optional(),
  valor_sessao: z.number().min(0, "Valor deve ser positivo").optional(),
  frequencia_semanal: z.number().min(1).max(7).default(2),
  dias_semana: z.array(z.number().min(0).max(6)).default([]),
  horarios: z.record(z.string(), z.string()).default({}),
  observacoes: z.string().max(2000).optional(),
  status: z.enum(["ativa", "suspensa", "cancelada", "concluida"]).default("ativa"),
});

export type MatriculaFormData = z.infer<typeof matriculaSchema>;

// ========== Plan Schema ==========

export const planoSchema = z.object({
  paciente_id: z.string().uuid("Selecione um paciente"),
  tipo_atendimento: z.string().min(1, "Selecione a modalidade"),
  total_sessoes: z.number().min(1, "Minimo de 1 sessao").max(200),
  sessoes_utilizadas: z.number().min(0).default(0),
  data_inicio: z.string().min(1, "Data de inicio e obrigatoria"),
  data_vencimento: z.string().min(1, "Data de vencimento e obrigatoria"),
  valor_total: z.number().min(0, "Valor deve ser positivo"),
  valor_sessao: z.number().min(0).optional(),
  forma_pagamento: z.string().optional(),
  observacoes: z.string().max(2000).optional(),
  status: z.enum(["ativo", "pausado", "finalizado", "cancelado"]).default("ativo"),
});

export type PlanoFormData = z.infer<typeof planoSchema>;

// ========== Payment Schema ==========

export const pagamentoSchema = z.object({
  paciente_id: z.string().uuid("Selecione um paciente"),
  valor: z.number().min(0.01, "Valor deve ser maior que zero"),
  data_vencimento: z.string().min(1, "Data de vencimento e obrigatoria"),
  data_pagamento: z.string().optional(),
  forma_pagamento: z.string().optional(),
  referencia: z.string().max(200).optional(),
  observacoes: z.string().max(500).optional(),
  status: z.enum(["pendente", "pago", "cancelado", "atrasado"]).default("pendente"),
});

export type PagamentoFormData = z.infer<typeof pagamentoSchema>;

// ========== Professional Profile Schema ==========

export const perfilProfissionalSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  email: z.string().email("E-mail invalido"),
  telefone: phoneSchema.optional(),
  crefito: z.string().max(20).optional(),
  especialidade: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  foto_url: z.string().url().optional().or(z.literal("")),
});

export type PerfilProfissionalFormData = z.infer<typeof perfilProfissionalSchema>;

// ========== Commission Schema ==========

export const comissaoSchema = z.object({
  profissional_id: z.string().uuid("Selecione um profissional"),
  modalidade_id: z.string().uuid().optional(),
  tipo: z.enum(["percentual", "fixo"]).default("percentual"),
  valor: z.number().min(0).max(100),
  ativo: z.boolean().default(true),
});

export type ComissaoFormData = z.infer<typeof comissaoSchema>;

// ========== Product Schema ==========

export const produtoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  descricao: z.string().max(500).optional(),
  preco: z.number().min(0.01, "Preco deve ser maior que zero"),
  estoque: z.number().min(0, "Estoque nao pode ser negativo").int(),
  ativo: z.boolean().default(true),
});

export type ProdutoFormData = z.infer<typeof produtoSchema>;

// ========== Expense Schema ==========

export const despesaSchema = z.object({
  descricao: z.string().min(3, "Descricao deve ter pelo menos 3 caracteres").max(200),
  valor: z.number().min(0.01, "Valor deve ser maior que zero"),
  data: z.string().min(1, "Data e obrigatoria"),
  categoria: z.string().max(50).optional(),
  forma_pagamento: z.string().max(50).optional(),
  observacoes: z.string().max(500).optional(),
  recorrente: z.boolean().default(false),
});

export type DespesaFormData = z.infer<typeof despesaSchema>;

// ========== Clinic Settings Schema ==========

export const clinicaSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  cnpj: z.string()
    .transform((val) => val.replace(/\D/g, ""))
    .refine((val) => val === "" || val.length === 14, {
      message: "CNPJ deve ter 14 digitos",
    })
    .optional(),
  telefone: phoneSchema.optional(),
  whatsapp: phoneSchema.optional(),
  email: emailSchema.optional(),
  endereco: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: cepSchema.optional(),
  instagram: z.string().max(100).optional(),
  logo_url: z.string().url().optional().or(z.literal("")),
});

export type ClinicaFormData = z.infer<typeof clinicaSchema>;

// ========== Form Helper ==========

/**
 * Helper to validate form data and return errors
 */
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return { success: false, errors };
}
