import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const Relatorios = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          Relatórios
        </h1>
        <p className="text-muted-foreground">
          Relatórios e análises da clínica
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">Relatórios em desenvolvimento</p>
            <p className="text-sm mt-1">
              Esta funcionalidade será implementada na Fase 4
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Relatorios;
