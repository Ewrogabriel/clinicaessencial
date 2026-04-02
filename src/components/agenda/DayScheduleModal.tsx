import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { CheckCircle2, XCircle, AlertTriangle, Plus, CalendarOff } from "lucide-react";

interface Professional {
  user_id: string;
  nome: string;
}

interface SlotAppointment {
  id: string;
  paciente_nome: string;
  status: string;
}

interface TimeSlot {
  time: string; // "HH:MM"
  max_capacity: number;
  current_count: number;
  appointments: SlotAppointment[];
}

type SlotStatus = "available" | "partial" | "full" | "over";

const DAY_TITLE_FORMAT = "EEEE, dd 'de' MMMM 'de' yyyy";

interface DayScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  profissionais: Professional[];
  /** Agendamentos already fetched for the current view period */
  agendamentos: Array<{
    id: string;
    profissional_id: string;
    data_horario: string;
    status: string;
    pacientes?: { nome: string } | null;
  }>;
  /** Called when the user selects a slot; parent opens the booking form */
  onSlotSelect: (date: Date, profissionalId: string) => void;
  /** Pre-select a professional when opening */
  defaultProfissionalId?: string;
}

function getSlotStatus(slot: TimeSlot): SlotStatus {
  if (slot.max_capacity === 0) return "available";
  if (slot.current_count === 0) return "available";
  if (slot.current_count < slot.max_capacity) return "partial";
  if (slot.current_count === slot.max_capacity) return "full";
  return "over";
}

export function DayScheduleModal({
  open,
  onOpenChange,
  selectedDate,
  profissionais,
  agendamentos,
  onSlotSelect,
  defaultProfissionalId,
}: DayScheduleModalProps) {
  const { activeClinicId } = useClinic();
  const [selectedProfId, setSelectedProfId] = useState<string>(defaultProfissionalId ?? "");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep the default professional in sync when the modal opens
  useEffect(() => {
    if (open) {
      setSelectedProfId(defaultProfissionalId ?? "");
      setSlots([]);
    }
  }, [open, defaultProfissionalId]);

  // Re-fetch slots whenever the selected professional or date changes
  useEffect(() => {
    if (!selectedProfId || !open) {
      setSlots([]);
      return;
    }
    fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfId, open, selectedDate.toDateString()]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const dayOfWeek = selectedDate.getDay();
      let query = supabase
        .from("disponibilidade_profissional")
        .select("id, hora_inicio, hora_fim, max_pacientes, dia_semana")
        .eq("profissional_id", selectedProfId)
        .eq("dia_semana", dayOfWeek)
        .eq("ativo", true)
        .order("hora_inicio");

      if (activeClinicId) {
        query = query.eq("clinic_id", activeClinicId);
      }

      const { data: windows } = await query;
      if (!windows || windows.length === 0) {
        setSlots([]);
        return;
      }

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Filter agendamentos to this professional and date (non-cancelled)
      const profAgs = agendamentos.filter((ag) => {
        if (ag.profissional_id !== selectedProfId) return false;
        if (ag.status === "cancelado" || ag.status === "falta") return false;
        const agDate = format(new Date(ag.data_horario), "yyyy-MM-dd");
        return agDate === dateStr;
      });

      // Generate 60-minute slots from each availability window
      const generatedSlots: TimeSlot[] = [];
      for (const win of windows) {
        const [sh, sm] = win.hora_inicio.split(":").map(Number);
        const [eh, em] = win.hora_fim.split(":").map(Number);
        let cur = sh * 60 + sm;
        const end = eh * 60 + em;

        while (cur + 60 <= end) {
          const h = Math.floor(cur / 60);
          const m = cur % 60;
          const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

          const slotAgs = profAgs.filter((ag) => {
            const agTime = format(new Date(ag.data_horario), "HH:mm");
            return agTime === timeStr;
          });

          generatedSlots.push({
            time: timeStr,
            max_capacity: win.max_pacientes,
            current_count: slotAgs.length,
            appointments: slotAgs.map((ag) => ({
              id: ag.id,
              paciente_nome: ag.pacientes?.nome ?? "Paciente",
              status: ag.status,
            })),
          });
          cur += 60;
        }
      }

      setSlots(generatedSlots);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slot: TimeSlot) => {
    const [h, m] = slot.time.split(":").map(Number);
    const d = new Date(selectedDate);
    d.setHours(h, m, 0, 0);
    onSlotSelect(d, selectedProfId);
    onOpenChange(false);
  };

  const statusConfig: Record<
    SlotStatus,
    { label: string; dotClass: string; cardClass: string; badgeClass: string; icon: React.ReactNode }
  > = {
    available: {
      label: "Disponível",
      dotClass: "bg-green-500",
      cardClass: "border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:hover:bg-green-900/40",
      badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
      icon: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    },
    partial: {
      label: "Parcialmente ocupado",
      dotClass: "bg-amber-500",
      cardClass: "border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-900/40",
      badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      icon: <AlertTriangle className="h-3 w-3 text-amber-500" />,
    },
    full: {
      label: "Lotado",
      dotClass: "bg-red-500",
      cardClass: "border-red-200 bg-red-50 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:hover:bg-red-900/40",
      badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
      icon: <XCircle className="h-3 w-3 text-red-500" />,
    },
    over: {
      label: "Acima da capacidade",
      dotClass: "bg-orange-600",
      cardClass: "border-orange-200 bg-orange-50 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/30 dark:hover:bg-orange-900/40",
      badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
      icon: <AlertTriangle className="h-3 w-3 text-orange-600" />,
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-[Plus_Jakarta_Sans]">
            Grade de Horários — {format(selectedDate, DAY_TITLE_FORMAT, { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Professional selector */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Profissional</label>
            <Select value={selectedProfId} onValueChange={setSelectedProfId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {profissionais.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Legend */}
          {selectedProfId && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground p-2.5 bg-muted/30 rounded-md border">
              {(Object.entries(statusConfig) as [SlotStatus, (typeof statusConfig)[SlotStatus]][]).map(
                ([key, cfg]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dotClass)} />
                    {cfg.label}
                  </span>
                )
              )}
            </div>
          )}

          {/* Empty state: no professional selected */}
          {!selectedProfId && (
            <div className="text-center text-muted-foreground py-12">
              <CalendarOff className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Selecione um profissional para ver os horários disponíveis.</p>
            </div>
          )}

          {/* Loading */}
          {selectedProfId && loading && (
            <div className="text-center text-muted-foreground py-12 text-sm">
              Carregando horários...
            </div>
          )}

          {/* No slots */}
          {selectedProfId && !loading && slots.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <CalendarOff className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma disponibilidade cadastrada para este dia.</p>
              <p className="text-xs mt-1 opacity-70">
                Configure a disponibilidade do profissional no menu "Disponibilidade".
              </p>
            </div>
          )}

          {/* Slots grid */}
          {selectedProfId && !loading && slots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {slots.map((slot) => {
                const status = getSlotStatus(slot);
                const cfg = statusConfig[status];
                return (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => handleSlotClick(slot)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all hover:scale-[1.02] hover:shadow-md group",
                      cfg.cardClass
                    )}
                  >
                    {/* Time + capacity badge */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm">{slot.time}</span>
                      {slot.max_capacity > 0 && (
                        <span
                          className={cn(
                            "text-xs font-bold px-1.5 py-0.5 rounded-full",
                            cfg.badgeClass
                          )}
                        >
                          {slot.current_count}/{slot.max_capacity}
                        </span>
                      )}
                    </div>

                    {/* Status label */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </div>

                    {/* Existing appointments */}
                    {slot.appointments.length > 0 && (
                      <div className="space-y-0.5 mb-1">
                        {slot.appointments.map((apt) => (
                          <div key={apt.id} className="text-[10px] text-muted-foreground truncate">
                            • {apt.paciente_nome}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Hover CTA */}
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                      <Plus className="h-3 w-3" />
                      Agendar neste horário
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
