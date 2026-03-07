import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";

// Critical pages - loaded immediately
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy loaded pages - Admin/Staff
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const PacienteForm = lazy(() => import("./pages/PacienteForm"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Planos = lazy(() => import("./pages/Planos"));
const Matriculas = lazy(() => import("./pages/Matriculas"));
const CheckInProfissional = lazy(() => import("./pages/CheckInProfissional"));
const Produtos = lazy(() => import("./pages/Produtos"));
const HistoricoSessoes = lazy(() => import("./pages/HistoricoSessoes"));
const Aniversariantes = lazy(() => import("./pages/Aniversariantes"));
const Indicadores = lazy(() => import("./pages/Indicadores"));
const DicasDiarias = lazy(() => import("./pages/DicasDiarias"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Modalidades = lazy(() => import("./pages/Modalidades"));
const Profissionais = lazy(() => import("./pages/Profissionais"));
const Prontuarios = lazy(() => import("./pages/Prontuarios"));
const Despesas = lazy(() => import("./pages/Despesas"));
const PacienteDetalhes = lazy(() => import("./pages/PacienteDetalhes"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Inteligencia = lazy(() => import("./pages/Inteligencia"));
const Automacoes = lazy(() => import("./pages/Automacoes"));
const AvisosAdmin = lazy(() => import("./pages/AvisosAdmin"));
const DisponibilidadeProfissional = lazy(() => import("./pages/DisponibilidadeProfissional"));
const Contratos = lazy(() => import("./pages/Contratos"));
const PrecosPlanos = lazy(() => import("./pages/PrecosPlanos"));
const Comissoes = lazy(() => import("./pages/Comissoes"));
const PerfilProfissional = lazy(() => import("./pages/PerfilProfissional"));
const PerfilProfissionalPublico = lazy(() => import("./pages/PerfilProfissionalPublico"));
const ClinicSettings = lazy(() => import("./pages/ClinicSettings"));
const MensagensInternas = lazy(() => import("./pages/MensagensInternas"));

// Lazy loaded pages - Patient
const PatientDashboard = lazy(() => import("./pages/PatientDashboard"));
const MinhaAgenda = lazy(() => import("./pages/MinhaAgenda"));
const MeusPagamentos = lazy(() => import("./pages/MeusPagamentos"));
const MeusPlanos = lazy(() => import("./pages/MeusPlanos"));
const MeuPerfil = lazy(() => import("./pages/MeuPerfil"));
const MeuHistorico = lazy(() => import("./pages/MeuHistorico"));
const PatientOnboarding = lazy(() => import("./pages/PatientOnboarding"));
const PacienteAccess = lazy(() => import("./pages/PacienteAccess"));
const DashboardPaciente = lazy(() => import("./pages/DashboardPaciente"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const DashboardToggle = () => {
  const { isPatient, isAdmin, isGestor, isProfissional } = useAuth();
  const isStaff = isAdmin || isGestor || isProfissional;
  return isStaff ? <Dashboard /> : <PatientDashboard />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/paciente-access" element={<PacienteAccess />} />
              <Route path="/onboarding/:id" element={<PatientOnboarding />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<Index />} />
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
                <Route path="/planos" element={<Planos />} />
                <Route path="/matriculas" element={<Matriculas />} />
                <Route path="/produtos" element={<Produtos />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/despesas" element={<Despesas />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/indicadores" element={<Indicadores />} />
                <Route path="/aniversariantes" element={<Aniversariantes />} />
                <Route path="/modalidades" element={<Modalidades />} />
                <Route path="/profissionais" element={<Profissionais />} />
                <Route path="/inteligencia" element={<Inteligencia />} />
                <Route path="/automacoes" element={<Automacoes />} />
                <Route path="/dicas-diarias" element={<DicasDiarias />} />
                <Route path="/avisos" element={<AvisosAdmin />} />
                <Route path="/disponibilidade" element={<DisponibilidadeProfissional />} />
                <Route path="/contratos" element={<Contratos />} />
                <Route path="/precos-planos" element={<PrecosPlanos />} />
                <Route path="/comissoes" element={<Comissoes />} />
                <Route path="/perfil-profissional" element={<PerfilProfissional />} />
                <Route path="/profissional/:userId" element={<PerfilProfissionalPublico />} />
                <Route path="/clinica" element={<ClinicSettings />} />
                <Route path="/mensagens" element={<MensagensInternas />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
