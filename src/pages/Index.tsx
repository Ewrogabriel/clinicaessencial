import { Navigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { LazyLoadFallback } from "@/components/LazyLoadFallback";
import LandingPage from "./LandingPage";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) return <LazyLoadFallback />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <LandingPage />;
};

export default Index;
