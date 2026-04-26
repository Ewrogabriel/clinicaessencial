import { BookOpen, CalendarCheck, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type AppointmentType = "matricula" | "sessao_avulsa" | "sessao_plano";

interface AppointmentTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeSelected: (type: AppointmentType) => void;
}

const OPTIONS = [
  {
    type: "matricula" as AppointmentType,
    icon: BookOpen,
    title: "Matrícula",
    description: "Plano de sessões recorrentes com contrato e cobrança mensal.",
    color: "text-purple-600",
    bg: "hover:bg-purple-50 hover:border-purple-300",
  },
  {
    type: "sessao_avulsa" as AppointmentType,
    icon: CalendarCheck,
    title: "Sessão Avulsa",
    description: "Uma sessão isolada, sem vínculo com plano ou matrícula.",
    color: "text-blue-600",
    bg: "hover:bg-blue-50 hover:border-blue-300",
  },
  {
    type: "sessao_plano" as AppointmentType,
    icon: Layers,
    title: "Sessão do Plano",
    description: "Sessão vinculada a um pacote de sessões já contratado.",
    color: "text-green-600",
    bg: "hover:bg-green-50 hover:border-green-300",
  },
];

export function AppointmentTypeSelector({
  open,
  onOpenChange,
  onTypeSelected,
}: AppointmentTypeSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-[Plus_Jakarta_Sans]">
            Tipo de Agendamento
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1 mb-2">
          Selecione o tipo de agendamento para prosseguir com o preenchimento
          adequado.
        </p>
        <div className="flex flex-col gap-3">
          {OPTIONS.map(({ type, icon: Icon, title, description, color, bg }) => (
            <button
              key={type}
              type="button"
              onClick={() => onTypeSelected(type)}
              className={cn(
                "flex items-start gap-4 rounded-lg border p-4 text-left transition-colors",
                bg
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card",
                  color
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
