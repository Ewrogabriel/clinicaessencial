import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Brain } from "lucide-react";
import RelatoriosContent from "./RelatoriosContent";
import Indicadores from "./Indicadores";
import Inteligencia from "./Inteligencia";

const Relatorios = () => {
  const [tab, setTab] = useState("relatorios");

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="relatorios" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Indicadores
          </TabsTrigger>
          <TabsTrigger value="inteligencia" className="gap-2">
            <Brain className="h-4 w-4" /> Inteligência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relatorios" className="mt-4">
          <RelatoriosContent />
        </TabsContent>
        <TabsContent value="indicadores" className="mt-4">
          <Indicadores />
        </TabsContent>
        <TabsContent value="inteligencia" className="mt-4">
          <Inteligencia />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
