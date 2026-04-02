import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────

export interface Clinic {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
  created_at: string;
  [key: string]: unknown;
}

export interface RevenueMetrics {
  mrr: number;
  cac: number;
  ltv: number;
  churnRate: number;
  growth: number;
  activeClinics: number;
  totalRevenue: number;
}

export interface FeatureFlag {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  plano_minimo: string | null;
  categoria: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface MasterUser {
  id: string;
  nome: string | null;
  email: string | null;
  role: string;
  ativo: boolean;
  last_login: string | null;
  created_at: string;
}

export interface ClinicStats {
  clinicId: string;
  totalPatients: number;
  totalAppointments: number;
  activeAppointments: number;
}

// ─── Service Functions ──────────────────────────────────────

export async function getClinics(): Promise<Clinic[]> {
  const { data, error } = await (supabase.from("clinicas") as any)
    .select("*")
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function getRevenueMetrics(clinicId?: string): Promise<RevenueMetrics> {
  const subsQuery = (supabase.from("clinic_subscriptions") as any)
    .select("*, platform_plans(valor_mensal, nome)");
  if (clinicId) subsQuery.eq("clinic_id", clinicId);
  const { data: subs } = await subsQuery;

  const activeSubs: any[] = (subs ?? []).filter((s: any) => s.status === "ativa");
  const mrr = activeSubs.reduce(
    (acc: number, s: any) => acc + Number(s.platform_plans?.valor_mensal ?? 0),
    0,
  );

  const pagsQuery = (supabase.from("subscription_payments") as any)
    .select("valor, status, mes_referencia")
    .eq("status", "pago");
  const { data: pags } = await pagsQuery;

  const totalRevenue = (pags ?? []).reduce(
    (acc: number, p: any) => acc + Number(p.valor ?? 0),
    0,
  );

  const totalClinics = (subs ?? []).length;
  const cac = totalClinics > 0 ? totalRevenue / totalClinics : 0;
  const ltv = mrr > 0 ? mrr * 12 : 0;

  const cancelledSubs = (subs ?? []).filter((s: any) => s.status === "cancelada").length;
  const churnRate = totalClinics > 0 ? (cancelledSubs / totalClinics) * 100 : 0;

  const { data: prevSubs } = await (supabase.from("clinic_subscriptions") as any)
    .select("platform_plans(valor_mensal)")
    .eq("status", "ativa")
    .lt(
      "created_at",
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
  const prevMrr = (prevSubs ?? []).reduce(
    (acc: number, s: any) => acc + Number(s.platform_plans?.valor_mensal ?? 0),
    0,
  );
  const growth = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr) * 100 : 0;

  return { mrr, cac, ltv, churnRate, growth, activeClinics: activeSubs.length, totalRevenue };
}

export async function getFeatureFlags(clinicId?: string): Promise<FeatureFlag[]> {
  const query = (supabase.from as any)("feature_flags").select("*").order("categoria").order("nome");
  if (clinicId) query.eq("clinic_id", clinicId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateFeatureFlag(id: string, enabled: boolean): Promise<void> {
  const { error } = await (supabase.from as any)("feature_flags")
    .update({ ativo: enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  const { data, error } = await (supabase.from as any)("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getMasterUsers(): Promise<MasterUser[]> {
  const { data, error } = await (supabase.from("profiles") as any)
    .select("id, nome, email, role, ativo, last_login, created_at")
    .in("role", ["master", "admin"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface CreateMasterUserData {
  nome: string;
  email: string;
  role: "master" | "admin";
}

export async function createMasterUser(userData: CreateMasterUserData): Promise<void> {
  const { error } = await supabase.auth.admin.inviteUserByEmail(userData.email, {
    data: { nome: userData.nome, role: userData.role },
  });
  if (error) throw error;
}

export async function getClinicStats(clinicId: string): Promise<ClinicStats> {
  const [patientsRes, appointmentsRes] = await Promise.all([
    (supabase.from("pacientes") as any)
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
    (supabase.from("agendamentos") as any)
      .select("id, status", { count: "exact", head: false })
      .eq("clinic_id", clinicId),
  ]);

  const totalPatients = patientsRes.count ?? 0;
  const appointments: any[] = appointmentsRes.data ?? [];
  const activeAppointments = appointments.filter(
    (a: any) => a.status === "confirmado" || a.status === "pendente",
  ).length;

  return {
    clinicId,
    totalPatients,
    totalAppointments: appointments.length,
    activeAppointments,
  };
}
