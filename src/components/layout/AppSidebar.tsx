import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Activity,
  Layers,
  UserCog,
  Receipt,
  Brain,
  Send,
  Megaphone,
  Clock,
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

const menuPrincipal = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Prontuários", url: "/prontuarios", icon: ClipboardList },
];

const menuProfissional = [
  { title: "Cadastro", url: "/modalidades", icon: Layers },
  { title: "Profissional", url: "/profissionais", icon: UserCog },
  { title: "Disponibilidade", url: "/disponibilidade", icon: Clock },
];

const menuGestao = [
  { title: "Planos", url: "/planos", icon: ClipboardList },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Despesas", url: "/despesas", icon: Receipt },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

const menuPatient = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Minha Agenda", url: "/minha-agenda", icon: Calendar },
  { title: "Histórico", url: "/meu-historico", icon: ClipboardList },
  { title: "Pagamentos", url: "/meus-pagamentos", icon: DollarSign },
  { title: "Meu Perfil", url: "/meu-perfil", icon: Users },
];

const menuIA = [
  { title: "Inteligência", url: "/inteligencia", icon: Brain },
  { title: "Automações", url: "/automacoes", icon: Send },
];

const menuComunicacao = [
  { title: "Mural de Avisos", url: "/avisos", icon: Megaphone },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, roles, signOut, isAdmin, isGestor, isPatient, isProfissional } = useAuth();
  const isStaff = isAdmin || isGestor || isProfissional;

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
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
        <SidebarGroup>
          <SidebarGroupLabel>{isStaff ? "Principal" : "Meu Portal"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {(isStaff ? menuPrincipal : menuPatient).map((item) => (
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

        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>Profissional</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuProfissional.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
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
        )}

        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuGestao.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
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
        )}

        {(isAdmin || isGestor) && (
          <SidebarGroup>
            <SidebarGroupLabel>Comunicação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuComunicacao.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
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
        )}

        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>IA & Automação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuIA.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
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
