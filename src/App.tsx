import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/Pacientes";
import PacienteForm from "./pages/PacienteForm";
import Agenda from "./pages/Agenda";
import Planos from "./pages/Planos";
import Matriculas from "./pages/Matriculas";
import CheckInProfissional from "./pages/CheckInProfissional";
import MeusPlanos from "./pages/MeusPlanos";
import Produtos from "./pages/Produtos";
import HistoricoSessoes from "./pages/HistoricoSessoes";
import Aniversariantes from "./pages/Aniversariantes";
import Indicadores from "./pages/Indicadores";
import DicasDiarias from "./pages/DicasDiarias";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import Modalidades from "./pages/Modalidades";
import Profissionais from "./pages/Profissionais";
import Prontuarios from "./pages/Prontuarios";
import Despesas from "./pages/Despesas";
import PacienteDetalhes from "./pages/PacienteDetalhes";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import PatientDashboard from "./pages/PatientDashboard";
import MinhaAgenda from "./pages/MinhaAgenda";
import MeusPagamentos from "./pages/MeusPagamentos";
import Inteligencia from "./pages/Inteligencia";
import Automacoes from "./pages/Automacoes";
import PatientOnboarding from "./pages/PatientOnboarding";
import AvisosAdmin from "./pages/AvisosAdmin";
import DisponibilidadeProfissional from "./pages/DisponibilidadeProfissional";
import MeuPerfil from "./pages/MeuPerfil";
import MeuHistorico from "./pages/MeuHistorico";
import Contratos from "./pages/Contratos";
import PrecosPlanos from "./pages/PrecosPlanos";
import Comissoes from "./pages/Comissoes";
import PerfilProfissional from "./pages/PerfilProfissional";
import PerfilProfissionalPublico from "./pages/PerfilProfissionalPublico";
import ClinicSettings from "./pages/ClinicSettings";
import MensagensInternas from "./pages/MensagensInternas";
import PacienteAccess from "./pages/PacienteAccess";
import DashboardPaciente from "./pages/DashboardPaciente";
import SolicitacoesAlteracao from "./pages/SolicitacoesAlteracao";
import FormasPagamento from "./pages/FormasPagamento";

const queryClient = new QueryClient();

const DashboardToggle = () => {
  const { isPatient, isAdmin, isGestor, isProfissional, isSecretario } = useAuth();
  const isStaff = isAdmin || isGestor || isProfissional || isSecretario;
  return isStaff ? <Dashboard /> : <PatientDashboard />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/paciente-access" element={<PacienteAccess />} />
            {/* Access code redirects to /dashboard now */}
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
              <Route path="/solicitacoes-alteracao" element={<SolicitacoesAlteracao />} />
              <Route path="/formas-pagamento" element={<FormasPagamento />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
