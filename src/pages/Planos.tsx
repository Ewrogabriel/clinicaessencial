import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

const Planos = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          Planos
        </h1>
        <p className="text-muted-foreground">
          Controle de planos e sessões
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">Planos em desenvolvimento</p>
            <p className="text-sm mt-1">
              Esta funcionalidade será implementada na Fase 3
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Planos;
