import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Activity, Star, UserX, AlertTriangle } from "lucide-react";
import { LazyLoadFallback } from "@/components/LazyLoadFallback";

const RelatoriosContent = lazy(() => import("./RelatoriosContent"));
const Indicadores = lazy(() => import("./Indicadores"));
const InteligenciaBI = lazy(() => import("./InteligenciaBI"));
const NpsAdminPanel = lazy(() =>
  import("@/components/reports/NpsAdminPanel").then((m) => ({ default: m.NpsAdminPanel }))
);
const ReengagementCampaign = lazy(() =>
  import("@/components/reports/ReengagementCampaign").then((m) => ({ default: m.ReengagementCampaign }))
);
const InadimplenciaReport = lazy(() =>
  import("@/components/reports/InadimplenciaReport").then((m) => ({ default: m.InadimplenciaReport }))
);

const Relatorios = () => {
  const [tab, setTab] = useState("relatorios");

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap w-full max-w-4xl gap-1 h-auto p-1">
          <TabsTrigger value="relatorios" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Indicadores
          </TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Inadimplência
          </TabsTrigger>
          <TabsTrigger value="inteligencia-bi" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Inteligência BI
          </TabsTrigger>
          <TabsTrigger value="nps" className="gap-1.5">
            <Star className="h-3.5 w-3.5" /> NPS
          </TabsTrigger>
          <TabsTrigger value="reengajamento" className="gap-1.5">
            <UserX className="h-3.5 w-3.5" /> Reengajamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relatorios" className="mt-4">
          <Suspense fallback={<LazyLoadFallback />}><RelatoriosContent /></Suspense>
        </TabsContent>
        <TabsContent value="indicadores" className="mt-4">
          <Suspense fallback={<LazyLoadFallback />}><Indicadores /></Suspense>
        </TabsContent>
        <TabsContent value="inadimplencia" className="mt-4">
          <Suspense fallback={<LazyLoadFallback />}><InadimplenciaReport /></Suspense>
        </TabsContent>
        <TabsContent value="inteligencia-bi" className="mt-4">
          <Suspense fallback={<LazyLoadFallback />}><InteligenciaBI /></Suspense>
        </TabsContent>
        <TabsContent value="nps" className="mt-4">
          <Suspense fallback={<LazyLoadFallback />}><NpsAdminPanel /></Suspense>
        </TabsContent>
        <TabsContent value="reengajamento" className="mt-4">
          <Suspense fallback={<LazyLoadFallback />}><ReengagementCampaign /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
