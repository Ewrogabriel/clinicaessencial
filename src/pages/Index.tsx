import { Navigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import LandingPage from "./LandingPage";

const Index = () => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  
  return <LandingPage />;
};

export default Index;
