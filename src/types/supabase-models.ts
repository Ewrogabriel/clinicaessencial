/**
 * Type-safe models for Supabase tables
 * Generated to replace `as any` casts and improve type-safety
 */

// ───── Clinic Models ─────
export interface Clinic {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  whatsapp?: string;
  instagram?: string;
  logo_url?: string;
  ativo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ClinicInsert extends Omit<Clinic, 'id' | 'created_at' | 'updated_at'> {}

export interface ClinicUpdate extends Partial<ClinicInsert> {}

// ───── Profile Models ─────
export interface Profile {
  id: string;
  user_id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  especialidade?: string;
  registro_profissional?: string;
  conselho_profissional?: string;
  registro_conselho?: string;
  assinatura_url?: string;
  rubrica_url?: string;
  foto_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProfileInsert extends Omit<Profile, 'id' | 'created_at' | 'updated_at'> {}

export interface ProfileUpdate extends Partial<ProfileInsert> {}

// ───── Patient Models ─────
export interface Patient {
  id: string;
  clinic_id: string;
  user_id?: string;
  nome: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  cpf?: string;
  rg?: string;
  mae?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  profissao?: string;
  empresa?: string;
  convenio?: string;
  ativo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PatientInsert extends Omit<Patient, 'id' | 'created_at' | 'updated_at'> {}

export interface PatientUpdate extends Partial<PatientInsert> {}

// ───── Session (Appointment) Models ─────
export interface Session {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  data: string;
  horario: string;
  duracao?: number;
  tipo?: string;
  modalidade?: string;
  local?: string;
  observacoes?: string;
  status: 'agendada' | 'confirmada' | 'realizada' | 'cancelada' | 'falta';
  created_at: string;
  updated_at?: string;
}

export interface SessionInsert extends Omit<Session, 'id' | 'created_at' | 'updated_at'> {}

export interface SessionUpdate extends Partial<SessionInsert> {}

// ───── Subscription Models ─────
export interface ClinicSubscription {
  id: string;
  clinic_id: string;
  plan_id: string;
  status: 'ativa' | 'suspensa' | 'cancelada' | 'trial' | 'pendente';
  started_at: string;
  expires_at?: string;
  auto_renew: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ClinicSubscriptionInsert extends Omit<ClinicSubscription, 'id' | 'created_at' | 'updated_at'> {}

export interface ClinicSubscriptionUpdate extends Partial<ClinicSubscriptionInsert> {}

export interface PlatformPlan {
  id: string;
  nome: string;
  descricao?: string;
  valor_mensal: number;
  valor_anual?: number;
  usuarios_limite?: number;
  armazenamento_gb?: number;
  cor?: string;
  ativo: boolean;
  features?: string[];
  created_at: string;
}

// ───── Payment Models ─────
export interface SubscriptionPayment {
  id: string;
  clinic_id: string;
  subscription_id: string;
  valor: number;
  metodo: 'pix' | 'cartao' | 'boleto' | 'transferencia';
  status: 'pendente' | 'processando' | 'pago' | 'falhou' | 'reembolsado';
  data_pagamento?: string;
  comprovante_url?: string;
  observacoes?: string;
  created_at: string;
  updated_at?: string;
}

export interface SubscriptionPaymentInsert extends Omit<SubscriptionPayment, 'id' | 'created_at' | 'updated_at'> {}

export interface SubscriptionPaymentUpdate extends Partial<SubscriptionPaymentInsert> {}

// ───── User Roles & Permissions ─────
export type AppRole = 'admin' | 'profissional' | 'paciente' | 'gestor' | 'secretario' | 'master';

export interface UserRole {
  id: string;
  user_id: string;
  clinic_id?: string;
  role: AppRole;
  created_at: string;
}

export interface UserRoleInsert extends Omit<UserRole, 'id' | 'created_at'> {}

export interface PermissionEntry {
  id: string;
  user_id: string;
  resource: string;
  access_level: 'view' | 'edit';
  enabled: boolean;
  created_at: string;
}

export interface PermissionInsert extends Omit<PermissionEntry, 'id' | 'created_at'> {}

// ───── Financial Models ─────
export interface FinancialTransaction {
  id: string;
  clinic_id: string;
  tipo: 'receita' | 'despesa';
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  comprovante_url?: string;
  status: 'pendente' | 'confirmada' | 'cancelada';
  created_at: string;
}

export interface FinancialTransactionInsert extends Omit<FinancialTransaction, 'id' | 'created_at'> {}

// ───── Audit Log Models ─────
export interface AuditLog {
  id: string;
  clinic_id: string;
  user_id: string;
  tabela: string;
  operacao: 'insert' | 'update' | 'delete';
  dados_antigos?: Record<string, any>;
  dados_novos?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ───── Helper Types ─────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

// ───── Type Guards ─────
export function isClinic(obj: any): obj is Clinic {
  return obj && typeof obj === 'object' && 'id' in obj && 'nome' in obj;
}

export function isPatient(obj: any): obj is Patient {
  return obj && typeof obj === 'object' && 'id' in obj && 'clinic_id' in obj && 'nome' in obj;
}

export function isSession(obj: any): obj is Session {
  return obj && typeof obj === 'object' && 'id' in obj && 'patient_id' in obj && 'professional_id' in obj;
}

export function isProfile(obj: any): obj is Profile {
  return obj && typeof obj === 'object' && 'id' in obj && 'user_id' in obj;
}

// ───── Query Result Types ─────
export interface QueryResult<T> {
  data: T[] | null;
  error: any | null;
}

export interface SingleQueryResult<T> {
  data: T | null;
  error: any | null;
}
