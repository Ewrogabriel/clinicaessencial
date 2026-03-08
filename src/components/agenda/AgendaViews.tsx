import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Agendamento {
  id: string;
  paciente_id: string;
  profissional_id: string;
  data_horario: string;
  duracao_minutos: number;
  tipo_atendimento: string;
  tipo_sessao: string;
  status: string;
  observacoes: string | null;
  checkin_paciente?: boolean;
  checkin_profissional?: boolean;
  checkin_paciente_at?: string | null;
  checkin_profissional_at?: string | null;
  pacientes?: { nome: string; telefone?: string } | null;
  profiles?: { nome: string } | null;
}

interface ViewProps {
  agendamentos: Agendamento[];
  currentDate: Date;
  onSlotClick?: (date: Date) => void;
  isPatient?: boolean;
  onCancel?: (id: string) => void;
  onCheckin?: (id: string, type: "paciente" | "profissional") => void;
  onReschedule?: (ag: Agendamento) => void;
  onAppointmentClick?: (ag: Agendamento) => void;
  profColors?: Record<string, string>;
  onDrop?: (agId: string, newDate: Date) => void;
}

const statusColors: Record<string, string> = {
  agendado: "bg-info text-info-foreground",
  confirmado: "bg-primary text-primary-foreground",
  realizado: "bg-success text-success-foreground",
  cancelado: "bg-destructive text-destructive-foreground",
  falta: "bg-warning text-warning-foreground",
};

function AppointmentCard({
  ag,
  isPatient,
  onCancel,
  onCheckin,
  onReschedule,
  onAppointmentClick,
  profColor,
}: {
  ag: Agendamento;
  isPatient?: boolean;
  onCancel?: (id: string) => void;
  onCheckin?: (id: string, type: "paciente" | "profissional") => void;
  onReschedule?: (ag: Agendamento) => void;
  onAppointmentClick?: (ag: Agendamento) => void;
  profColor?: string;
}) {
  const navigate = useNavigate();
  const time = format(new Date(ag.data_horario), "HH:mm");
  const pacienteNome = ag.pacientes?.nome ?? "Paciente";
  const checkedIn = isPatient ? ag.checkin_paciente : ag.checkin_profissional;
  const canCheckin = ag.status !== "cancelado" && ag.status !== "falta";
  const color = profColor || "#3b82f6";

  return (
    <div
      className="rounded-md bg-card p-2 text-xs shadow-sm relative group cursor-pointer hover:shadow-md transition-all border-l-4 overflow-hidden"
      style={{ borderLeftColor: color }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("agendamento-id", ag.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onAppointmentClick?.(ag);
      }}
    >
      {/* Subtle colored background tint */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundColor: color }}
      />
      <div className="relative z-10">
        <div className="font-semibold text-foreground truncate flex items-center gap-1">
          <span
            className="truncate text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/pacientes/${ag.paciente_id}/detalhes`);
            }}
          >
            {pacienteNome}
          </span>
          {ag.checkin_paciente && (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
          )}
          {ag.checkin_profissional && (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
          )}
        </div>
        <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
          <span>{time}</span>
          <span>·</span>
          <span>{ag.duracao_minutos}min</span>
        </div>
        {ag.profiles?.nome && (
          <div className="text-[10px] mt-0.5 font-medium truncate" style={{ color }}>
            {ag.profiles.nome}
          </div>
        )}
        <div className="flex items-center justify-between mt-1 gap-1">
          <Badge
            variant="secondary"
            className={cn("text-[10px] px-1.5 py-0", statusColors[ag.status])}
          >
            {ag.status}
          </Badge>
          <div className="flex items-center gap-1">
            {canCheckin && !checkedIn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCheckin?.(ag.id, isPatient ? "paciente" : "profissional");
                }}
                className="text-[10px] text-primary hover:underline font-medium"
              >
                Check-in
              </button>
            )}
            {isPatient && ag.status !== "cancelado" && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReschedule?.(ag);
                  }}
                  className="text-[10px] text-amber-600 hover:underline font-medium"
                >
                  Remarcar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel?.(ag.id);
                  }}
                  className="text-[10px] text-destructive hover:underline font-medium"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Daily View ──────────────────────────────────────────────
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6);

export function DailyView({
  agendamentos,
  currentDate,
  onSlotClick,
  isPatient,
  onCancel,
  onCheckin,
  onReschedule,
  onAppointmentClick,
  profColors = {},
  onDrop,
}: ViewProps) {
  const dayAgendamentos = agendamentos.filter((ag) =>
    isSameDay(new Date(ag.data_horario), currentDate)
  );

  const handleDrop = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    const agId = e.dataTransfer.getData("agendamento-id");
    if (agId && onDrop) {
      const d = new Date(currentDate);
      d.setHours(hour, 0, 0, 0);
      onDrop(agId, d);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="px-4 py-2 border-b bg-muted/30">
        <span className="font-semibold text-sm">
          {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </span>
      </div>
      <div className="divide-y">
        {HOURS.map((hour) => {
          const hourAgs = dayAgendamentos.filter(
            (ag) => new Date(ag.data_horario).getHours() === hour
          );
          return (
            <div
              key={hour}
              className="flex min-h-[56px] hover:bg-muted/20 cursor-pointer transition-colors"
              onClick={() => {
                const d = new Date(currentDate);
                d.setHours(hour, 0, 0, 0);
                onSlotClick?.(d);
              }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/10"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("bg-primary/10"); }}
              onDrop={(e) => { e.currentTarget.classList.remove("bg-primary/10"); handleDrop(e, hour); }}
            >
              <div className="w-14 shrink-0 text-xs text-muted-foreground py-2 text-right pr-2 border-r">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="flex-1 p-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                {hourAgs.map((ag) => (
                  <AppointmentCard
                    key={ag.id}
                    ag={ag}
                    isPatient={isPatient}
                    onCancel={onCancel}
                    onCheckin={onCheckin}
                    onReschedule={onReschedule}
                    onAppointmentClick={onAppointmentClick}
                    profColor={profColors[ag.profissional_id]}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weekly View ─────────────────────────────────────────────
export function WeeklyView({
  agendamentos,
  currentDate,
  onSlotClick,
  isPatient,
  onCancel,
  onCheckin,
  onReschedule,
  onAppointmentClick,
  profColors = {},
  onDrop,
}: ViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {weekDays.map((day) => {
        const dayAgs = agendamentos.filter((ag) =>
          isSameDay(new Date(ag.data_horario), day)
        );
        const isToday = isSameDay(day, new Date());

        return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-card p-1.5 min-h-[180px] cursor-pointer hover:bg-muted/20 transition-colors flex flex-col",
                isToday && "ring-2 ring-primary ring-inset"
              )}
              onClick={() => onSlotClick?.(day)}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/10"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("bg-primary/10"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("bg-primary/10");
                const agId = e.dataTransfer.getData("agendamento-id");
                if (agId && onDrop) {
                  const d = new Date(day);
                  d.setHours(9, 0, 0, 0);
                  onDrop(agId, d);
                }
              }}
            >
            <div className="text-center mb-1.5 pb-1 border-b">
              <div className="text-[10px] uppercase text-muted-foreground leading-tight">
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  isToday && "text-primary"
                )}
              >
                {format(day, "dd")}
              </div>
            </div>
            <div className="space-y-1 flex-1 overflow-y-auto">
              {dayAgs.slice(0, 5).map((ag) => (
                <AppointmentCard
                  key={ag.id}
                  ag={ag}
                  isPatient={isPatient}
                  onCancel={onCancel}
                  onCheckin={onCheckin}
                  onReschedule={onReschedule}
                  onAppointmentClick={onAppointmentClick}
                  profColor={profColors[ag.profissional_id]}
                />
              ))}
              {dayAgs.length > 5 && (
                <div className="text-[10px] text-muted-foreground text-center py-0.5">
                  +{dayAgs.length - 5} mais
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Monthly View ────────────────────────────────────────────
export function MonthlyView({
  agendamentos,
  currentDate,
  onSlotClick,
  isPatient,
  onCancel,
  onCheckin,
  onReschedule,
  onAppointmentClick,
  profColors = {},
  onDrop,
}: ViewProps) {
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const isCurrentMonth = (day: Date) =>
    day.getMonth() === currentDate.getMonth();

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {monthDays.map((day) => {
          const dayAgs = agendamentos.filter((ag) =>
            isSameDay(new Date(ag.data_horario), day)
          );
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-card p-1.5 min-h-[80px] cursor-pointer hover:bg-muted/20 transition-colors text-xs",
                !isCurrentMonth(day) && "opacity-40",
                isToday && "ring-2 ring-primary ring-inset"
              )}
              onClick={() => onSlotClick?.(day)}
            >
              <div
                className={cn(
                  "font-medium mb-1",
                  isToday && "text-primary"
                )}
              >
                {format(day, "dd")}
              </div>
              {dayAgs.slice(0, 3).map((ag) => {
                const color = profColors[ag.profissional_id] || "#3b82f6";
                return (
                  <div
                    key={ag.id}
                    className="truncate rounded px-1 py-0.5 mb-0.5 text-[10px] border-l-2 flex justify-between items-center bg-card"
                    style={{ borderLeftColor: color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(ag);
                    }}
                  >
                    <span className="truncate">
                      {format(new Date(ag.data_horario), "HH:mm")}{" "}
                      {ag.pacientes?.nome?.split(" ")[0]}
                    </span>
                    {isPatient && ag.status !== "cancelado" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancel?.(ag.id);
                        }}
                        className="ml-1 text-[8px] text-destructive font-bold"
                      >
                        X
                      </button>
                    )}
                  </div>
                );
              })}
              {dayAgs.length > 3 && (
                <div className="text-[10px] text-muted-foreground">
                  +{dayAgs.length - 3}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
