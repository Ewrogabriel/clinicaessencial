import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isMultiClinic, activeClinicId, isLoading: clinicLoading } = useClinic();
  const location = useLocation();

  if (loading || clinicLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Force multi-clinic users to select a clinic before proceeding
  const isSelectingClinic = location.pathname === "/selecionar-clinica";
  if (isMultiClinic && !activeClinicId && !isSelectingClinic) {
    return <Navigate to="/selecionar-clinica" replace />;
  }

  return <>{children}</>;
}
