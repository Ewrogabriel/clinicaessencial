/**
 * ClinicThemeWrapper
 * Componente intermediário que aplica as cores do tema da clínica.
 * Deve envolver o conteúdo principal do app, dentro de QueryClient e Auth.
 */
import { useClinicTheme } from "@/modules/clinic/hooks/useClinicTheme";

export function ClinicThemeWrapper({ children }: { children: React.ReactNode }) {
  useClinicTheme();
  return <>{children}</>;
}
