import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Brain, Star, UserX, AlertTriangle } from "lucide-react";
import RelatoriosContent from "./RelatoriosContent";
import Indicadores from "./Indicadores";
import Inteligencia from "./Inteligencia";
import { NpsAdminPanel } from "@/components/reports/NpsAdminPanel";
import { ReengagementCampaign } from "@/components/reports/ReengagementCampaign";
import { InadimplenciaReport } from "@/components/reports/InadimplenciaReport";

const Relatorios = () => {
  const [tab, setTab] = useState("relatorios");

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap w-full max-w-4xl gap-1">
          <TabsTrigger value="relatorios" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Indicadores
          </TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Inadimplência
          </TabsTrigger>
          <TabsTrigger value="inteligencia" className="gap-2">
            <Brain className="h-4 w-4" /> Inteligência
          </TabsTrigger>
          <TabsTrigger value="nps" className="gap-2">
            <Star className="h-4 w-4" /> NPS
          </TabsTrigger>
          <TabsTrigger value="reengajamento" className="gap-2">
            <UserX className="h-4 w-4" /> Reengajamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relatorios" className="mt-4">
          <RelatoriosContent />
        </TabsContent>
        <TabsContent value="indicadores" className="mt-4">
          <Indicadores />
        </TabsContent>
        <TabsContent value="inadimplencia" className="mt-4">
          <InadimplenciaReport />
        </TabsContent>
        <TabsContent value="inteligencia" className="mt-4">
          <Inteligencia />
        </TabsContent>
        <TabsContent value="nps" className="mt-4">
          <NpsAdminPanel />
        </TabsContent>
        <TabsContent value="reengajamento" className="mt-4">
          <ReengagementCampaign />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
