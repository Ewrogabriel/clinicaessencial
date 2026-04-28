/**
 * menuConfig.ts
 *
 * Centralised, typed menu-group configuration for the application sidebar.
 *
 * Each MenuGroup describes a collapsible group that is shown to specific
 * roles.  Individual items may carry an optional `badge` key that
 * components can use to display notification counts.
 *
 * The actual i18n labels are resolved at render time via `useI18n` so
 * that this file stays serialisable and easy to test.
 */

import {
  LayoutDashboard, Users, Calendar, ClipboardList, DollarSign, BarChart3,
  Activity, Layers, UserCog, Receipt, Send, Megaphone,
  FileText, Tag, CreditCard, User, Calculator, MessageSquare,
  FileCheck, Handshake, Video,
  Building2, Crown, Upload, Trophy, Stethoscope, Target, Dumbbell,
  Clock, CheckCheck, Banknote, type LucideIcon, Settings, MessageCircle,
} from "lucide-react";

export type AppRole = "admin" | "gestor" | "profissional" | "secretario" | "paciente" | "master";

export interface MenuItem {
  /** i18n key used to resolve the label */
  labelKey: string;
  url: string;
  icon: LucideIcon;
  /** Optional static badge text (e.g. "NEW") or numeric counter key */
  badge?: string;
  /** Only shown when at least one of these roles is active */
  roles?: AppRole[];
}

export interface MenuGroup {
  /** i18n key for the group header */
  labelKey: string;
  items: MenuItem[];
  /** Roles that may see this whole group; undefined = all roles in context */
  roles?: AppRole[];
  /** Whether the group starts collapsed (default: false = expanded) */
  defaultCollapsed?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Master panel
// ─────────────────────────────────────────────────────────────────────────────
export const masterGroups: MenuGroup[] = [
  {
    labelKey: "group.master",
    roles: ["master"],
    items: [
      { labelKey: "nav.master_panel", url: "/master", icon: Crown },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Admin / Gestor
// ─────────────────────────────────────────────────────────────────────────────
export const adminGroups: MenuGroup[] = [
  {
    labelKey: "group.home",
    items: [
      { labelKey: "nav.home", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    labelKey: "group.patients",
    defaultCollapsed: false,
    items: [
      { labelKey: "nav.patients",   url: "/pacientes",           icon: Users },
      { labelKey: "nav.records",    url: "/prontuarios",         icon: ClipboardList },
      { labelKey: "nav.documents",  url: "/documentos-clinicos", icon: Stethoscope },
    ],
  },
  {
    labelKey: "group.scheduling",
    defaultCollapsed: false,
    items: [
      { labelKey: "nav.agenda",       url: "/agenda",           icon: Calendar },
      { labelKey: "nav.teleconsulta", url: "/teleconsulta-hub", icon: Video },
      { labelKey: "nav.confirmacoes", url: "/confirmacoes-dia", icon: CheckCheck },
      { labelKey: "nav.enrollments",  url: "/matriculas",       icon: Receipt },
      { labelKey: "nav.modalities",   url: "/modalidades",      icon: Layers },
      { labelKey: "nav.availability", url: "/disponibilidade",  icon: Clock },
    ],
  },
  {
    labelKey: "group.team",
    items: [
      { labelKey: "nav.team", url: "/profissionais", icon: UserCog },
    ],
  },
  {
    labelKey: "group.finance",
    defaultCollapsed: false,
    items: [
      { labelKey: "nav.finance",        url: "/financeiro",           icon: DollarSign },
      { labelKey: "nav.reconciliation", url: "/conciliacao-bancaria", icon: Banknote },
      { labelKey: "nav.commissions",    url: "/comissoes",            icon: Calculator },
      { labelKey: "nav.investments",    url: "/investimentos",        icon: Activity },
    ],
  },
  {
    labelKey: "group.insights",
    defaultCollapsed: false,
    items: [
      { labelKey: "nav.reports",        url: "/relatorios",      icon: BarChart3 },
      { labelKey: "nav.automations",    url: "/automacoes",      icon: Send },
      { labelKey: "nav.whatsapp_inbox", url: "/whatsapp-inbox",  icon: MessageCircle, badge: "INBOX" },
    ],
  },
  {
    labelKey: "group.clinic",
    defaultCollapsed: false,
    items: [
      { labelKey: "nav.clinic_payment",    url: "/clinica",                icon: Settings },
      { labelKey: "nav.units",             url: "/gestao-clinicas",        icon: Building2 },
      { labelKey: "nav.pre_registrations", url: "/pre-cadastros",          icon: UserCog },
      { labelKey: "nav.requests",          url: "/solicitacoes-alteracao", icon: FileCheck },
      { labelKey: "nav.inventory",         url: "/inventario",             icon: Tag },
    ],
  },
  {
    labelKey: "group.settings",
    defaultCollapsed: true,
    items: [
      { labelKey: "nav.partners",     url: "/convenios",         icon: Handshake },
      { labelKey: "nav.contracts",    url: "/contratos",         icon: FileText },
      { labelKey: "nav.marketing",    url: "/marketing",         icon: Target },
      { labelKey: "nav.clinic_site",  url: "/site-clinica",      icon: Activity },
      { labelKey: "nav.gamification", url: "/gamificacao-admin", icon: Trophy },
      { labelKey: "nav.import",       url: "/importacao",        icon: Upload },
      { labelKey: "nav.messages",     url: "/mensagens",         icon: MessageSquare },
      { labelKey: "nav.notices",      url: "/avisos",            icon: Megaphone },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Profissional
// ─────────────────────────────────────────────────────────────────────────────
export const profissionalGroups: MenuGroup[] = [
  {
    labelKey: "group.home",
    items: [
      { labelKey: "nav.home",      url: "/dashboard",    icon: LayoutDashboard },
      { labelKey: "nav.agenda",    url: "/agenda",       icon: Calendar },
      { labelKey: "nav.confirmacoes", url: "/confirmacoes-dia", icon: CheckCheck },
    ],
  },
  {
    labelKey: "group.clinical",
    items: [
      { labelKey: "nav.patients",       url: "/pacientes",           icon: Users },
      { labelKey: "nav.records",        url: "/prontuarios",         icon: ClipboardList },
      { labelKey: "nav.documents",      url: "/documentos-clinicos", icon: Stethoscope },
      { labelKey: "nav.session_plans",  url: "/planos",              icon: ClipboardList },
      { labelKey: "nav.exercise_plans", url: "/planos-exercicios",   icon: Dumbbell },
      { labelKey: "nav.teleconsulta",   url: "/teleconsulta-hub",    icon: Video },
      { labelKey: "nav.availability",   url: "/disponibilidade",     icon: Clock },
    ],
  },
  {
    labelKey: "group.management",
    items: [
      { labelKey: "nav.enrollments",      url: "/matriculas",       icon: Receipt },
      { labelKey: "nav.inventory",        url: "/inventario",       icon: Tag },
      { labelKey: "nav.whatsapp_inbox",   url: "/whatsapp-inbox",   icon: MessageCircle },
    ],
  },
  {
    labelKey: "group.finance",
    items: [
      { labelKey: "nav.commissions_mine", url: "/comissoes", icon: Calculator },
    ],
  },
  {
    labelKey: "group.settings",
    items: [
      { labelKey: "nav.my_profile", url: "/perfil-profissional", icon: User },
      { labelKey: "nav.contracts",  url: "/contratos",           icon: FileText },
      { labelKey: "nav.messages",   url: "/mensagens",           icon: MessageSquare },
      { labelKey: "nav.notices",    url: "/avisos",              icon: Megaphone },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Patient
// ─────────────────────────────────────────────────────────────────────────────
export const patientGroups: MenuGroup[] = [
  {
    labelKey: "group.home",
    items: [
      { labelKey: "nav.home",       url: "/dashboard",       icon: LayoutDashboard },
      { labelKey: "nav.my_agenda",  url: "/minha-agenda",    icon: Calendar },
    ],
  },
  {
    labelKey: "group.my_portal",
    items: [
      { labelKey: "nav.my_plans",       url: "/meus-planos",      icon: ClipboardList },
      { labelKey: "nav.my_history",     url: "/meu-historico",    icon: ClipboardList },
      { labelKey: "nav.my_payments",    url: "/meus-pagamentos",  icon: CreditCard },
      { labelKey: "nav.exercise_plans", url: "/planos-exercicios", icon: Dumbbell },
      { labelKey: "nav.teleconsulta",   url: "/teleconsulta-hub",  icon: Video },
    ],
  },
  {
    labelKey: "group.settings",
    defaultCollapsed: true,
    items: [
      { labelKey: "nav.partners",     url: "/convenios",  icon: Handshake },
      { labelKey: "nav.messages",     url: "/mensagens",  icon: MessageSquare },
      { labelKey: "nav.my_contract",  url: "/contratos",  icon: FileText },
      { labelKey: "nav.my_profile",   url: "/meu-perfil", icon: User },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Role label helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable Portuguese role labels */
export const ROLE_LABELS: Record<string, string> = {
  master:       "Master",
  admin:        "Administrador",
  gestor:       "Gestor",
  profissional: "Profissional",
  secretario:   "Secretário",
  paciente:     "Paciente",
};

/** Tailwind colour classes for each role badge */
export const ROLE_BADGE_COLORS: Record<string, string> = {
  master:       "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  admin:        "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  gestor:       "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  profissional: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  secretario:   "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  paciente:     "bg-pink-500/20 text-pink-700 dark:text-pink-400",
};
