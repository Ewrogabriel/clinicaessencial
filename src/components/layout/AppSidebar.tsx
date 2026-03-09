import {
  LayoutDashboard, Users, Calendar, ClipboardList, DollarSign, BarChart3,
  LogOut, Activity, Layers, UserCog, Receipt, Send, Megaphone,
  FileText, Tag, CreditCard, User, Calculator, MessageSquare,
  FileCheck, Handshake,
  Building2, Crown, Upload, Trophy, Stethoscope,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ClinicSwitcher } from "@/components/layout/ClinicSwitcher";

/* Resource key → route mapping (for permission-based menus) */
const RESOURCE_ROUTES: Record<string, string> = {
  agenda: "/agenda", pacientes: "/pacientes", prontuarios: "/prontuarios",
  modalidades: "/modalidades", profissionais: "/profissionais",
  disponibilidade: "/disponibilidade", financeiro: "/financeiro",
  matriculas: "/matriculas", comissoes: "/comissoes",
  contratos: "/contratos", relatorios: "/relatorios",
  avisos: "/avisos", mensagens: "/mensagens", aniversariantes: "/aniversariantes",
  clinica: "/clinica", dicas_diarias: "/dicas-diarias",
  automacoes: "/automacoes", check_in: "/check-in",
  precos_planos: "/precos-planos", produtos: "/produtos",
};

const RESOURCE_ICONS: Record<string, any> = {
  agenda: Calendar, pacientes: Users, prontuarios: ClipboardList,
  modalidades: Layers, profissionais: UserCog, disponibilidade: Calendar,
  financeiro: DollarSign, matriculas: Receipt, comissoes: Calculator,
  contratos: FileText, relatorios: BarChart3, avisos: Megaphone,
  mensagens: MessageSquare, aniversariantes: Users, clinica: Activity,
  dicas_diarias: Activity, automacoes: Send, check_in: Users,
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
  automacoes: "nav.automations", check_in: "nav.check_in",
  precos_planos: "nav.prices", produtos: "nav.products",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, isGestor, isPatient, isProfissional, isSecretario, isMaster, hasPermission } = useAuth();
  const { t } = useI18n();
  const isStaff = isAdmin || isGestor || isProfissional || isSecretario || isMaster;

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  /* ── Menus with i18n ── */
  const menuAtendimento = [
    { title: t("nav.home"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("nav.agenda"), url: "/agenda", icon: Calendar },
    { title: t("nav.patients"), url: "/pacientes", icon: Users },
    { title: t("nav.records"), url: "/prontuarios", icon: ClipboardList },
    { title: t("nav.enrollments"), url: "/matriculas", icon: Receipt },
    { title: t("nav.documents"), url: "/documentos-clinicos", icon: Stethoscope },
  ];

  const menuEquipeFinanceiro = [
    { title: t("nav.team"), url: "/profissionais", icon: UserCog },
    { title: t("nav.finance"), url: "/financeiro", icon: DollarSign },
    { title: t("nav.requests"), url: "/solicitacoes-alteracao", icon: FileCheck },
    { title: t("nav.pre_registrations"), url: "/pre-cadastros", icon: UserCog },
  ];

  const menuInteligencia = [
    { title: t("nav.reports"), url: "/relatorios", icon: BarChart3 },
    { title: t("nav.goals"), url: "/metas", icon: Trophy },
    { title: t("nav.gamification"), url: "/gamificacao-admin", icon: Trophy },
    { title: t("nav.import"), url: "/importacao", icon: Upload },
  ];

  const menuComunicacao = [
    { title: t("nav.messages"), url: "/mensagens", icon: MessageSquare },
    { title: t("nav.notices"), url: "/avisos", icon: Megaphone },
  ];

  const menuConfig = [
    { title: t("nav.modalities"), url: "/modalidades", icon: Layers },
    { title: t("nav.inventory"), url: "/inventario", icon: Tag },
    { title: t("nav.partners"), url: "/convenios", icon: Handshake },
    { title: t("nav.contracts"), url: "/contratos", icon: FileText },
    { title: t("nav.automations"), url: "/automacoes", icon: Send },
    { title: t("nav.clinic_payment"), url: "/clinica", icon: Activity },
    { title: t("nav.units"), url: "/gestao-clinicas", icon: Building2 },
  ];

  const menuMaster = [
    { title: t("nav.master_panel"), url: "/master", icon: Crown },
    { title: t("nav.home"), url: "/dashboard", icon: LayoutDashboard },
  ];

  const menuPatient = [
    { title: t("nav.home"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("nav.my_agenda"), url: "/minha-agenda", icon: Calendar },
    { title: t("nav.my_plans"), url: "/meus-planos", icon: ClipboardList },
    { title: t("nav.my_history"), url: "/meu-historico", icon: ClipboardList },
    { title: t("nav.my_payments"), url: "/meus-pagamentos", icon: CreditCard },
    { title: t("nav.partners"), url: "/convenios", icon: Handshake },
    { title: t("nav.messages"), url: "/mensagens", icon: MessageSquare },
    { title: t("nav.my_contract"), url: "/contratos", icon: FileText },
    { title: t("nav.my_profile"), url: "/meu-perfil", icon: Users },
  ];

  const renderGroup = (label: string, items: { title: string; url: string; icon: any }[]) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <NavLink to={item.url} end={item.url === "/dashboard"} activeClassName="bg-sidebar-accent text-sidebar-primary">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  // Build permission-based menu for non-admin staff
  const buildPermissionMenu = () => {
    const items: { title: string; url: string; icon: any }[] = [
      { title: t("nav.home"), url: "/dashboard", icon: LayoutDashboard },
    ];
    Object.entries(RESOURCE_ROUTES).forEach(([resource, route]) => {
      if (hasPermission(resource)) {
        const i18nKey = RESOURCE_I18N_KEYS[resource] || resource;
        const label = resource === "agenda" && isProfissional ? t("nav.my_agenda") : t(i18nKey);
        const url = resource === "agenda" && isProfissional ? "/minha-agenda" : route;
        items.push({ title: label, url, icon: RESOURCE_ICONS[resource] || Activity });
      }
    });
    return items;
  };

  return (
    <Sidebar collapsible="icon">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
          <Activity className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground font-[Plus_Jakarta_Sans]">Essencial</span>
            <span className="text-[11px] text-sidebar-foreground/60">FisioPilates</span>
          </div>
        )}
      </div>

      <ClinicSwitcher collapsed={collapsed} />

      <SidebarContent>
        {isMaster && renderGroup(t("group.master"), menuMaster)}
        {(isAdmin || isGestor) ? (
          <>
            {renderGroup(t("group.care"), menuAtendimento)}
            {renderGroup(t("group.team_finance"), menuEquipeFinanceiro)}
            {renderGroup(t("group.intelligence"), menuInteligencia)}
            {renderGroup(t("group.communication"), menuComunicacao)}
            {renderGroup(t("group.settings"), menuConfig)}
            {isProfissional && renderGroup(t("group.profile"), [
              { title: t("nav.my_profile"), url: "/perfil-profissional", icon: User },
            ])}
          </>
        ) : (isProfissional || isSecretario) ? (
          <>
            {renderGroup(t("group.menu"), buildPermissionMenu())}
            {isProfissional && renderGroup(t("group.profile"), [
              { title: t("nav.my_profile"), url: "/perfil-profissional", icon: User },
            ])}
          </>
        ) : isPatient ? (
          renderGroup(t("group.my_portal"), menuPatient)
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {!collapsed && profile && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-sidebar-foreground/60 truncate">{profile.nome}</p>
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
}
