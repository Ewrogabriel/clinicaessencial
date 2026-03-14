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
  slots?: any[];
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

// Status badge colors (background + text)
const statusColors: Record<string, string> = {
  agendado:  "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  confirmado:"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  realizado: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  falta:     "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
  pendente:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200",
};

// Status border / accent colors
const statusBorderColors: Record<string, string> = {
  agendado:  "#3b82f6",
  confirmado:"#10b981",
  realizado: "#22c55e",
  cancelado: "#ef4444",
  falta:     "#f97316",
  pendente:  "#eab308",
};

// Session-type badge colors
const sessionTypeConfig: Record<string, { label: string; className: string }> = {
  individual: { label: "Individual", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700" },
  dupla:      { label: "Dupla",      className: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700" },
  trio:       { label: "Trio",       className: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-700" },
  grupo:      { label: "Grupo",      className: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700" },
};

// Attendance-type dot colors (small indicator)
const attendanceTypeColors: Record<string, string> = {
  pilates:      "#6366f1",
  fisioterapia: "#10b981",
  yoga:         "#a855f7",
  funcional:    "#f59e0b",
  rpg:          "#06b6d4",
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
  // Border color: prefer professional color, fall back to status color
  const borderColor = profColor || statusBorderColors[ag.status] || "#3b82f6";
  const sessTypeInfo = sessionTypeConfig[ag.tipo_sessao] ?? sessionTypeConfig.individual;
  const attendColor = attendanceTypeColors[ag.tipo_atendimento] || "#64748b";

  return (
    <div
      className="rounded-md bg-card p-2 text-xs shadow-sm relative group cursor-pointer hover:shadow-md transition-all border-l-4 overflow-hidden"
      style={{ borderLeftColor: borderColor }}
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
      {/* Subtle background tint */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundColor: borderColor }}
      />
      <div className="relative z-10">
        {/* Patient name + check-in indicators */}
        <div className="font-semibold text-foreground truncate flex items-center gap-1">
          <span
            className="truncate text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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

        {/* Time + duration row */}
        <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
          <span>{time}</span>
          <span>·</span>
          <span>{ag.duracao_minutos}min</span>
          {/* Attendance-type dot */}
          <span
            className="ml-auto w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: attendColor }}
            title={ag.tipo_atendimento}
          />
        </div>

        {/* Professional name */}
        {ag.profiles?.nome && (
          <div className="text-[10px] mt-0.5 font-medium truncate" style={{ color: borderColor }}>
            {ag.profiles.nome}
          </div>
        )}

        {/* Session type + status badges */}
        <div className="flex items-center justify-between mt-1.5 gap-1 flex-wrap">
          <div className="flex items-center gap-1">
            <span className={cn("inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-semibold", sessTypeInfo.className)}>
              {sessTypeInfo.label}
            </span>
            <Badge
              variant="secondary"
              className={cn("text-[9px] px-1.5 py-0", statusColors[ag.status])}
            >
              {ag.status}
            </Badge>
          </div>
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

// ─── Calendar Legend ──────────────────────────────────────────
export function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground px-1">
      <span className="font-medium text-foreground mr-1">Status:</span>
      {Object.entries(statusBorderColors).map(([key, color]) => (
        <span key={key} className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border-l-2 inline-block bg-muted/30" style={{ borderLeftColor: color }} />
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </span>
      ))}
      <span className="font-medium text-foreground mx-1">·</span>
      <span className="font-medium text-foreground mr-1">Tipo:</span>
      {Object.entries(sessionTypeConfig).map(([key, cfg]) => (
        <span key={key} className={cn("flex items-center rounded-full px-1.5 py-0 gap-1", cfg.className)}>
          {cfg.label}
        </span>
      ))}
    </div>
  );
}

// ─── Daily View ──────────────────────────────────────────────
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6);

export function DailyView({
  agendamentos,
  slots,
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
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <span className="font-semibold text-sm">
          {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </span>
        <span className="text-xs text-muted-foreground">{dayAgendamentos.length} agendamento{dayAgendamentos.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="divide-y">
        {HOURS.map((hour, idx) => {
          const hourAgs = dayAgendamentos.filter(
            (ag) => new Date(ag.data_horario).getHours() === hour
          );
          const hourSlots = slots?.filter(s => parseInt(s.start_time?.split(":")[0] ?? "-1") === hour);
          const totalMax = hourSlots?.reduce((acc, s) => acc + (s.max_capacity ?? 0), 0) ?? 0;
          const currentCount = hourAgs.length;
          const isFull = totalMax > 0 && currentCount >= totalMax;
          const hasAppts = hourAgs.length > 0;

          return (
            <div
              key={hour}
              className={cn(
                "flex min-h-[60px] cursor-pointer transition-colors",
                idx % 2 === 0 ? "bg-card" : "bg-muted/10",
                "hover:bg-primary/5"
              )}
              onClick={() => {
                const d = new Date(currentDate);
                d.setHours(hour, 0, 0, 0);
                onSlotClick?.(d);
              }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/10"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("bg-primary/10"); }}
              onDrop={(e) => { e.currentTarget.classList.remove("bg-primary/10"); handleDrop(e, hour); }}
            >
              {/* Hour label column */}
              <div className="w-16 shrink-0 py-2 text-right pr-2 border-r flex flex-col items-end justify-start gap-0.5">
                <span className={cn("text-xs font-semibold", hasAppts ? "text-foreground" : "text-muted-foreground")}>
                  {String(hour).padStart(2, "0")}:00
                </span>
                {totalMax > 0 && (
                  <span className={cn(
                    "text-[10px] font-bold px-1 rounded",
                    isFull
                      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  )}>
                    {currentCount}/{totalMax}
                  </span>
                )}
              </div>
              {/* Appointments grid */}
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
  slots,
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
              {dayAgs.length > 0 && (
                <div className="text-[9px] text-muted-foreground">{dayAgs.length} appt</div>
              )}
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
                const borderColor = profColors[ag.profissional_id] || statusBorderColors[ag.status] || "#3b82f6";
                const bgColor = statusBorderColors[ag.status] || "#3b82f6";
                return (
                  <div
                    key={ag.id}
                    className="truncate rounded px-1 py-0.5 mb-0.5 text-[10px] border-l-2"
                    style={{
                      borderLeftColor: borderColor,
                      backgroundColor: bgColor + "15",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(ag);
                    }}
                  >
                    <span className="truncate font-medium">
                      {format(new Date(ag.data_horario), "HH:mm")}{" "}
                      {ag.pacientes?.nome?.split(" ")[0]}
                    </span>
                    {isPatient && ag.status !== "cancelado" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancel?.(ag.id);
                        }}
                        className="ml-1 text-[8px] text-destructive font-bold float-right"
                      >
                        ✕
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
