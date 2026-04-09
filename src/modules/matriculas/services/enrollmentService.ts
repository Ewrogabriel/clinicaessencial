import { format, addMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface WeeklyScheduleEntry {
  weekday: number;
  time: string;
  professional_id: string;
  session_duration: number;
}

// Helper: get local timezone offset string like "-03:00"
function getLocalTZOffset(dateStr: string, timeStr: string): string {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const m = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}

// Helper: generate dates for a specific weekday in a range
function getDatesForWeekday(startDateStr: string, endDateStr: string, weekday: number): string[] {
  const dates: string[] = [];
  const end = new Date(endDateStr);
  let current = new Date(startDateStr);
  // Normalize to noon to avoid DST issues
  current = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 12, 0, 0);

  while (current <= end) {
    if (current.getDay() === weekday) {
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export const enrollmentService = {
  /**
   * Generates sessions for a given enrollment for a specific period.
   * Based on the logic previously in Matriculas.tsx
   */
  async generateSessions(params: {
    enrollmentId: string;
    pacienteId: string;
    weeklySchedules: WeeklyScheduleEntry[];
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    tipoAtendimento: string;
    monthlyValue: number;
    tipoSessao: 'individual' | 'grupo';
    clinicId: string;
    userId: string;
  }) {
    const {
      enrollmentId,
      pacienteId,
      weeklySchedules,
      startDate,
      endDate,
      tipoAtendimento,
      monthlyValue,
      tipoSessao,
      clinicId,
      userId
    } = params;

    const groupId = crypto.randomUUID();
    const toInsert: any[] = [];

    for (const s of weeklySchedules) {
      const dates = getDatesForWeekday(startDate, endDate, s.weekday);
      for (const dt of dates) {
        const monthRef = dt.substring(0, 7);
        // Calculate how many sessions of this specific schedule (weekday/time) happen in this month
        // to distribute the monthly value proportionally for commission tracking.
        const sessionsInMonth = getDatesForWeekday(
          `${monthRef}-01`,
          format(new Date(new Date(monthRef + "-01").getFullYear(), new Date(monthRef + "-01").getMonth() + 1, 0), "yyyy-MM-dd"),
          s.weekday
        ).length;

        toInsert.push({
          paciente_id: pacienteId,
          profissional_id: s.professional_id,
          data_horario: `${dt}T${s.time}:00${getLocalTZOffset(dt, s.time)}`,
          duracao_minutos: s.session_duration,
          tipo_atendimento: tipoAtendimento,
          tipo_sessao: tipoSessao,
          status: "agendado",
          recorrente: true,
          recorrencia_grupo_id: groupId,
          recorrencia_fim: endDate,
          enrollment_id: enrollmentId,
          valor_sessao: monthlyValue > 0 && sessionsInMonth > 0
            ? parseFloat((monthlyValue / sessionsInMonth).toFixed(2))
            : 0,
          created_by: userId,
          clinic_id: clinicId,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data, error } = await supabase.from("agendamentos").insert(toInsert).select("id");
      if (error) throw error;
      return data?.length || 0;
    }
    return 0;
  },

  /**
   * Deletes future sessions for an enrollment that haven't been completed yet.
   */
  async deleteFutureSessions(enrollmentId: string, fromDate: string) {
    const { error } = await supabase
      .from("agendamentos")
      .delete()
      .eq("enrollment_id", enrollmentId)
      .gte("data_horario", `${fromDate}T00:00:00`)
      .in("status", ["agendado", "confirmado"]);
    
    if (error) throw error;
  }
};
