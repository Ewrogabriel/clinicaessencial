import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  DollarSign,
  BarChart3,
  LogOut,
  Activity,
  Layers,
  UserCog,
  Receipt,
  Brain,
  Send,
  Megaphone,
  Clock,
  FileText,
  Tag,
  CreditCard,
  User,
  Calculator,
  MessageSquare,
  Cake,
  TrendingUp,
  Lightbulb,
  FileCheck,
  Wallet,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

/* Resource key → route mapping */
const RESOURCE_ROUTES: Record<string, string> = {
  agenda: "/agenda",
  pacientes: "/pacientes",
  prontuarios: "/prontuarios",
  modalidades: "/modalidades",
  profissionais: "/profissionais",
  disponibilidade: "/disponibilidade",
  financeiro: "/financeiro",
  matriculas: "/matriculas",
  planos: "/planos",
  produtos: "/produtos",
  comissoes: "/comissoes",
  precos_planos: "/precos-planos",
  despesas: "/despesas",
  contratos: "/contratos",
  relatorios: "/relatorios",
  avisos: "/avisos",
  mensagens: "/mensagens",
  aniversariantes: "/aniversariantes",
  clinica: "/clinica",
  dicas_diarias: "/dicas-diarias",
  inteligencia: "/inteligencia",
  automacoes: "/automacoes",
  indicadores: "/indicadores",
  check_in: "/check-in",
};

/* Icon mapping */
const RESOURCE_ICONS: Record<string, any> = {
  agenda: Calendar,
  pacientes: Users,
  prontuarios: ClipboardList,
  modalidades: Layers,
  profissionais: UserCog,
  disponibilidade: Clock,
  financeiro: DollarSign,
  matriculas: Receipt,
  planos: ClipboardList,
  produtos: Tag,
  comissoes: Calculator,
  precos_planos: Tag,
  despesas: Receipt,
  contratos: FileText,
  relatorios: BarChart3,
  avisos: Megaphone,
  mensagens: MessageSquare,
  aniversariantes: Cake,
  clinica: Activity,
  dicas_diarias: Lightbulb,
  inteligencia: Brain,
  automacoes: Send,
  indicadores: TrendingUp,
  check_in: Users,
};

const RESOURCE_LABELS: Record<string, string> = {
  agenda: "Agenda",
  pacientes: "Pacientes",
  prontuarios: "Prontuários",
  modalidades: "Modalidades",
  profissionais: "Profissionais",
  disponibilidade: "Disponibilidade",
  financeiro: "Financeiro",
  matriculas: "Matrículas",
  planos: "Planos",
  produtos: "Produtos",
  comissoes: "Comissões",
  precos_planos: "Preços & Descontos",
  despesas: "Despesas",
  contratos: "Contratos",
  relatorios: "Relatórios",
  avisos: "Mural de Avisos",
  mensagens: "Mensagens",
  aniversariantes: "Aniversariantes",
  clinica: "Dados da Clínica",
  dicas_diarias: "Dicas Diárias",
  inteligencia: "Inteligência",
  automacoes: "Automações",
  indicadores: "Indicadores",
  check_in: "Check-in",
};

/* ── Admin full menus ── */
const menuPrincipal = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Prontuários", url: "/prontuarios", icon: ClipboardList },
];

const menuServicos = [
  { title: "Modalidades", url: "/modalidades", icon: Layers },
  { title: "Profissionais", url: "/profissionais", icon: UserCog },
  { title: "Disponibilidade", url: "/disponibilidade", icon: Clock },
];

const menuFinanceiro = [
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Matrículas", url: "/matriculas", icon: Receipt },
  { title: "Planos", url: "/planos", icon: ClipboardList },
  { title: "Produtos", url: "/produtos", icon: Tag },
  { title: "Comissões", url: "/comissoes", icon: Calculator },
  { title: "Preços & Descontos", url: "/precos-planos", icon: Tag },
  { title: "Despesas", url: "/despesas", icon: Receipt },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

const menuComunicacao = [
  { title: "Mural de Avisos", url: "/avisos", icon: Megaphone },
  { title: "Mensagens", url: "/mensagens", icon: MessageSquare },
  { title: "Aniversariantes", url: "/aniversariantes", icon: Cake },
  { title: "Solicitações", url: "/solicitacoes-alteracao", icon: FileCheck },
  { title: "Formas de Pagamento", url: "/formas-pagamento", icon: Wallet },
  { title: "Dados da Clínica", url: "/clinica", icon: Activity },
];

const menuIA = [
  { title: "Dicas Diárias", url: "/dicas-diarias", icon: Lightbulb },
  { title: "Inteligência", url: "/inteligencia", icon: Brain },
  { title: "Automações", url: "/automacoes", icon: Send },
  { title: "Indicadores", url: "/indicadores", icon: TrendingUp },
];

/* ── Patient menu ── */
const menuPatient = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Minha Agenda", url: "/minha-agenda", icon: Calendar },
  { title: "Meus Planos", url: "/meus-planos", icon: ClipboardList },
  { title: "Histórico", url: "/meu-historico", icon: ClipboardList },
  { title: "Pagamentos", url: "/meus-pagamentos", icon: CreditCard },
  { title: "Mensagens", url: "/mensagens", icon: MessageSquare },
  { title: "Meu Contrato", url: "/contratos", icon: FileText },
  { title: "Meu Perfil", url: "/meu-perfil", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, isGestor, isPatient, isProfissional, isSecretario, hasPermission } = useAuth();
  const isStaff = isAdmin || isGestor || isProfissional || isSecretario;

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const renderGroup = (label: string, items: { title: string; url: string; icon: any }[]) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
              >
                <NavLink
                  to={item.url}
                  end={item.url === "/dashboard"}
                  activeClassName="bg-sidebar-accent text-sidebar-primary"
                >
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
      { title: "Início", url: "/dashboard", icon: LayoutDashboard },
    ];

    // Add items based on permissions
    Object.entries(RESOURCE_ROUTES).forEach(([resource, route]) => {
      if (hasPermission(resource)) {
        // Use "Minha Agenda" for professionals
        const label = resource === "agenda" && isProfissional
          ? "Minha Agenda"
          : RESOURCE_LABELS[resource] || resource;
        const url = resource === "agenda" && isProfissional ? "/minha-agenda" : route;
        items.push({
          title: label,
          url,
          icon: RESOURCE_ICONS[resource] || Activity,
        });
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
            <span className="text-sm font-bold text-sidebar-foreground font-[Plus_Jakarta_Sans]">
              Essencial
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">
              FisioPilates
            </span>
          </div>
        )}
      </div>

      <SidebarContent>
        {(isAdmin || isGestor) ? (
          <>
            {renderGroup("Principal", menuPrincipal)}
            {renderGroup("Serviços", menuServicos)}
            {renderGroup("Financeiro & Gestão", menuFinanceiro)}
            {renderGroup("Comunicação", menuComunicacao)}
            {renderGroup("IA & Automação", menuIA)}
            {isProfissional && (
              renderGroup("Meu Perfil Profissional", [
                { title: "Meu Perfil", url: "/perfil-profissional", icon: User },
              ])
            )}
          </>
        ) : (isProfissional || isSecretario) ? (
          <>
            {renderGroup("Menu", buildPermissionMenu())}
            {isProfissional && (
              renderGroup("Perfil", [
                { title: "Meu Perfil", url: "/perfil-profissional", icon: User },
              ])
            )}
          </>
        ) : (
          renderGroup("Meu Portal", menuPatient)
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {!collapsed && profile && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {profile.nome}
              </p>
            </div>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
