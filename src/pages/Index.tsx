import { Navigate } from "react-router-dom";

const Index = () => {
  // Redireciona para o dashboard (futuramente, verificar autenticação)
  return <Navigate to="/dashboard" replace />;
};

export default Index;
