import { useState } from "react";
import { Clock, Plus, Trash2, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWeekdaySlots } from "@/modules/appointments/hooks/useAppointments";
import { toast } from "sonner";
import type { WeeklyScheduleEntry } from "./EnrollmentForm";

const WEEKDAYS = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
];

type Props = {
  schedules: WeeklyScheduleEntry[];
  onSchedulesChange: (schedules: WeeklyScheduleEntry[]) => void;
  profissionais: { user_id: string; nome: string }[];
  clinicId: string | null;
};

export function SchedulePickerCards({ schedules, onSchedulesChange, profissionais, clinicId }: Props) {
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [duration, setDuration] = useState("60");

  const { data: slots = [], isLoading } = useWeekdaySlots({
    professionalId: selectedProfessional || undefined,
    weekday: selectedWeekday ?? undefined,
    clinicId,
    durationMin: parseInt(duration) || 60,
  });

  const handleSelectWeekday = (day: number) => {
    setSelectedWeekday(day === selectedWeekday ? null : day);
    setSelectedTime("");
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time === selectedTime ? "" : time);
  };

  const addSchedule = () => {
    if (selectedWeekday === null || !selectedTime || !selectedProfessional) return;

    const conflict = schedules.some(
      (s) => s.weekday === selectedWeekday && s.time === selectedTime && s.professional_id === selectedProfessional
    );
    if (conflict) {
      toast.error("Este horário já foi adicionado.");
      return;
    }

    onSchedulesChange([
      ...schedules,
      {
        weekday: selectedWeekday,
        time: selectedTime,
        professional_id: selectedProfessional,
        session_duration: parseInt(duration) || 60,
      },
    ]);
    setSelectedTime("");
  };

  const removeSchedule = (index: number) => {
    onSchedulesChange(schedules.filter((_, i) => i !== index));
  };

  const getProfName = (id: string) => profissionais.find((p) => p.user_id === id)?.nome || "—";

  // Check which weekdays already have schedules
  const scheduledDays = new Set(schedules.map((s) => s.weekday));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Frequência Semanal</Label>
        {schedules.length > 0 && (
          <Badge variant="secondary" className="font-semibold">{schedules.length}x / semana</Badge>
        )}
      </div>

      {/* Professional selection */}
      <div>
        <Label className="text-xs text-muted-foreground">Profissional</Label>
        <Select value={selectedProfessional} onValueChange={(v) => { setSelectedProfessional(v); setSelectedTime(""); }}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecione o profissional" />
          </SelectTrigger>
          <SelectContent>
            {profissionais.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Weekday cards */}
      {selectedProfessional && (
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Selecione o dia da semana</Label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {WEEKDAYS.map((day) => {
              const isSelected = selectedWeekday === day.value;
              const hasSchedule = scheduledDays.has(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => handleSelectWeekday(day.value)}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all duration-200 cursor-pointer",
                    "hover:shadow-md hover:scale-[1.02]",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                      : hasSchedule
                        ? "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700"
                        : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {day.short}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{day.label}</span>
                  {hasSchedule && (
                    <CheckCircle2 className="absolute -top-1.5 -right-1.5 h-4 w-4 text-green-600 fill-green-100" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Time slots as cards */}
      {selectedWeekday !== null && selectedProfessional && (
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            Selecione o horário
            {isLoading && <span className="ml-2 text-xs animate-pulse">carregando...</span>}
          </Label>
          {!isLoading && slots.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
              Nenhum horário disponível para este dia.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {slots.map((slot) => {
                const isFull = slot.current_capacity >= slot.max_capacity;
                const isSelected = selectedTime === slot.time;
                const available = slot.max_capacity - slot.current_capacity;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={isFull}
                    onClick={() => handleSelectTime(slot.time)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border-2 p-2.5 transition-all duration-200",
                      isFull
                        ? "border-destructive/30 bg-destructive/5 opacity-60 cursor-not-allowed"
                        : isSelected
                          ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20 scale-[1.02]"
                          : "border-border bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer"
                    )}
                  >
                    <Clock className={cn("h-4 w-4 mb-1", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-bold", isSelected ? "text-primary" : "text-foreground")}>
                      {slot.time}
                    </span>
                    <div className={cn(
                      "flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      isFull
                        ? "bg-destructive/10 text-destructive"
                        : available <= 1
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    )}>
                      <Users className="h-2.5 w-2.5" />
                      {isFull ? "Lotado" : `${available}/${slot.max_capacity}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Duration + Add button */}
      {selectedTime && (
        <div className="flex items-end gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
          <div className="flex-1">
            <Label className="text-xs">Duração (min)</Label>
            <Input
              type="number"
              className="mt-1"
              value={duration}
              min={15}
              step={15}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <Button type="button" onClick={addSchedule} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      )}

      {/* Added schedules */}
      {schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed">
          Nenhum horário configurado. Selecione um profissional, dia e horário acima.
        </p>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Horários adicionados</Label>
          {schedules.map((s, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-card rounded-xl px-4 py-3 border shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                  {WEEKDAYS.find((d) => d.value === s.weekday)?.short}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{s.time}</span>
                    <span className="text-xs text-muted-foreground">({s.session_duration}min)</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{getProfName(s.professional_id)}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSchedule(index)}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
