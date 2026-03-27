import { Database as DatabaseGenerated } from "@/integrations/supabase/types";

export type Tables<T extends keyof DatabaseGenerated["public"]["Tables"]> =
  DatabaseGenerated["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof DatabaseGenerated["public"]["Enums"]> =
  DatabaseGenerated["public"]["Enums"][T];

// Core Entities
export type Patient = Tables<"pacientes">;
export type Appointment = Tables<"agendamentos">;
export type Payment = Tables<"pagamentos">;
export type Professional = Tables<"profiles">;
export type Clinic = Tables<"clinicas">;
export type Enrollment = Tables<"matriculas">;
export type BankAccount = Tables<"bank_accounts">;
export type BankTransaction = Tables<"bank_transactions">;
export type FinancialCategory = Tables<"financial_categories">;

// SaaS Entities
export type SaaSPlan = Tables<"saas_plans">;
export type SaasSubscription = Tables<"saas_subscriptions">;

// Specialized / Unified Types
export interface UnifiedPayment extends Payment {
  paciente_nome?: string;
  profissional_nome?: string;
  agendamento_data?: string;
  status_agendamento?: string;
}

export interface BI_Metrics {
  mrr: number;
  ltv: number;
  churn_rate: number;
  cac: number;
  roi: number;
  active_subscriptions: number;
  total_revenue: number;
}
