import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ClinicProvider } from "@/hooks/useClinic";
import { I18nProvider } from "@/hooks/useI18n";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LazyLoadFallback } from "@/components/LazyLoadFallback";

// Eager-loaded (critical path)
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const PacienteForm = lazy(() => import("./pages/PacienteForm"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Matriculas = lazy(() => import("./pages/Matriculas"));
const CheckInProfissional = lazy(() => import("./pages/CheckInProfissional"));
const MeusPlanos = lazy(() => import("./pages/MeusPlanos"));
const HistoricoSessoes = lazy(() => import("./pages/HistoricoSessoes"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Modalidades = lazy(() => import("./pages/Modalidades"));
const Profissionais = lazy(() => import("./pages/Profissionais"));
const Prontuarios = lazy(() => import("./pages/Prontuarios"));
const PacienteDetalhes = lazy(() => import("./pages/PacienteDetalhes"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PatientDashboard = lazy(() => import("./pages/PatientDashboard"));
const MinhaAgenda = lazy(() => import("./pages/MinhaAgenda"));
const MeusPagamentos = lazy(() => import("./pages/MeusPagamentos"));
const Automacoes = lazy(() => import("./pages/Automacoes"));
const PatientOnboarding = lazy(() => import("./pages/PatientOnboarding"));
const AvisosAdmin = lazy(() => import("./pages/AvisosAdmin"));
const MeuPerfil = lazy(() => import("./pages/MeuPerfil"));
const Contratos = lazy(() => import("./pages/Contratos"));
const PerfilProfissional = lazy(() => import("./pages/PerfilProfissional"));
const PerfilProfissionalPublico = lazy(() => import("./pages/PerfilProfissionalPublico"));
const ClinicSettings = lazy(() => import("./pages/ClinicSettings"));
const MensagensInternas = lazy(() => import("./pages/MensagensInternas"));
const PacienteAccess = lazy(() => import("./pages/PacienteAccess"));
const SolicitacoesAlteracao = lazy(() => import("./pages/SolicitacoesAlteracao"));
const ProfessionalDashboard = lazy(() => import("./pages/ProfessionalDashboard"));
const Convenios = lazy(() => import("./pages/Convenios"));
const PreCadastro = lazy(() => import("./pages/PreCadastro"));
const PreCadastrosAdmin = lazy(() => import("./pages/PreCadastrosAdmin"));
const GestaoClinicas = lazy(() => import("./pages/GestaoClinicas"));
const SelecionarClinica = lazy(() => import("./pages/SelecionarClinica"));
const MasterPanel = lazy(() => import("./pages/MasterPanel"));
const ImportacaoMassa = lazy(() => import("./pages/ImportacaoMassa"));
const MetasGamificacao = lazy(() => import("./pages/MetasGamificacao"));
const GamificationAdminPanel = lazy(() => import("./pages/GamificationAdminPanel"));

const queryClient = new QueryClient();

const DashboardToggle = () => {
  const { isAdmin, isGestor, isProfissional, isSecretario, isMaster } = useAuth();
  if (isMaster && !isAdmin) return <MasterPanel />;
  if (isAdmin || isGestor || isSecretario) return <Dashboard />;
  if (isProfissional) return <ProfessionalDashboard />;
  return <PatientDashboard />;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
        <AuthProvider>
          <ClinicProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <ErrorBoundary>
          <Suspense fallback={<LazyLoadFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/paciente-access" element={<PacienteAccess />} />
            <Route path="/onboarding/:id" element={<PatientOnboarding />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pre-cadastro" element={<PreCadastro />} />
            <Route path="/" element={<Index />} />
            <Route path="/selecionar-clinica" element={
              <ProtectedRoute><SelecionarClinica /></ProtectedRoute>
            } />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardToggle />} />
              <Route path="/pacientes" element={<Pacientes />} />
              <Route path="/pacientes/novo" element={<PacienteForm />} />
              <Route path="/pacientes/:id" element={<PacienteForm />} />
              <Route path="/pacientes/:id/detalhes" element={<PacienteDetalhes />} />
              <Route path="/prontuarios" element={<Prontuarios />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/minha-agenda" element={<MinhaAgenda />} />
              <Route path="/check-in" element={<CheckInProfissional />} />
              <Route path="/meus-pagamentos" element={<MeusPagamentos />} />
              <Route path="/meus-planos" element={<MeusPlanos />} />
              <Route path="/meu-perfil" element={<MeuPerfil />} />
              <Route path="/meu-historico" element={<HistoricoSessoes />} />
              <Route path="/matriculas" element={<Matriculas />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/produtos" element={<Inventario />} />
              <Route path="/equipamentos" element={<Inventario />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/aniversariantes" element={<Dashboard />} />
              <Route path="/modalidades" element={<Modalidades />} />
              <Route path="/profissionais" element={<Profissionais />} />
              <Route path="/automacoes" element={<Automacoes />} />
              <Route path="/dicas-diarias" element={<Dashboard />} />
              <Route path="/avisos" element={<AvisosAdmin />} />
              <Route path="/disponibilidade" element={<Profissionais />} />
              <Route path="/contratos" element={<Contratos />} />
              <Route path="/comissoes" element={<Financeiro />} />
              <Route path="/perfil-profissional" element={<PerfilProfissional />} />
              <Route path="/profissional/:userId" element={<PerfilProfissionalPublico />} />
              <Route path="/clinica" element={<ClinicSettings />} />
              <Route path="/mensagens" element={<MensagensInternas />} />
              <Route path="/solicitacoes-alteracao" element={<SolicitacoesAlteracao />} />
              <Route path="/formas-pagamento" element={<ClinicSettings />} />
              <Route path="/lista-espera" element={<Agenda />} />
              <Route path="/convenios" element={<Convenios />} />
              <Route path="/vagas" element={<Agenda />} />
              <Route path="/pre-cadastros" element={<PreCadastrosAdmin />} />
              <Route path="/notas-fiscais" element={<Financeiro />} />
              <Route path="/gestao-clinicas" element={<GestaoClinicas />} />
              <Route path="/master" element={<MasterPanel />} />
              <Route path="/importacao" element={<ImportacaoMassa />} />
              <Route path="/metas" element={<MetasGamificacao />} />
              <Route path="/gamificacao-admin" element={<GamificationAdminPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
          </BrowserRouter>
          </ClinicProvider>
        </AuthProvider>
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
