import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CommissionExtract } from "@/components/profissionais/CommissionExtract";
import { useAuth } from "@/modules/auth/hooks/useAuth";

const Comissoes = () => {
  const { isAdmin, isGestor, isProfissional } = useAuth();
  const navigate = useNavigate();
  const canManage = isAdmin || isGestor;

  // Professional-only view/Gestor view - Unified to show extract
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
              {isProfissional && !canManage ? "Minhas Comissões" : "Comissões"}
            </h1>
            <p className="text-muted-foreground">
              {isProfissional && !canManage 
                ? "Confira seus atendimentos e valores a receber" 
                : "Acompanhe e calcule as comissões dos profissionais"}
            </p>
          </div>
        </div>
      </div>

      <CommissionExtract />
    </div>
  );
};

export default Comissoes;
