import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { pt } from "date-fns/locale";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ReagendamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profissionalId?: string;
  onConfirm?: (data: { data: Date; hora: string; profissionalId: string }) => void;
  profissionaisList?: Array<{ id: string; nome: string }>;
}

export const ReagendamentoDialog = ({
  open,
  onOpenChange,
  profissionalId,
  onConfirm,
  profissionaisList = [],
}: ReagendamentoDialogProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedProf, setSelectedProf] = useState(profissionalId || "");

  const horarios = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00",
  ];

  const handleConfirm = () => {
    if (selectedDate && selectedTime && selectedProf) {
      onConfirm?.({
        data: selectedDate,
        hora: selectedTime,
        profissionalId: selectedProf,
      });
      onOpenChange(false);
      setSelectedTime("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reagendar Consulta</DialogTitle>
          <DialogDescription>
            Escolha a data, hora e profissional disponíveis
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seletor de Profissional */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Profissional</label>
            <select
              value={selectedProf}
              onChange={(e) => setSelectedProf(e.target.value)}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">Selecione um profissional</option>
              {profissionaisList.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Data */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Data</label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => isBefore(date, startOfDay(new Date()))}
              locale={pt}
              className="rounded-lg border p-2"
            />
          </div>
        </div>

        {/* Seletor de Hora */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Horário</label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {horarios.map((hora) => (
              <button
                key={hora}
                onClick={() => setSelectedTime(hora)}
                className={`p-2 text-sm rounded-lg border transition-colors ${
                  selectedTime === hora
                    ? "bg-blue-600 text-white border-blue-600"
                    : "hover:border-blue-400"
                }`}
              >
                {hora}
              </button>
            ))}
          </div>
        </div>

        {/* Data Selecionada */}
        {selectedDate && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Resumo:</strong> {format(selectedDate, "dd 'de' MMMM", { locale: pt })} às {selectedTime || "??:??"}
            </p>
          </div>
        )}

        {/* Botões */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!selectedDate || !selectedTime || !selectedProf}
            onClick={handleConfirm}
          >
            Confirmar Reagendamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
