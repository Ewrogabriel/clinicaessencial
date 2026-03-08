/**
 * Shared TypeScript interfaces for all major database entities
 * These should be used across components to ensure type safety
 */

import type { Database } from "@/integrations/supabase/types";

// Supabase table types
export type StatusAgendamento = Database["public"]["Enums"]["status_agendamento"];
export type StatusPaciente = Database["public"]["Enums"]["status_paciente"];
export type StatusPlano = Database["public"]["Enums"]["status_plano"];
export type StatusPagamento = Database["public"]["Enums"]["status_pagamento"];
export type FormaPagamento = Database["public"]["Enums"]["forma_pagamento"];
export type TipoSessao = Database["public"]["Enums"]["tipo_sessao"];
export type AppRole = "admin" | "profissional" | "paciente" | "gestor" | "secretario";

// Core entity interfaces
export interface Paciente {
  id: string;
  nome: string;
  email?: string | null;
  telefone: string;
  cpf?: string | null;
  data_nascimento?: string | null;
  status: StatusPaciente;
  tipo_atendimento: string;
  profissional_id?: string | null;
  user_id?: string | null;
  observacoes?: string | null;
  foto_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PacienteBasic {
  id: string;
  nome: string;
  telefone?: string;
}

export interface Profissional {
  id: string;
  user_id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  especialidade?: string | null;
  cor_agenda?: string | null;
  commission_rate?: number | null;
  commission_fixed?: number | null;
  registro_profissional?: string | null;
  tipo_contratacao?: string | null;
}

export interface ProfissionalBasic {
  id: string;
  user_id: string;
  nome: string;
  cor_agenda?: string | null;
}

export interface Agendamento {
  id: string;
  paciente_id: string;
  profissional_id: string;
  data_horario: string;
  duracao_minutos: number;
  tipo_atendimento: string;
  tipo_sessao: TipoSessao;
  status: StatusAgendamento;
  observacoes?: string | null;
  recorrente: boolean;
  recorrencia_grupo_id?: string | null;
  dias_semana?: number[] | null;
  frequencia_semanal?: number | null;
  recorrencia_fim?: string | null;
  enrollment_id?: string | null;
  valor_sessao?: number | null;
  valor_mensal?: number | null;
  checkin_paciente?: boolean | null;
  checkin_paciente_at?: string | null;
  checkin_profissional?: boolean | null;
  checkin_profissional_at?: string | null;
  created_at: string;
  created_by: string;
  // Relations
  pacientes?: PacienteBasic | null;
  profiles?: { nome: string } | null;
}

export interface Modalidade {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  created_at: string;
  created_by: string;
}

export interface Plano {
  id: string;
  paciente_id: string;
  profissional_id: string;
  tipo_atendimento: string;
  total_sessoes: number;
  sessoes_utilizadas: number;
  valor: number;
  status: StatusPlano;
  data_inicio: string;
  data_vencimento?: string | null;
  observacoes?: string | null;
  created_at: string;
  created_by: string;
  // Relations
  pacientes?: PacienteBasic | null;
  profiles?: { nome: string } | null;
}

export interface Matricula {
  id: string;
  paciente_id: string;
  profissional_id: string;
  tipo: string;
  tipo_atendimento: string;
  valor_mensal: number;
  data_inicio: string;
  data_vencimento?: string | null;
  due_day: number;
  auto_renew: boolean;
  status: string;
  desconto?: number | null;
  cancellation_date?: string | null;
  observacoes?: string | null;
  criada_por: string;
  created_at: string;
  // Relations
  pacientes?: PacienteBasic | null;
}

export interface Pagamento {
  id: string;
  paciente_id: string;
  profissional_id: string;
  plano_id?: string | null;
  valor: number;
  data_pagamento: string;
  data_vencimento?: string | null;
  forma_pagamento?: FormaPagamento | null;
  status: StatusPagamento;
  descricao?: string | null;
  observacoes?: string | null;
  created_at: string;
  created_by: string;
  // Relations
  pacientes?: PacienteBasic | null;
  profiles?: { nome: string } | null;
}

export interface ClinicSettings {
  id: string;
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  instagram?: string | null;
  logo_url?: string | null;
}

export interface Despesa {
  id: string;
  clinic_id: string;
  descricao: string;
  valor: number;
  categoria?: string | null;
  status: string;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  created_at: string;
}

export interface Comissao {
  id: string;
  professional_id: string;
  clinic_id: string;
  agendamento_id?: string | null;
  valor: number;
  status: string;
  created_at: string;
}

export interface UserPermission {
  resource: string;
  access_level: "view" | "edit";
}

export interface UserRecord {
  id: string;
  user_id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  role: AppRole;
  especialidade?: string | null;
  commission_rate?: number | null;
  commission_fixed?: number | null;
  cor_agenda?: string | null;
  tipo_contratacao?: string | null;
  permissions: UserPermission[];
}

// Report interfaces
export interface ProfissionalStats {
  id: string;
  nome: string;
  realizados: number;
  faltas: number;
  cancelados: number;
  total: number;
  valor: number;
  taxaPresenca: number;
}

export interface AgendamentoRelatorio extends Agendamento {
  paciente_telefone?: string;
}

// Status badge configuration type
export interface StatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}
