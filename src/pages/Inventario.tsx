import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Wrench } from "lucide-react";
import { LazyLoadFallback } from "@/components/LazyLoadFallback";

const Produtos = lazy(() => import("./Produtos"));
const Equipamentos = lazy(() => import("./Equipamentos"));

const Inventario = () => {
  const [tab, setTab] = useState("produtos");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Inventário</h1>
        <p className="text-muted-foreground">Produtos, equipamentos e materiais de consumo</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="produtos" className="gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="equipamentos" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Equipamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4">
          <Suspense fallback={<LazyLoadFallback />}>
            <Produtos />
          </Suspense>
        </TabsContent>
        <TabsContent value="equipamentos" className="mt-4">
          <Suspense fallback={<LazyLoadFallback />}>
            <Equipamentos />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Inventario;
