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

/* ── Admin / Gestor menus ── */
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
  { title: "Comissões", url: "/comissoes", icon: Calculator },
  { title: "Planos", url: "/planos", icon: ClipboardList },
  { title: "Preços & Descontos", url: "/precos-planos", icon: Tag },
  { title: "Despesas", url: "/despesas", icon: Receipt },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

const menuComunicacao = [
  { title: "Mural de Avisos", url: "/avisos", icon: Megaphone },
  { title: "Mensagens", url: "/mensagens", icon: MessageSquare },
  { title: "Dados da Clínica", url: "/clinica", icon: Activity },
];

const menuIA = [
  { title: "Inteligência", url: "/inteligencia", icon: Brain },
  { title: "Automações", url: "/automacoes", icon: Send },
];

/* ── Professional menu ── */
const menuProfissional = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Minha Agenda", url: "/minha-agenda", icon: Calendar },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Prontuários", url: "/prontuarios", icon: ClipboardList },
  { title: "Disponibilidade", url: "/disponibilidade", icon: Clock },
];

const menuProfFinanceiro = [
  { title: "Minhas Comissões", url: "/comissoes", icon: Calculator },
];

const menuProfComunicacao = [
  { title: "Mensagens", url: "/mensagens", icon: MessageSquare },
];

const menuProfPerfil = [
  { title: "Meu Perfil", url: "/perfil-profissional", icon: User },
];

/* ── Patient menu ── */
const menuPatient = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Minha Agenda", url: "/minha-agenda", icon: Calendar },
  { title: "Histórico", url: "/meu-historico", icon: ClipboardList },
  { title: "Pagamentos", url: "/meus-pagamentos", icon: CreditCard },
  { title: "Meu Contrato", url: "/contratos", icon: FileText },
  { title: "Meu Perfil", url: "/meu-perfil", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, isGestor, isPatient, isProfissional } = useAuth();
  const isStaff = isAdmin || isGestor || isProfissional;

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const renderGroup = (label: string, items: typeof menuPrincipal) => (
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
            {/* If admin is also a professional, show their profile/commission links */}
            {isProfissional && (
              <>
                {renderGroup("Meu Perfil Profissional", menuProfPerfil)}
              </>
            )}
          </>
        ) : isProfissional ? (
          <>
            {renderGroup("Principal", menuProfissional)}
            {renderGroup("Financeiro", menuProfFinanceiro)}
            {renderGroup("Comunicação", menuProfComunicacao)}
            {renderGroup("Perfil", menuProfPerfil)}
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
