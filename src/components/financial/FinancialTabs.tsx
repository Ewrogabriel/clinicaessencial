import { Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Landmark, BarChart3, Receipt, Users2, DollarSign } from "lucide-react";
import { LazyLoadFallback } from "@/components/LazyLoadFallback";
import { ReconciliationPage } from "./ReconciliationPage";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

// Lazy-load heavy sub-pages
const FinanceDashboard = lazy(() =>
  import("@/components/reports/FinanceDashboard").then((m) => ({
    default: m.FinanceDashboard,
  }))
);
const IntegrationStatus = lazy(() =>
  import("@/components/reports/IntegrationStatus").then((m) => ({
    default: m.IntegrationStatus,
  }))
);
const Despesas = lazy(() => import("@/pages/Despesas"));
const Comissoes = lazy(() => import("@/pages/Comissoes"));
const NotasFiscais = lazy(() => import("@/pages/NotasFiscais"));

interface FinancialTabsProps {
  /** Extra content to render inside the Pagamentos tab (existing payments list). */
  pagamentosContent?: React.ReactNode;
  /** Extra content to render inside the Previsão tab. */
  previsaoContent?: React.ReactNode;
  /** Extra content to render inside the DRE tab. */
  dreContent?: React.ReactNode;
  /** Default active tab. */
  defaultTab?: string;
}

/**
 * Consolidated Financial tabs replacing the ad-hoc tab setup in Financeiro.tsx.
 *
 * Tabs:
 *  - Visão Geral (FinanceDashboard KPIs)
 *  - Pagamentos   (payments list, passed as children)
 *  - Previsão     (upcoming / overdue, passed as children)
 *  - Despesas
 *  - Comissões
 *  - Notas Fiscais
 *  - Conciliação  (NEW: uses ReconciliationPage)
 *  - DRE          (passed as children)
 *  - Integrações
 */
export function FinancialTabs({
  pagamentosContent,
  previsaoContent,
  dreContent,
  defaultTab = "visao-geral",
}: FinancialTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList className="flex flex-wrap w-full max-w-5xl gap-1 h-auto p-1">
        <TabsTrigger value="visao-geral" className="gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          Visão Geral
        </TabsTrigger>
        <TabsTrigger value="transacoes" className="gap-1.5">
          <Receipt className="h-3.5 w-3.5" />
          Pagamentos
        </TabsTrigger>
        <TabsTrigger value="previsao">Previsão</TabsTrigger>
        <TabsTrigger value="despesas">Despesas</TabsTrigger>
        <TabsTrigger value="comissoes" className="gap-1.5">
          <Users2 className="h-3.5 w-3.5" />
          Comissões
        </TabsTrigger>
        <TabsTrigger value="notas-fiscais">Notas Fiscais</TabsTrigger>
        <TabsTrigger value="conciliacao" className="gap-1.5">
          <Landmark className="h-3.5 w-3.5" />
          Conciliação
        </TabsTrigger>
        <TabsTrigger value="dre" className="gap-1.5">
          <DollarSign className="h-3.5 w-3.5" />
          DRE
        </TabsTrigger>
        <TabsTrigger value="integracao" className="gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          Integrações
        </TabsTrigger>
      </TabsList>

      <TabsContent value="visao-geral">
        <Suspense fallback={<LazyLoadFallback />}>
          <FinanceDashboard />
        </Suspense>
      </TabsContent>

      <TabsContent value="transacoes" className="space-y-4">
        {pagamentosContent}
      </TabsContent>

      <TabsContent value="previsao" className="space-y-4">
        {previsaoContent}
      </TabsContent>

      <TabsContent value="despesas">
        <Suspense fallback={<LazyLoadFallback />}>
          <Despesas />
        </Suspense>
      </TabsContent>

      <TabsContent value="comissoes">
        <Suspense fallback={<LazyLoadFallback />}>
          <Comissoes />
        </Suspense>
      </TabsContent>

      <TabsContent value="notas-fiscais">
        <Suspense fallback={<LazyLoadFallback />}>
          <NotasFiscais />
        </Suspense>
      </TabsContent>

      <TabsContent value="conciliacao">
        <ReconciliationPage />
      </TabsContent>

      <TabsContent value="dre" className="space-y-4">
        {dreContent}
      </TabsContent>

      <TabsContent value="integracao" className="space-y-4">
        <Suspense fallback={<LazyLoadFallback />}>
          <IntegrationStatus />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
