import { Card, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

const Financeiro = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          Financeiro
        </h1>
        <p className="text-muted-foreground">
          Controle financeiro da clínica
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <DollarSign className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">Financeiro em desenvolvimento</p>
            <p className="text-sm mt-1">
              Esta funcionalidade será implementada na Fase 4
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Financeiro;
