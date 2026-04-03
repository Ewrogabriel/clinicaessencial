import { useAuth } from "@/modules/auth/hooks/useAuth";
import AdminDashboard from "./admin/AdminDashboard";
import ProfessionalDashboard from "./professional/ProfessionalDashboard";
import PatientDashboard from "./patient/PatientDashboard";
import MasterDashboard from "./master/MasterDashboard";

function DashboardRouter() {
  const { isAdmin, isGestor, isProfissional, isSecretario, isMaster } = useAuth();

  if (isMaster && !isAdmin) {
    return <MasterDashboard />;
  }
  if (isAdmin || isGestor || isSecretario) {
    return <AdminDashboard />;
  }
  if (isProfissional) {
    return <ProfessionalDashboard />;
  }
  return <PatientDashboard />;
}

export default DashboardRouter;
