import { useAuth } from "@/modules/auth/hooks/useAuth";
import { DashboardRole } from "../types";

export function useDashboardRole(): DashboardRole {
  const { isAdmin, isGestor, isSecretario, isProfissional, isMaster } = useAuth();
  if (isMaster && !isAdmin) return "master";
  if (isAdmin) return "admin";
  if (isGestor) return "gestor";
  if (isSecretario) return "secretario";
  if (isProfissional) return "profissional";
  return "paciente";
}
