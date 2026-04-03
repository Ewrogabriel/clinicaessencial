import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConciliacaoBancaria from "./ConciliacaoBancaria";
import ContasBancarias from "./ContasBancarias";

export default function FinanceModule() {
  return (
    <Tabs defaultValue="conciliacao" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
        <TabsTrigger value="contas">Contas Bancárias</TabsTrigger>
        <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
      </TabsList>

      <TabsContent value="conciliacao" className="mt-6">
        <ConciliacaoBancaria />
      </TabsContent>

      <TabsContent value="contas" className="mt-6">
        <ContasBancarias />
      </TabsContent>

      <TabsContent value="relatorios" className="mt-6">
        {/* Próxima PR */}
      </TabsContent>
    </Tabs>
  );
}
