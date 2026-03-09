import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function AppLayout() {
  const { isPatient } = useAuth();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 sm:gap-4 border-b border-border bg-card px-3 sm:px-4 lg:px-6 shrink-0">
            <SidebarTrigger />
            {!isPatient && <div className="flex-1 min-w-0 max-w-md"><GlobalSearch /></div>}
            <div className="flex-1" />
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <LanguageSwitcher />
              <ThemeToggle />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
