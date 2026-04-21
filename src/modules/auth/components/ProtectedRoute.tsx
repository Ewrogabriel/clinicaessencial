import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const { isMultiClinic, activeClinicId } = useClinic();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="w-full max-w-md space-y-4">
                    <div className="flex justify-center mb-8">
                        <Skeleton className="h-12 w-48 rounded-lg" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-10 w-full rounded-md mt-6" />
                </div>
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
