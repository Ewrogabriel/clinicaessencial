import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, User, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUpdateConfirmation } from "@/modules/appointments/hooks/useConfirmation";

interface ReminderNotificationProps {
  agendamento: any;
  type: "24h" | "1h" | "custom";
}

const typeConfig = {
  "24h": { label: "Lembrete 24h", className: "bg-blue-100 text-blue-700 border-blue-200" },
  "1h": { label: "Lembrete 1h", className: "bg-amber-100 text-amber-700 border-amber-200" },
  custom: { label: "Lembrete", className: "bg-purple-100 text-purple-700 border-purple-200" },
};

export function ReminderNotification({ agendamento, type }: ReminderNotificationProps) {
  const updateMutation = useUpdateConfirmation();

  const paciente = agendamento.pacientes ?? agendamento.paciente;
  const confirmacao = agendamento.confirmacao_presenca as string | null;

  const dataFmt = agendamento.data_horario
    ? format(parseISO(agendamento.data_horario), "dd/MM/yyyy", { locale: ptBR })
    : "—";
  const horaFmt = agendamento.data_horario
    ? format(parseISO(agendamento.data_horario), "HH:mm")
    : "—";

  const handleConfirm = () => {
    updateMutation.mutate({ agendamentoId: agendamento.id, status: "confirmado" });
  };

  const handleCancel = () => {
    updateMutation.mutate({ agendamentoId: agendamento.id, status: "cancelado" });
  };

  const handleReschedule = () => {
    window.open(`/agenda?remarcar=${agendamento.id}`, "_self");
  };

  const isPending = updateMutation.isPending;

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Left: type badge + time */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <Badge className={`text-xs ${typeConfig[type].className}`}>
              {typeConfig[type].label}
            </Badge>
            <div className="h-10 w-12 rounded-md bg-primary/10 flex flex-col items-center justify-center mt-1">
              <Clock className="h-3 w-3 text-primary mb-0.5" />
              <span className="text-xs font-bold text-primary">{horaFmt}</span>
            </div>
          </div>

          {/* Center: patient info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{paciente?.nome ?? "—"}</p>
              {confirmacao === "confirmado" && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs gap-1">
                  <Check className="h-3 w-3" /> Confirmado
                </Badge>
              )}
              {confirmacao === "cancelado" && (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                  <X className="h-3 w-3" /> Cancelado
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <Calendar className="h-3 w-3" />
              <span>{dataFmt}</span>
              {agendamento.tipo_atendimento && (
                <>
                  <span className="mx-1">•</span>
                  <User className="h-3 w-3" />
                  <span className="capitalize">{agendamento.tipo_atendimento}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        {confirmacao !== "confirmado" && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <Button
              size="sm"
              className="gap-1.5 h-7 text-xs bg-green-600 hover:bg-green-700 text-white border-0 flex-1"
              onClick={handleConfirm}
              disabled={isPending}
            >
              <Check className="h-3.5 w-3.5" /> Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs flex-1"
              onClick={handleReschedule}
              disabled={isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Remarcar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 flex-1"
              onClick={handleCancel}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
