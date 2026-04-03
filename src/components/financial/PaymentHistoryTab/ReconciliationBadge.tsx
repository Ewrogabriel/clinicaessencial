import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, AlertTriangle, Ban, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReconciliationBadgeProps {
  bankStatus?: string | null;
  dataConciliacao?: string | null;
}

export function ReconciliationBadge({
  bankStatus,
  dataConciliacao,
}: ReconciliationBadgeProps) {
  if (bankStatus === "conciliado") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {dataConciliacao
          ? `Conciliada em ${format(new Date(dataConciliacao), "dd/MM", { locale: ptBR })}`
          : "Conciliada"}
      </Badge>
    );
  }
  if (bankStatus === "pendente") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Aguardando
      </Badge>
    );
  }
  if (bankStatus === "rejeitado") {
    return (
      <Badge variant="destructive" className="gap-1">
        <Ban className="h-3 w-3" />
        Rejeitada
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <Minus className="h-3 w-3" />
      Sem banco
    </Badge>
  );
}
