/**
 * Consolidated shared TypeScript types for all major entities.
 *
 * This is the SINGLE source of truth for shared types across the application.
 * Import from this file instead of defining local duplicates.
 *
 * Re-exports the canonical types from `src/types/entities.ts` and adds
 * additional unified/specialized types used across multiple modules.
 */

// ── Re-export canonical entity types ─────────────────────────────────────────
export type {
  StatusAgendamento,
  StatusPaciente,
  StatusPlano,
  StatusPagamento,
  FormaPagamento,
  TipoSessao,
  AppRole,
  Paciente,
  PacienteBasic,
  Profissional,
  ProfissionalBasic,
  Agendamento,
  Modalidade,
  Plano,
  Matricula,
  Pagamento,
  ClinicSettings,
  ClinicGroup,
  ClinicGroupMember,
  ClinicWithGroup,
  Despesa,
  Comissao,
  UserPermission,
  UserRecord,
  ProfissionalStats,
  AgendamentoRelatorio,
  StatusConfig,
} from "@/types/entities";

// ── Payment / Finance ─────────────────────────────────────────────────────────

/**
 * Unified payment entry that normalises rows from different source tables
 * (pagamentos, mensalidades, sessao_pagamentos) into a single shape.
 */
export interface PaymentEntry {
  id: string;
  paciente_id: string;
  valor: number;
  /** ISO date string */
  data_pagamento?: string | null;
  /** ISO date string */
  data_vencimento?: string | null;
  status: "pago" | "pendente" | "atrasado" | "cancelado" | "nao_iniciado" | "parcialmente_pago";
  /** Which table/concept originated this row */
  origem_tipo:
    | "matricula"
    | "mensalidade"
    | "sessao_avulsa"
    | "plano"
    | "ajuste"
    | "credito"
    | "pagamento";
  descricao?: string | null;
  forma_pagamento?: string | null;
  profissional_nome?: string | null;
  paciente_nome?: string | null;
  /** Number of days past due (calculated at fetch time) */
  dias_atraso?: number | null;
  /** Reference month for mensalidades/matriculas (YYYY-MM) */
  mes_referencia?: string | null;
  /** Source table identifier for reconciliation */
  source_table?: string;
}

/**
 * Financial summary for a patient or clinic period.
 */
export interface FinancialSummary {
  total_debito: number;
  total_pago: number;
  total_pendente: number;
  total_atrasado: number;
  saldo_devedor: number;
}

// ── Investment ────────────────────────────────────────────────────────────────

export type InvestmentType =
  | "CDB"
  | "LCI"
  | "LCA"
  | "Tesouro Direto"
  | "Fundo"
  | "Ações"
  | "Renda Fixa"
  | "Outros";

export interface Investment {
  id: string;
  clinic_id: string | null;
  tipo: InvestmentType;
  instituicao: string;
  descricao?: string | null;
  valor_aplicado: number;
  data_aplicacao: string;
  data_vencimento?: string | null;
  rentabilidade?: number | null;
  status: "ativo" | "resgatado" | "vencido";
  bank_transaction_id?: string | null;
  created_at: string;
}

export interface InvestmentTransaction {
  id: string;
  investment_id: string;
  tipo: "aplicacao" | "resgate" | "rendimento";
  valor: number;
  data: string;
  observacoes?: string | null;
  created_at: string;
}

// ── Bank / Reconciliation ─────────────────────────────────────────────────────

export interface BankTransactionRow {
  id: string;
  bank_account_id: string;
  clinic_id: string | null;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  status: "pendente" | "aprovado" | "rejeitado";
  batch_id?: string | null;
  documento?: string | null;
  saldo?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  payment_id?: string | null;
  investment_id?: string | null;
  created_at: string;
}

// ── Appointment (UI row) ──────────────────────────────────────────────────────

/**
 * Appointment enriched with joined relation fields for table display.
 */
export interface AppointmentRow {
  id: string;
  paciente_id: string;
  profissional_id: string;
  clinic_id?: string | null;
  data_horario: string;
  duracao_minutos: number;
  tipo_atendimento: string;
  tipo_sessao: string;
  status: string;
  observacoes?: string | null;
  valor_sessao?: number | null;
  paciente_nome?: string;
  profissional_nome?: string;
  checkin_paciente?: boolean | null;
  checkin_profissional?: boolean | null;
}

// ── Patient (UI row) ─────────────────────────────────────────────────────────

/**
 * Patient row enriched with computed/joined display fields.
 */
export interface PatientRow {
  id: string;
  nome: string;
  email?: string | null;
  telefone: string;
  cpf?: string | null;
  data_nascimento?: string | null;
  status: string;
  tipo_atendimento: string;
  /** Computed: professional's display name */
  profissional_nome?: string | null;
  created_at: string;
}
