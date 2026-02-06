import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const Agenda = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
          Agenda
        </h1>
        <p className="text-muted-foreground">
          Gerencie os agendamentos da clínica
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">Agenda em desenvolvimento</p>
            <p className="text-sm mt-1">
              Esta funcionalidade será implementada na Fase 2
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Agenda;
