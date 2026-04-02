import {
  LayoutDashboard, Users, Calendar, ClipboardList, DollarSign, BarChart3,
  LogOut, Activity, Layers, UserCog, Receipt, Send, Megaphone,
  FileText, Tag, CreditCard, User, Calculator, MessageSquare,
  FileCheck, Handshake, Video,
  Building2, Crown, Upload, Trophy, Stethoscope, Target, Dumbbell,
  Clock, CheckCheck, ChevronDown, ChevronRight,
} from "lucide-react";
import { memo, useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useI18n } from "@/modules/shared/hooks/useI18n";
import { useSaaS } from "@/modules/shared/hooks/useSaaS";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ClinicSwitcher } from "@/components/layout/ClinicSwitcher";
import {
  masterGroups, adminGroups, profissionalGroups, patientGroups,
  ROLE_LABELS, ROLE_BADGE_COLORS,
  type MenuGroup, type MenuItem,
} from "@/components/layout/menuConfig";

/* Resource key → route mapping (for permission-based menus) */
const RESOURCE_ROUTES: Record<string, string> = {
  agenda: "/agenda", pacientes: "/pacientes", prontuarios: "/prontuarios",
  modalidades: "/modalidades", profissionais: "/profissionais",
  disponibilidade: "/disponibilidade", financeiro: "/financeiro",
  matriculas: "/matriculas", comissoes: "/comissoes",
  contratos: "/contratos", relatorios: "/relatorios",
  avisos: "/avisos", mensagens: "/mensagens", aniversariantes: "/aniversariantes",
  clinica: "/clinica", dicas_diarias: "/dicas-diarias",
  automacoes: "/automacoes",
  precos_planos: "/precos-planos", produtos: "/produtos",
};

const RESOURCE_ICONS: Record<string, any> = {
  agenda: Calendar, pacientes: Users, prontuarios: ClipboardList,
  modalidades: Layers, profissionais: UserCog, disponibilidade: Clock,
  financeiro: DollarSign, matriculas: Receipt, comissoes: Calculator,
  contratos: FileText, relatorios: BarChart3, avisos: Megaphone,
  mensagens: MessageSquare, aniversariantes: Users, clinica: Activity,
  dicas_diarias: Activity, automacoes: Send,
  precos_planos: Tag, produtos: Tag,
};

const RESOURCE_I18N_KEYS: Record<string, string> = {
  agenda: "nav.agenda", pacientes: "nav.patients", prontuarios: "nav.records",
  modalidades: "nav.modalities", profissionais: "nav.professionals",
  disponibilidade: "nav.availability", financeiro: "nav.finance",
  matriculas: "nav.enrollments", comissoes: "nav.commissions",
  contratos: "nav.contracts", relatorios: "nav.reports", avisos: "nav.notices",
  mensagens: "nav.messages", aniversariantes: "nav.birthdays",
  clinica: "nav.clinic_data", dicas_diarias: "nav.daily_tips",
  automacoes: "nav.automations",
  precos_planos: "nav.prices", produtos: "nav.products",
};

// ─────────────────────────────────────────────────────────────────────────────
// CollapsibleGroup – renders a single collapsible menu section
// ─────────────────────────────────────────────────────────────────────────────

interface CollapsibleGroupProps {
  group: MenuGroup;
  collapsed: boolean;
  isActive: (path: string) => boolean;
  t: (key: string) => string;
}

function CollapsibleGroup({ group, collapsed, isActive, t }: CollapsibleGroupProps) {
  // Auto-expand the group when one of its items is the current page
  const hasActive = group.items.some((item) => isActive(item.url));
  const [open, setOpen] = useState(!group.defaultCollapsed || hasActive);

  // Re-expand the group whenever navigation causes a child route to become active
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  const label = t(group.labelKey);

  return (
    <SidebarGroup>
      {/* Group header – doubles as collapse toggle */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
        onClick={() => !collapsed && setOpen((v) => !v)}
      >
        <SidebarGroupLabel className="p-0 text-inherit uppercase tracking-wider text-xs">
          {label}
        </SidebarGroupLabel>
        {!collapsed && (
          <span className="shrink-0 opacity-60">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        )}
      </button>

      {/* Items – always visible when sidebar is icon-collapsed */}
      {(open || collapsed) && (
        <SidebarGroupContent>
          <SidebarMenu>
            {group.items.map((item: MenuItem) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={t(item.labelKey)}
                >
                  <NavLink
                    to={item.url}
                    end={item.url === "/dashboard"}
                    activeClassName="bg-sidebar-accent text-sidebar-primary"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{t(item.labelKey)}</span>
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className="ml-auto h-5 min-w-[1.25rem] px-1 text-[10px]"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppSidebar
// ─────────────────────────────────────────────────────────────────────────────

export const AppSidebar = memo(function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const {
    profile, signOut,
    isAdmin, isGestor, isPatient, isProfissional, isSecretario, isMaster,
    hasPermission, roles,
  } = useAuth();
  const { saasStatus } = useSaaS();
  const { t } = useI18n();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  // Primary role for the visual role badge in the footer
  const primaryRole = roles?.[0] ?? null;
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : null;
  const roleBadgeClass = primaryRole ? ROLE_BADGE_COLORS[primaryRole] : "";

  // Admin/gestor finance group: inject BI item when the feature flag is active
  const resolvedAdminGroups: MenuGroup[] = adminGroups.map((group) => {
    if (group.labelKey !== "group.finance") return group;
    if (!saasStatus?.has_bi) return group;
    const items = [...group.items];
    const biIdx = items.findIndex((i) => i.url === "/relatorios");
    items.splice(biIdx, 0, {
      labelKey: "nav.bi_intelligence",
      url: "/inteligencia-bi",
      icon: BarChart3,
    });
    return { ...group, items };
  });

  // Build permission-based groups for secretário role
  const buildSecretarioGroups = (): MenuGroup[] => {
    const items: MenuItem[] = [
      { labelKey: "nav.home", url: "/dashboard", icon: LayoutDashboard },
    ];
    Object.entries(RESOURCE_ROUTES).forEach(([resource, route]) => {
      if (hasPermission(resource)) {
        const labelKey = RESOURCE_I18N_KEYS[resource] || resource;
        const url = resource === "agenda" && isProfissional ? "/minha-agenda" : route;
        items.push({ labelKey, url, icon: RESOURCE_ICONS[resource] || Activity });
      }
    });
    return [{ labelKey: "group.menu", items }];
  };

  // Determine which menu groups apply to the current user
  let groups: MenuGroup[] = [];
  if (isAdmin || isGestor) {
    groups = resolvedAdminGroups;
  } else if (isProfissional) {
    groups = profissionalGroups;
  } else if (isSecretario) {
    groups = buildSecretarioGroups();
  } else if (isPatient) {
    groups = patientGroups;
  }

  return (
    <Sidebar collapsible="icon">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
          <Activity className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground font-[Plus_Jakarta_Sans]">
              Essencial
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">Clínicas</span>
          </div>
        )}
      </div>

      <ClinicSwitcher collapsed={collapsed} />

      <SidebarContent>
        {/* Master panel is always prepended when the user has master role */}
        {isMaster &&
          masterGroups.map((group) => (
            <CollapsibleGroup
              key={group.labelKey}
              group={group}
              collapsed={collapsed}
              isActive={isActive}
              t={t}
            />
          ))}

        {groups.map((group) => (
          <CollapsibleGroup
            key={group.labelKey}
            group={group}
            collapsed={collapsed}
            isActive={isActive}
            t={t}
          />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {!collapsed && profile && (
            <div className="px-3 py-2 mb-1 space-y-1">
              <p className="text-xs text-sidebar-foreground/80 font-medium truncate">
                {profile.nome}
              </p>
              {roleLabel && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass}`}
                >
                  {roleLabel}
                </span>
              )}
            </div>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip={t("nav.logout")}>
              <LogOut className="h-4 w-4" />
              <span>{t("nav.logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
});
