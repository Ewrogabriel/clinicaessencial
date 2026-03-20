/**
 * Centralized React Query cache key factory.
 *
 * Rules:
 * - Keys are always arrays so React Query can do partial invalidation.
 * - Pass optional parameters as subsequent array elements so callers can
 *   invalidate whole domains (e.g. `queryKeys.patients.all`) or specific
 *   records (e.g. `queryKeys.patients.detail(id)`).
 *
 * Usage:
 *   queryKey: queryKeys.patients.list(clinicId)
 *   queryClient.invalidateQueries({ queryKey: queryKeys.patients.all })
 */

export const queryKeys = {
  // ── Patients ──────────────────────────────────────────────────────────────
  patients: {
    all: ["pacientes"] as const,
    list: (clinicId: string | null, status?: string) =>
      status
        ? (["pacientes", status, clinicId] as const)
        : (["pacientes", clinicId] as const),
    detail: (id: string) => ["pacientes", "detail", id] as const,
  },

  // ── Appointments / Scheduling ─────────────────────────────────────────────
  appointments: {
    all: ["agendamentos"] as const,
    list: (clinicId: string | null, patientId?: string) =>
      ["agendamentos", clinicId, patientId] as const,
    today: (clinicId: string | null) =>
      ["agendamentos", "today", clinicId] as const,
    byProfessional: (profId: string, clinicId: string | null) =>
      ["agendamentos", "professional", profId, clinicId] as const,
    slots: (profId: string | undefined, date: string, clinicId: string | null) =>
      ["schedule_slots", profId, date, clinicId] as const,
  },

  // ── Professionals ─────────────────────────────────────────────────────────
  professionals: {
    all: ["profissionais"] as const,
    list: (clinicId: string | null) => ["profissionais", clinicId] as const,
    detail: (userId: string) => ["profissionais", "detail", userId] as const,
    availability: (profId: string, clinicId: string | null) =>
      ["disponibilidade", profId, clinicId] as const,
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  finance: {
    all: ["financeiro"] as const,
    payments: (clinicId: string | null) =>
      ["financeiro", "pagamentos", clinicId] as const,
    pendencias: (patientId: string) =>
      ["financeiro", "pendencias", patientId] as const,
    commissions: (clinicId: string | null) =>
      ["comissoes", clinicId] as const,
    dashboard: (start: string, clinicId: string | null) =>
      ["dashboard-finance", start, clinicId] as const,
  },

  // ── Clinical ──────────────────────────────────────────────────────────────
  clinical: {
    all: ["clinical"] as const,
    evolutions: (patientId: string) =>
      ["evolutions", patientId] as const,
    evaluations: (patientId: string) =>
      ["evaluations", patientId] as const,
  },

  // ── Clinic / Settings ─────────────────────────────────────────────────────
  clinics: {
    all: ["clinicas"] as const,
    list: () => ["clinicas"] as const,
    detail: (id: string) => ["clinicas", "detail", id] as const,
    settings: (clinicId: string | null) =>
      ["clinica-settings", clinicId] as const,
  },

  // ── Clinic Groups ─────────────────────────────────────────────────────────
  clinicGroups: {
    all: ["clinic-groups"] as const,
    list: () => ["clinic-groups"] as const,
    detail: (id: string) => ["clinic-groups", "detail", id] as const,
    members: (groupId: string) => ["clinic-groups", "members", groupId] as const,
    byClinic: (clinicId: string) => ["clinic-groups", "by-clinic", clinicId] as const,
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  inventory: {
    all: ["inventario"] as const,
    list: (clinicId: string | null) => ["inventario", clinicId] as const,
    detail: (id: string) => ["inventario", "detail", id] as const,
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    all: ["dashboard"] as const,
    stats: (clinicId: string | null) => ["dashboard", "stats", clinicId] as const,
  },
} as const;
