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
  addHours,
  setHours,
  setMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";
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
  pacientes?: { nome: string } | null;
  profiles?: { nome: string } | null;
}

interface ViewProps {
  agendamentos: Agendamento[];
  currentDate: Date;
  onSlotClick?: (date: Date) => void;
  isPatient?: boolean;
  onCancel?: (id: string) => void;
  onCheckin?: (id: string, type: "paciente" | "profissional") => void;
}

const statusColors: Record<string, string> = {
  agendado: "bg-info text-info-foreground",
  confirmado: "bg-primary text-primary-foreground",
  realizado: "bg-success text-success-foreground",
  cancelado: "bg-destructive text-destructive-foreground",
  falta: "bg-warning text-warning-foreground",
};

const tipoColors: Record<string, string> = {
  fisioterapia: "border-l-primary",
  pilates: "border-l-info",
  rpg: "border-l-warning",
};

function AppointmentCard({ ag, isPatient, onCancel, onCheckin }: { ag: Agendamento, isPatient?: boolean, onCancel?: (id: string) => void, onCheckin?: (id: string, type: "paciente" | "profissional") => void }) {
  const time = format(new Date(ag.data_horario), "HH:mm");
  const pacienteNome = ag.pacientes?.nome ?? "Paciente";
  const checkedIn = isPatient ? ag.checkin_paciente : ag.checkin_profissional;
  const canCheckin = ag.status !== "cancelado" && ag.status !== "falta";

  return (
    <div
      className={cn(
        "rounded-md border-l-4 bg-card p-2 text-xs shadow-sm relative group",
        tipoColors[ag.tipo_atendimento] ?? "border-l-muted"
      )}
    >
      <div className="font-semibold text-foreground truncate flex items-center gap-1">
        {pacienteNome}
        {ag.checkin_paciente && <CheckCircle2 className="h-3 w-3 text-green-500" />}
        {ag.checkin_profissional && <CheckCircle2 className="h-3 w-3 text-primary" />}
      </div>
      <div className="text-muted-foreground flex items-center gap-1">
        <span>{time}</span>
        <span>·</span>
        <span>{ag.duracao_minutos}min</span>
      </div>
      <div className="flex items-center justify-between mt-1 gap-1">
        <Badge variant="secondary" className={cn("text-[10px]", statusColors[ag.status])}>
          {ag.status}
        </Badge>
        <div className="flex items-center gap-1">
          {canCheckin && !checkedIn && (
            <button
              onClick={(e) => { e.stopPropagation(); onCheckin?.(ag.id, isPatient ? "paciente" : "profissional"); }}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              Check-in
            </button>
          )}
          {isPatient && ag.status !== 'cancelado' && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel?.(ag.id); }}
              className="text-[10px] text-destructive hover:underline font-medium"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Daily View ──────────────────────────────────────────────
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6); // 6h-19h

export function DailyView({ agendamentos, currentDate, onSlotClick, isPatient, onCancel, onCheckin }: ViewProps) {
  const dayAgendamentos = agendamentos.filter((ag) =>
    isSameDay(new Date(ag.data_horario), currentDate)
  );

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
              className="flex min-h-[60px] hover:bg-muted/20 cursor-pointer transition-colors"
              onClick={() => {
                const d = new Date(currentDate);
                d.setHours(hour, 0, 0, 0);
                onSlotClick?.(d);
              }}
            >
              <div className="w-16 shrink-0 text-xs text-muted-foreground py-2 text-right pr-3 border-r">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="flex-1 p-1 flex flex-col gap-1">
                {hourAgs.map((ag) => (
                  <AppointmentCard key={ag.id} ag={ag} isPatient={isPatient} onCancel={onCancel} onCheckin={onCheckin} />
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
export function WeeklyView({ agendamentos, currentDate, onSlotClick, isPatient, onCancel, onCheckin }: ViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  return (
    <div className="grid grid-cols-7 gap-1">
      {weekDays.map((day) => {
        const dayAgs = agendamentos.filter((ag) =>
          isSameDay(new Date(ag.data_horario), day)
        );
        const isToday = isSameDay(day, new Date());

        return (
          <div
            key={day.toISOString()}
            className={cn(
              "border rounded-lg p-2 min-h-[200px] cursor-pointer hover:bg-muted/20 transition-colors bg-card",
              isToday && "ring-2 ring-primary"
            )}
            onClick={() => onSlotClick?.(day)}
          >
            <div className="text-center mb-2">
              <div className="text-[10px] uppercase text-muted-foreground">
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
            <div className="space-y-1">
              {dayAgs.slice(0, 4).map((ag) => (
                <AppointmentCard key={ag.id} ag={ag} isPatient={isPatient} onCancel={onCancel} onCheckin={onCheckin} />
              ))}
              {dayAgs.length > 4 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  +{dayAgs.length - 4} mais
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
export function MonthlyView({ agendamentos, currentDate, onSlotClick, isPatient, onCancel, onCheckin }: ViewProps) {
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
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthDays.map((day) => {
          const dayAgs = agendamentos.filter((ag) =>
            isSameDay(new Date(ag.data_horario), day)
          );
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border rounded-md p-1.5 min-h-[80px] cursor-pointer hover:bg-muted/20 transition-colors bg-card text-xs",
                !isCurrentMonth(day) && "opacity-40",
                isToday && "ring-2 ring-primary"
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
              {dayAgs.slice(0, 2).map((ag) => (
                <div
                  key={ag.id}
                  className={cn(
                    "truncate rounded px-1 py-0.5 mb-0.5 text-[10px] border-l-2 flex justify-between items-center",
                    tipoColors[ag.tipo_atendimento]
                  )}
                >
                  <span className="truncate">{format(new Date(ag.data_horario), "HH:mm")} {ag.pacientes?.nome?.split(" ")[0]}</span>
                  {isPatient && ag.status !== 'cancelado' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onCancel?.(ag.id); }}
                      className="ml-1 text-[8px] text-destructive font-bold"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
              {dayAgs.length > 2 && (
                <div className="text-[10px] text-muted-foreground">+{dayAgs.length - 2}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
