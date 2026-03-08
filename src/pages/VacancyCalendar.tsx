import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths,
  isSameDay, isBefore, startOfDay, isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight, Users, Clock, UserPlus, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AvailabilitySlot {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  max_pacientes: number;
  profissional_id: string;
}

interface SlotInfo {
  hora_inicio: string;
  hora_fim: string;
  max_pacientes: number;
  occupied: number;
  available: number;
  profissional_id: string;
  profissional_nome: string;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function VacancyCalendar() {
  const { isAdmin, isGestor, isPatient } = useAuth();
  const navigate = useNavigate();
  const isStaff = isAdmin || isGestor;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterProfId, setFilterProfId] = useState("todos");
  const [filterHoraInicio, setFilterHoraInicio] = useState("");
  const [filterHoraFim, setFilterHoraFim] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [daySlots, setDaySlots] = useState<SlotInfo[]>([]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Fetch professionals
  const { data: profissionais = [] } = useQuery({
    queryKey: ["prof-vacancy-cal"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, nome, cor_agenda").in("user_id", ids).order("nome");
      return data ?? [];
    },
  });

  // Fetch all availability slots
  const { data: allSlots = [] } = useQuery<AvailabilitySlot[]>({
    queryKey: ["disponibilidade-vacancy", filterProfId],
    queryFn: async () => {
      let q = (supabase.from("disponibilidade_profissional") as any).select("*").eq("ativo", true);
      if (filterProfId !== "todos") q = q.eq("profissional_id", filterProfId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Fetch agendamentos for the month
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos-vacancy", format(monthStart, "yyyy-MM"), filterProfId],
    queryFn: async () => {
      let q = supabase.from("agendamentos")
        .select("id, data_horario, profissional_id, status, tipo_sessao, duracao_minutos")
        .gte("data_horario", monthStart.toISOString())
        .lte("data_horario", monthEnd.toISOString())
        .not("status", "in", '("cancelado","falta")');
      if (filterProfId !== "todos") q = q.eq("profissional_id", filterProfId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Fetch bloqueios
  const { data: bloqueios = [] } = useQuery({
    queryKey: ["bloqueios-vacancy", format(monthStart, "yyyy-MM"), filterProfId],
    queryFn: async () => {
      let q = (supabase.from("bloqueios_profissional") as any).select("*")
        .gte("data", format(monthStart, "yyyy-MM-dd"))
        .lte("data", format(monthEnd, "yyyy-MM-dd"));
      if (filterProfId !== "todos") q = q.eq("profissional_id", filterProfId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Fetch feriados
  const { data: feriados = [] } = useQuery({
    queryKey: ["feriados-vacancy", format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data } = await (supabase.from("feriados") as any).select("data")
        .gte("data", format(monthStart, "yyyy-MM-dd"))
        .lte("data", format(monthEnd, "yyyy-MM-dd"));
      return (data ?? []).map((f: any) => f.data);
    },
  });

  // Calculate daily vacancy map
  const dailyVacancies = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const map: Record<string, number> = {};
    const feriadoSet = new Set(feriados);
    const bloqueioFullDays = new Set(
      bloqueios.filter((b: any) => b.dia_inteiro).map((b: any) => b.data)
    );

    for (const day of days) {
      const dayStr = format(day, "yyyy-MM-dd");
      if (feriadoSet.has(dayStr) || bloqueioFullDays.has(dayStr)) {
        map[dayStr] = 0;
        continue;
      }

      const dow = getDay(day);
      let dayAvailSlots = allSlots.filter(s => s.dia_semana === dow);

      // Apply time filter
      if (filterHoraInicio) {
        dayAvailSlots = dayAvailSlots.filter(s => s.hora_fim > filterHoraInicio);
      }
      if (filterHoraFim) {
        dayAvailSlots = dayAvailSlots.filter(s => s.hora_inicio < filterHoraFim);
      }

      let totalAvailable = 0;
      for (const slot of dayAvailSlots) {
        // Check partial blocks
        const isBlocked = bloqueios.some((b: any) => {
          if (b.data !== dayStr || b.dia_inteiro) return false;
          return b.hora_inicio <= slot.hora_inicio && b.hora_fim >= slot.hora_fim;
        });
        if (isBlocked) continue;

        const slotAppts = agendamentos.filter((a: any) => {
          const aDate = new Date(a.data_horario);
          if (format(aDate, "yyyy-MM-dd") !== dayStr) return false;
          if (a.profissional_id !== slot.profissional_id) return false;
          const aTime = `${String(aDate.getHours()).padStart(2, "0")}:${String(aDate.getMinutes()).padStart(2, "0")}:00`;
          return aTime >= slot.hora_inicio && aTime < slot.hora_fim;
        });
        totalAvailable += Math.max(0, slot.max_pacientes - slotAppts.length);
      }
      map[dayStr] = totalAvailable;
    }
    return map;
  }, [allSlots, agendamentos, bloqueios, feriados, monthStart, monthEnd, filterHoraInicio, filterHoraFim]);

  // Open day detail
  const openDayDetail = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dow = getDay(day);
    let dayAvailSlots = allSlots.filter(s => s.dia_semana === dow);

    if (filterHoraInicio) {
      dayAvailSlots = dayAvailSlots.filter(s => s.hora_fim > filterHoraInicio);
    }
    if (filterHoraFim) {
      dayAvailSlots = dayAvailSlots.filter(s => s.hora_inicio < filterHoraFim);
    }

    const slots: SlotInfo[] = dayAvailSlots.map(slot => {
      const prof = profissionais.find((p: any) => p.user_id === slot.profissional_id);
      const slotAppts = agendamentos.filter((a: any) => {
        const aDate = new Date(a.data_horario);
        if (format(aDate, "yyyy-MM-dd") !== dayStr) return false;
        if (a.profissional_id !== slot.profissional_id) return false;
        const aTime = `${String(aDate.getHours()).padStart(2, "0")}:${String(aDate.getMinutes()).padStart(2, "0")}:00`;
        return aTime >= slot.hora_inicio && aTime < slot.hora_fim;
      });
      const occupied = slotAppts.length;
      return {
        hora_inicio: slot.hora_inicio,
        hora_fim: slot.hora_fim,
        max_pacientes: slot.max_pacientes,
        occupied,
        available: Math.max(0, slot.max_pacientes - occupied),
        profissional_id: slot.profissional_id,
        profissional_nome: prof?.nome || "—",
      };
    }).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio) || a.profissional_nome.localeCompare(b.profissional_nome));

    setDaySlots(slots);
    setSelectedDay(day);
  };

  const handleScheduleClick = (slot: SlotInfo, day: Date) => {
    // Navigate to agenda with pre-filled date/time
    const dateStr = format(day, "yyyy-MM-dd");
    const hora = slot.hora_inicio.slice(0, 5);
    navigate(`/agenda?data=${dateStr}&hora=${hora}&prof=${slot.profissional_id}`);
  };

  const handleEnrollClick = () => {
    navigate("/matriculas?nova=1");
  };

  // Calendar grid
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0=Sun

  const getVacancyColor = (vacancies: number) => {
    if (vacancies === 0) return "bg-muted text-muted-foreground";
    if (vacancies <= 2) return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300";
    return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300";
  };

  // Generate time options
  const timeOptions = [];
  for (let h = 6; h <= 21; h++) {
    timeOptions.push(`${String(h).padStart(2, "0")}:00`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Calendário de Vagas</h1>
          <p className="text-muted-foreground">Visualize a disponibilidade e agende diretamente</p>
        </div>
        {isStaff && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleEnrollClick} className="gap-1">
              <UserPlus className="h-4 w-4" /> Nova Matrícula
            </Button>
            <Button onClick={() => navigate("/agenda")} className="gap-1">
              <CalendarPlus className="h-4 w-4" /> Ir para Agenda
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Profissional</Label>
              <Select value={filterProfId} onValueChange={setFilterProfId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os profissionais</SelectItem>
                  {profissionais.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Horário a partir de</Label>
              <Select value={filterHoraInicio || "all"} onValueChange={(v) => setFilterHoraInicio(v === "all" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer horário</SelectItem>
                  {timeOptions.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Horário até</Label>
              <Select value={filterHoraFim || "all"} onValueChange={(v) => setFilterHoraFim(v === "all" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer horário</SelectItem>
                  {timeOptions.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-muted border" />
              <span className="text-muted-foreground">Sem vaga</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700" />
              <span className="text-muted-foreground">Poucas</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700" />
              <span className="text-muted-foreground">Disponível</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map(label => (
              <div key={label} className="text-center text-xs font-medium text-muted-foreground py-1">
                {label}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty padding cells */}
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
            {days.map(day => {
              const dayStr = format(day, "yyyy-MM-dd");
              const vacancies = dailyVacancies[dayStr] ?? 0;
              const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day);
              const today = isToday(day);

              return (
                <button
                  key={dayStr}
                  onClick={() => !isPast && openDayDetail(day)}
                  disabled={isPast}
                  className={cn(
                    "aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all text-sm relative",
                    isPast && "opacity-40 cursor-not-allowed",
                    !isPast && "hover:ring-2 hover:ring-primary/50 cursor-pointer",
                    today && "ring-2 ring-primary",
                    !isPast && getVacancyColor(vacancies),
                  )}
                >
                  <span className={cn("font-medium", today && "text-primary font-bold")}>
                    {format(day, "d")}
                  </span>
                  {!isPast && vacancies > 0 && (
                    <span className="text-[10px] font-semibold leading-none">
                      {vacancies} {vacancies === 1 ? "vaga" : "vagas"}
                    </span>
                  )}
                  {!isPast && vacancies === 0 && (
                    <span className="text-[10px] leading-none text-muted-foreground">lotado</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {selectedDay && format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          {daySlots.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhuma vaga configurada</p>
              <p className="text-sm mt-1">Não há disponibilidade para este dia com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {daySlots.map((slot, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    slot.available > 0
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                      : "bg-muted/50 border-muted"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {slot.hora_inicio.slice(0, 5)} — {slot.hora_fim.slice(0, 5)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">{slot.profissional_nome}</span>
                      <Badge variant={slot.available > 0 ? "default" : "secondary"} className="text-xs">
                        {slot.available > 0
                          ? `${slot.available} ${slot.available === 1 ? "vaga" : "vagas"}`
                          : "Lotado"
                        }
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({slot.occupied}/{slot.max_pacientes} ocupados)
                      </span>
                    </div>
                  </div>
                  {slot.available > 0 && (
                    <Button
                      size="sm"
                      onClick={() => selectedDay && handleScheduleClick(slot, selectedDay)}
                      className="gap-1 ml-2"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> Agendar
                    </Button>
                  )}
                </div>
              ))}

              {isStaff && (
                <div className="flex justify-center pt-3 border-t mt-3">
                  <Button variant="outline" onClick={handleEnrollClick} className="gap-1">
                    <UserPlus className="h-4 w-4" /> Nova Matrícula
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
