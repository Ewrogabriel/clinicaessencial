import { addWeeks, addDays, setHours as setH, setMinutes as setM } from "date-fns";
import type { FormData } from "../../../components/agenda/agendamento-form/types";

/**
 * Generates a list of dates for recurring appointments based on form values.
 */
export const generateRecurringDates = (values: FormData): Date[] => {
  const dates: Date[] = [];
  if (!values.recorrente) return dates;
  
  const startDate = values.data;
  for (let week = 0; week < values.recorrencia_semanas; week++) {
    for (const dia of values.dias_semana) {
      const diaHorario = values.horarios_por_dia[String(dia)] || values.horario || "08:00";
      const [h, m] = diaHorario.split(":").map(Number);
      const weekStart = addWeeks(startDate, week);
      
      // Calculate the correct day of the week
      const dayOffset = (dia - weekStart.getDay() + 7) % 7;
      const targetDate = addDays(weekStart, dayOffset);
      
      // Only add dates that are not in the past (starting from today)
      if (targetDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
        dates.push(setM(setH(targetDate, h), m));
      }
    }
  }
  
  // Deduplicate and sort
  return Array.from(new Set(dates.map(d => d.toISOString())))
    .map(iso => new Date(iso))
    .sort((a, b) => a.getTime() - b.getTime());
};

/**
 * Generates a list of dates for simple repeated appointments.
 */
export const generateRepeatedDates = (values: FormData): Date[] => {
  const dates: Date[] = [];
  if (!values.repetir || values.repetir_quantidade <= 1) return dates;

  const [hours, minutes] = values.horario.split(":").map(Number);
  const startDate = new Date(values.data);
  startDate.setHours(hours, minutes, 0, 0);

  for (let i = 0; i < values.repetir_quantidade; i++) {
    dates.push(addWeeks(startDate, i));
  }
  
  return dates;
};
