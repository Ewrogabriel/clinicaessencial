/**
 * RoutesConfig.ts – Centralized route documentation for the application.
 *
 * Organizes all 60+ routes into logical groups with descriptions and role requirements.
 * Keep this file in sync with src/App.tsx whenever routes are added, changed or removed.
 */

export type RouteRole =
  | "public"
  | "authenticated"
  | "admin"
  | "gestor"
  | "secretario"
  | "profissional"
  | "paciente"
  | "master";

export interface RouteDefinition {
  path: string;
  description: string;
  /** Roles that may access this route. Empty array means any authenticated user. */
  roles: RouteRole[];
  /** When true the route redirects to `redirectTo`. */
  isRedirect?: boolean;
  redirectTo?: string;
  /** True for routes accessible without authentication. */
  isPublic?: boolean;
}

// ─── Public / Auth routes ─────────────────────────────────────────────────────

export const authRoutes: RouteDefinition[] = [
  {
    path: "/",
    description: "Root redirect – sends authenticated users to /dashboard, others to /login.",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/login",
    description: "Login page with email + password authentication.",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/reset-password",
    description: "Password-reset flow (email link → new password).",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/paciente-access",
    description: "Patient self-service entry point (CPF-based access).",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/onboarding/:id",
    description: "Post-signup wizard for a newly invited patient.",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/pre-cadastro",
    description: "Anonymous pre-registration form for prospective patients.",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/site",
    description: "Public landing / marketing page.",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/confirmar-agendamento/:id",
    description: "Confirmation page reached via SMS/email link – no login required.",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/verificar-documento/:id",
    description: "Document verification page accessible without login.",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/verificar-documento",
    description: "Document verification by QR-code scan (no id in URL).",
    roles: ["public"],
    isPublic: true,
  },
  {
    path: "/selecionar-clinica",
    description: "Clinic selector shown after login when the user belongs to multiple clinics.",
    roles: ["authenticated"],
  },
];

// ─── Protected / main-app routes ─────────────────────────────────────────────

export const protectedRoutes: RouteDefinition[] = [
  {
    path: "/dashboard",
    description:
      "Smart dashboard – renders admin, professional or patient view depending on the current role.",
    roles: ["authenticated"],
  },
  {
    path: "/pacientes",
    description: "Patient list with search, filters and quick actions.",
    roles: ["admin", "gestor", "secretario", "profissional"],
  },
  {
    path: "/pacientes/novo",
    description: "Create a new patient record.",
    roles: ["admin", "gestor", "secretario"],
  },
  {
    path: "/pacientes/:id",
    description: "Edit an existing patient record.",
    roles: ["admin", "gestor", "secretario"],
  },
  {
    path: "/pacientes/:id/detalhes",
    description: "Read-only patient detail view with all linked data.",
    roles: ["admin", "gestor", "secretario", "profissional"],
  },
  {
    path: "/prontuarios",
    description: "Medical records / SOAP notes.",
    roles: ["admin", "gestor", "secretario", "profissional"],
  },
  {
    path: "/documentos-clinicos",
    description: "Signed clinical documents and attachments.",
    roles: ["authenticated"],
  },
  {
    path: "/agenda",
    description: "Appointment calendar with day/week/month views.",
    roles: ["admin", "gestor", "secretario", "profissional"],
  },
  {
    path: "/minha-agenda",
    description: "Patient's own appointment list.",
    roles: ["paciente"],
  },
  {
    path: "/meus-pagamentos",
    description: "Patient's payment history.",
    roles: ["paciente"],
  },
  {
    path: "/meus-planos",
    description: "Patient's active subscription plans.",
    roles: ["paciente"],
  },
  {
    path: "/meu-perfil",
    description: "Personal profile – role-aware toggle renders professional or patient profile.",
    roles: ["authenticated"],
  },
  {
    path: "/meu-historico",
    description: "Patient's session history.",
    roles: ["paciente"],
  },
  {
    path: "/matriculas",
    description: "Enrollment (subscription) management.",
    roles: ["admin", "gestor", "secretario"],
  },
  {
    path: "/inventario",
    description: "Supplies and equipment inventory.",
    roles: ["admin", "gestor", "secretario"],
  },
  {
    path: "/financeiro",
    description: "Financial overview, invoices, payments (tabs).",
    roles: ["admin", "gestor", "master", "secretario"],
  },
  {
    path: "/conciliacao-bancaria",
    description: "Bank reconciliation: main menu entry with full integration (transactions, patients, payments, accounts).",
    roles: ["admin", "gestor", "master", "secretario"],
  },
  {
    path: "/inteligencia-bi",
    description: "Business-intelligence charts and KPIs.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/relatorios",
    description: "Printable / exportable clinic reports.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/modalidades",
    description: "Treatment modalities catalogue.",
    roles: ["authenticated"],
  },
  {
    path: "/profissionais",
    description: "Staff (professionals) management.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/disponibilidade",
    description: "Professional working-hours configuration.",
    roles: ["authenticated"],
  },
  {
    path: "/automacoes",
    description: "Notification and workflow automations.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/whatsapp/logs",
    description: "WhatsApp message logs and monitoring dashboard.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/avisos",
    description: "Clinic-wide announcements.",
    roles: ["authenticated"],
  },
  {
    path: "/contratos",
    description: "Patient service contracts.",
    roles: ["authenticated"],
  },
  {
    path: "/comissoes",
    description: "Professional commissions.",
    roles: ["authenticated"],
  },
  {
    path: "/perfil-profissional",
    description: "Professional's own profile (bio, photo, specialties).",
    roles: ["profissional", "admin", "gestor", "secretario", "master"],
  },
  {
    path: "/profissional/:userId",
    description: "Public-facing professional profile page.",
    roles: ["authenticated"],
  },
  {
    path: "/clinica",
    description: "Clinic settings (name, logo, address, LGPD).",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/mensagens",
    description: "Internal messaging between staff and patients.",
    roles: ["authenticated"],
  },
  {
    path: "/solicitacoes-alteracao",
    description: "Patient data-change requests awaiting staff approval.",
    roles: ["admin", "gestor", "master", "secretario"],
  },
  {
    path: "/convenios",
    description: "Health insurance / convenio management.",
    roles: ["authenticated"],
  },
  {
    path: "/pre-cadastros",
    description: "Admin view of pending anonymous pre-registrations.",
    roles: ["admin", "gestor", "master", "secretario"],
  },
  {
    path: "/gestao-clinicas",
    description: "Multi-unit clinic management.",
    roles: ["admin", "master"],
  },
  {
    path: "/importacao",
    description: "Bulk patient/data import.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/metas",
    description: "Gamification goals & targets configuration.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/gamificacao-admin",
    description: "Gamification system admin panel.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/marketing",
    description: "Marketing campaigns and channels.",
    roles: ["admin", "gestor", "master"],
  },
  {
    path: "/teleconsulta",
    description: "Video teleconsultation room (staff side).",
    roles: ["authenticated"],
  },
  {
    path: "/teleconsulta-hub",
    description: "Teleconsultation entry / lobby for patients.",
    roles: ["authenticated"],
  },
  {
    path: "/planos-exercicios",
    description: "Exercise plan library and assignment.",
    roles: ["authenticated"],
  },
  {
    path: "/planos",
    description: "Subscription plan catalogue.",
    roles: ["authenticated"],
  },
  {
    path: "/confirmacoes-dia",
    description: "Daily appointment confirmation dashboard.",
    roles: ["admin", "gestor", "master", "secretario"],
  },
  {
    path: "/gamificacao/ranking",
    description: "Patient gamification leaderboard.",
    roles: ["paciente"],
  },
  {
    path: "/gamificacao/recompensas",
    description: "Patient rewards catalogue.",
    roles: ["paciente"],
  },
  {
    path: "/investimentos",
    description: "Clinic investment / asset tracking.",
    roles: ["admin", "gestor", "master"],
  },
];

// ─── Admin / Master-only routes ───────────────────────────────────────────────

export const adminRoutes: RouteDefinition[] = [
  {
    path: "/master",
    description: "Master super-admin panel.",
    roles: ["master"],
  },
  {
    path: "/master/clinicas",
    description: "Clinic management for master admins.",
    roles: ["master"],
  },
  {
    path: "/master/revenue",
    description: "Platform revenue analytics.",
    roles: ["master"],
  },
  {
    path: "/master/features",
    description: "Feature flags control panel.",
    roles: ["master"],
  },
  {
    path: "/master/users",
    description: "Platform-wide user management.",
    roles: ["master"],
  },
  {
    path: "/master/audit",
    description: "Audit log viewer.",
    roles: ["master"],
  },
];

// ─── Legacy redirect routes ───────────────────────────────────────────────────

export const redirectRoutes: RouteDefinition[] = [
  {
    path: "/agenda-premium",
    description: "Deprecated – redirects to /agenda?tab=vagas.",
    roles: ["authenticated"],
    isRedirect: true,
    redirectTo: "/agenda?tab=vagas",
  },
];

// ─── Aggregated exports ───────────────────────────────────────────────────────

export const allRoutes: RouteDefinition[] = [
  ...authRoutes,
  ...protectedRoutes,
  ...adminRoutes,
  ...redirectRoutes,
];

/** Returns only non-redirect routes that require a given role. */
export function getRoutesForRole(role: RouteRole): RouteDefinition[] {
  return allRoutes.filter(
    (r) =>
      !r.isRedirect &&
      (r.isPublic || r.roles.includes("authenticated") || r.roles.includes(role)),
  );
}
