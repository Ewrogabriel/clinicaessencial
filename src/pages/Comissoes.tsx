import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, BarChart2, Settings2, ShieldCheck } from "lucide-react";
import { CommissionExtract } from "@/components/profissionais/CommissionExtract";
import { CommissionRulesConfig } from "@/components/commissions/CommissionRulesConfig";
import { CommissionAudit } from "@/components/commissions/CommissionAudit";
import { useAuth } from "@/modules/auth/hooks/useAuth";

const Comissoes = () => {
  const { isAdmin, isGestor, isProfissional } = useAuth();
  const navigate = useNavigate();
  const canManage = isAdmin || isGestor;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
              {isProfissional && !canManage ? "Minhas Comissões" : "Comissões"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isProfissional && !canManage
                ? "Confira seus atendimentos e valores a receber"
                : "Gestão de comissões e regras de distribuição"}
            </p>
          </div>
        </div>
      </div>

      {/* Profissionais veem apenas o extrato */}
      {isProfissional && !canManage ? (
        <CommissionExtract />
      ) : (
        <Tabs defaultValue="extrato">
          <TabsList className="gap-1">
            <TabsTrigger value="extrato" className="gap-2">
              <BarChart2 className="h-4 w-4" /> Extrato &amp; Fechamento
            </TabsTrigger>
            <TabsTrigger value="regras" className="gap-2">
              <Settings2 className="h-4 w-4" /> Configurar Regras
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extrato" className="mt-4">
            <CommissionExtract />
          </TabsContent>

          <TabsContent value="regras" className="mt-4">
            <CommissionRulesConfig />
          </TabsContent>

          <TabsContent value="auditoria" className="mt-4">
            <CommissionAudit />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Comissoes;
