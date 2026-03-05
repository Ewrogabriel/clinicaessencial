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
import { ptBR } from "date-fns/locale";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getMonthlyAvailability, getAvailableSlots, AvailabilitySlot } from "@/lib/availabilityCheck";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

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
  const [availableSlots, setAvailableSlots] = useState<{ slot: AvailabilitySlot; currentCount: number; available: number }[]>([]);
  const [monthlyAvail, setMonthlyAvail] = useState<Record<number, number>>({});
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  // Update selected professional if prop changes
  useEffect(() => {
    if (profissionalId) setSelectedProf(profissionalId);
  }, [profissionalId]);

  // Fetch monthly availability
  useEffect(() => {
    if (!selectedProf) return;
    const fetchMonthly = async () => {
      const result = await getMonthlyAvailability(
        selectedProf,
        currentMonth.getFullYear(),
        currentMonth.getMonth()
      );
      setMonthlyAvail(result);
    };
    fetchMonthly();
  }, [selectedProf, currentMonth]);

  // Fetch slots for selected date
  useEffect(() => {
    if (!selectedProf || !selectedDate) {
      setAvailableSlots([]);
      return;
    }
    const fetchSlots = async () => {
      setLoading(true);
      const slots = await getAvailableSlots(selectedProf, selectedDate);
      setAvailableSlots(slots);
      setLoading(false);
    };
    fetchSlots();
  }, [selectedProf, selectedDate]);

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
              aria-label="Selecionar Profissional"
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
              onMonthChange={setCurrentMonth}
              disabled={(date) => isBefore(date, startOfDay(new Date()))}
              locale={ptBR}
              className="rounded-lg border p-2"
              components={{
                DayContent: ({ date }) => {
                  const day = date.getDate();
                  const isSameMonth = date.getMonth() === currentMonth.getMonth();
                  const slots = isSameMonth ? monthlyAvail[day] : null;
                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span className="relative z-10">{day}</span>
                      {slots !== undefined && slots !== null && selectedProf && (
                        <span className={cn(
                          "absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold px-0.5 rounded-full z-20",
                          slots > 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                        )}>
                          {slots}v
                        </span>
                      )}
                    </div>
                  );
                }
              }}
            />
          </div>
        </div>

        {/* Seletor de Hora */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            Horários Disponíveis
            {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </label>
          {availableSlots.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {availableSlots.map(({ slot, available }) => {
                const timeStr = slot.hora_inicio.slice(0, 5);
                const isSelected = selectedTime === timeStr;
                const isFull = available <= 0;

                return (
                  <button
                    key={slot.id}
                    disabled={isFull}
                    onClick={() => setSelectedTime(timeStr)}
                    className={cn(
                      "p-2 text-xs rounded-lg border transition-all flex flex-col items-center gap-0.5",
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600"
                        : isFull
                          ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                          : "hover:border-blue-400 bg-background"
                    )}
                  >
                    <span className="font-medium">{timeStr}</span>
                    <span className="text-[9px] opacity-80">{available} vagas</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
              {!selectedProf
                ? "Selecione um profissional para ver horários"
                : "Nenhum horário disponível para esta data"}
            </div>
          )}
        </div>

        {/* Data Selecionada */}
        {selectedDate && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Resumo:</strong> {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime || "??:??"}
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
