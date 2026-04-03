// App root
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/modules/auth/hooks/useAuth";
import { ClinicProvider } from "@/modules/clinic/hooks/useClinic";
import { I18nProvider } from "@/modules/shared/hooks/useI18n";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
import { RequireRole } from "@/modules/auth/components/RequireRole";
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
// CheckInProfissional removed
const MeusPlanos = lazy(() => import("./pages/MeusPlanos"));
const HistoricoSessoes = lazy(() => import("./pages/HistoricoSessoes"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const InteligenciaBI = lazy(() => import("./pages/InteligenciaBI"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Modalidades = lazy(() => import("./pages/Modalidades"));
const Profissionais = lazy(() => import("./pages/Profissionais"));
const Prontuarios = lazy(() => import("./pages/Prontuarios"));
const PacienteDetalhes = lazy(() => import("./pages/PacienteDetalhes"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
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
const Convenios = lazy(() => import("./pages/Convenios"));
const PreCadastro = lazy(() => import("./pages/PreCadastro"));
const PreCadastrosAdmin = lazy(() => import("./pages/PreCadastrosAdmin"));
const GestaoClinicas = lazy(() => import("./pages/GestaoClinicas"));
const SelecionarClinica = lazy(() => import("./pages/SelecionarClinica"));
const MasterPanel = lazy(() => import("./pages/MasterPanel"));
const Comissoes = lazy(() => import("./pages/Comissoes"));
const ImportacaoMassa = lazy(() => import("./pages/ImportacaoMassa"));
const MetasGamificacao = lazy(() => import("./pages/MetasGamificacao"));
const GamificationAdminPanel = lazy(() => import("./pages/GamificationAdminPanel"));
const DocumentosClinicos = lazy(() => import("./pages/DocumentosClinicos"));
const Marketing = lazy(() => import("./pages/Marketing"));
const Teleconsulta = lazy(() => import("./pages/Teleconsulta"));
const TeleconsultaHub = lazy(() => import("./pages/TeleconsultaHub"));
const PlanosExercicios = lazy(() => import("./pages/PlanosExercicios"));
const Planos = lazy(() => import("./pages/Planos"));
const DisponibilidadeProfissional = lazy(() => import("./pages/DisponibilidadeProfissional"));
const ConfirmacoesDia = lazy(() => import("./pages/ConfirmacoesDia"));
const ConfirmarAgendamento = lazy(() => import("./pages/ConfirmarAgendamento"));
const VerificarDocumento = lazy(() => import("./pages/VerificarDocumento"));


const Investimentos = lazy(() => import("./pages/Investimentos"));
const ConciliacaoBancaria = lazy(() => import("./pages/finance/ConciliacaoBancaria"));


const MeuPerfilToggle = () => {
  const { isAdmin, isGestor, isProfissional, isSecretario, isMaster } = useAuth();
  if (isAdmin || isGestor || isSecretario || isProfissional || isMaster) return <PerfilProfissional />;
  return <MeuPerfil />;
};

const LeaderboardPatient = lazy(() => import("./pages/gamification/LeaderboardPatient"));
const RewardsCatalog = lazy(() => import("./pages/gamification/RewardsCatalog"));
const ClinicManagement = lazy(() => import("./pages/master/ClinicManagement"));
const RevenueAnalytics = lazy(() => import("./pages/master/RevenueAnalytics"));
const FeatureFlagsPanel = lazy(() => import("./pages/master/FeatureFlagsPanel"));
const UserManagement = lazy(() => import("./pages/master/UserManagement"));
const AuditLogs = lazy(() => import("./pages/master/AuditLogs"));

const LandingPage = lazy(() => import("./pages/LandingPage"));
const WhatsAppLogs = lazy(() => import("./pages/WhatsAppLogs"));

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
                      <Route path="/site" element={<LandingPage />} />
                      <Route path="/confirmar-agendamento/:id" element={<ConfirmarAgendamento />} />
                      <Route path="/verificar-documento/:id" element={<VerificarDocumento />} />
                      <Route path="/verificar-documento" element={<VerificarDocumento />} />
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
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/pacientes" element={<Pacientes />} />
                        <Route path="/pacientes/novo" element={<PacienteForm />} />
                        <Route path="/pacientes/:id" element={<PacienteForm />} />
                        <Route path="/pacientes/:id/detalhes" element={<PacienteDetalhes />} />
                        <Route path="/prontuarios" element={<Prontuarios />} />
                        <Route path="/agenda" element={<Agenda />} />
                        <Route path="/minha-agenda" element={<MinhaAgenda />} />
                        {/* check-in route removed */}
                        <Route path="/meus-pagamentos" element={<MeusPagamentos />} />
                        <Route path="/meus-planos" element={<MeusPlanos />} />
                        <Route path="/meu-perfil" element={<MeuPerfilToggle />} />
                        <Route path="/meu-historico" element={<HistoricoSessoes />} />
                        <Route path="/matriculas" element={<Matriculas />} />
                        <Route path="/inventario" element={<Inventario />} />
                        <Route path="/financeiro" element={<RequireRole roles={["admin", "gestor", "master", "secretario"]}><Financeiro /></RequireRole>} />
                        <Route path="/conciliacao-bancaria" element={<RequireRole roles={["admin", "gestor", "master", "secretario"]}><ConciliacaoBancaria /></RequireRole>} />
                        <Route path="/inteligencia-bi" element={<Navigate to="/relatorios" replace />} />
                        <Route path="/relatorios" element={<RequireRole roles={["admin", "gestor", "master"]}><Relatorios /></RequireRole>} />
                        <Route path="/modalidades" element={<Modalidades />} />
                        <Route path="/profissionais" element={<RequireRole roles={["admin", "gestor", "master"]}><Profissionais /></RequireRole>} />
                        <Route path="/automacoes" element={<RequireRole roles={["admin", "gestor", "master"]}><Automacoes /></RequireRole>} />
                        <Route path="/whatsapp/logs" element={<RequireRole roles={["admin", "gestor", "master"]}><WhatsAppLogs /></RequireRole>} />
                        <Route path="/avisos" element={<AvisosAdmin />} />
                        <Route path="/disponibilidade" element={<DisponibilidadeProfissional />} />
                        <Route path="/contratos" element={<Contratos />} />
                        <Route path="/comissoes" element={<Comissoes />} />
                        <Route path="/perfil-profissional" element={<PerfilProfissional />} />
                        <Route path="/profissional/:userId" element={<PerfilProfissionalPublico />} />
                        <Route path="/clinica" element={<RequireRole roles={["admin", "gestor", "master"]}><ClinicSettings /></RequireRole>} />
                        <Route path="/mensagens" element={<MensagensInternas />} />
                        <Route path="/solicitacoes-alteracao" element={<RequireRole roles={["admin", "gestor", "master", "secretario"]}><SolicitacoesAlteracao /></RequireRole>} />
                        <Route path="/convenios" element={<Convenios />} />
                        <Route path="/pre-cadastros" element={<RequireRole roles={["admin", "gestor", "master", "secretario"]}><PreCadastrosAdmin /></RequireRole>} />
                        <Route path="/gestao-clinicas" element={<RequireRole roles={["admin", "master"]}><GestaoClinicas /></RequireRole>} />
                        <Route path="/master" element={<RequireRole roles={["master"]}><MasterPanel /></RequireRole>} />
                        <Route path="/importacao" element={<RequireRole roles={["admin", "gestor", "master"]}><ImportacaoMassa /></RequireRole>} />
                        <Route path="/metas" element={<RequireRole roles={["admin", "gestor", "master"]}><MetasGamificacao /></RequireRole>} />
                        <Route path="/gamificacao-admin" element={<RequireRole roles={["admin", "gestor", "master"]}><GamificationAdminPanel /></RequireRole>} />
                        <Route path="/documentos-clinicos" element={<DocumentosClinicos />} />
                        <Route path="/marketing" element={<RequireRole roles={["admin", "gestor", "master"]}><Marketing /></RequireRole>} />
                        <Route path="/teleconsulta" element={<Teleconsulta />} />
                        <Route path="/teleconsulta-hub" element={<TeleconsultaHub />} />
                        <Route path="/planos-exercicios" element={<PlanosExercicios />} />
                        <Route path="/planos" element={<Planos />} />
                        <Route path="/confirmacoes-dia" element={<RequireRole roles={["admin", "gestor", "master", "secretario"]}><ConfirmacoesDia /></RequireRole>} />
                        <Route path="/agenda-premium" element={<Navigate to="/agenda?tab=vagas" replace />} />
                        <Route path="/gamificacao/ranking" element={<LeaderboardPatient />} />
                        <Route path="/gamificacao/recompensas" element={<RewardsCatalog />} />
                        <Route path="/master/clinicas" element={<RequireRole roles={["master"]}><ClinicManagement /></RequireRole>} />
                        <Route path="/master/revenue" element={<RequireRole roles={["master"]}><RevenueAnalytics /></RequireRole>} />
                        <Route path="/master/features" element={<RequireRole roles={["master"]}><FeatureFlagsPanel /></RequireRole>} />
                        <Route path="/master/users" element={<RequireRole roles={["master"]}><UserManagement /></RequireRole>} />
                        <Route path="/master/audit" element={<RequireRole roles={["master"]}><AuditLogs /></RequireRole>} />
                        <Route path="/investimentos" element={<RequireRole roles={["admin", "gestor", "master"]}><Investimentos /></RequireRole>} />
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
