import { supabase } from "@/integrations/supabase/client";
import { addDays, format, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface SuggestedSlot {
  date: Date;
  horario: string;
  vagas: number;
  maxCapacity: number;
  dayLabel: string;
}

/**
 * Suggests available time slots for a professional in the next N days
 */
export async function suggestAvailableSlots(
  profissionalId: string,
  daysAhead: number = 14,
  duracaoMinutos: number = 50
): Promise<SuggestedSlot[]> {
  // 1. Fetch professional availability
  const { data: disponibilidades } = await (supabase
    .from("disponibilidade_profissional") as any)
    .select("*")
    .eq("profissional_id", profissionalId)
    .eq("ativo", true);

  if (!disponibilidades?.length) return [];

  // 2. Fetch blocks
  const startDate = new Date();
  const endDate = addDays(startDate, daysAhead);

  const { data: bloqueios } = await (supabase
    .from("bloqueios_profissional") as any)
    .select("*")
    .eq("profissional_id", profissionalId)
    .gte("data", format(startDate, "yyyy-MM-dd"))
    .lte("data", format(endDate, "yyyy-MM-dd"));

  // 3. Fetch existing appointments in the range
  const { data: agendamentos } = await (supabase
    .from("agendamentos") as any)
    .select("data_horario, duracao_minutos, status")
    .eq("profissional_id", profissionalId)
    .gte("data_horario", startDate.toISOString())
    .lte("data_horario", endDate.toISOString())
    .neq("status", "cancelado");

  // 4. Fetch holidays
  const { data: feriados } = await (supabase
    .from("feriados") as any)
    .select("data")
    .gte("data", format(startDate, "yyyy-MM-dd"))
    .lte("data", format(endDate, "yyyy-MM-dd"));

  const feriadoDates = new Set((feriados || []).map((f: any) => f.data));
  const blockedDates = new Set<string>();

  (bloqueios || []).forEach((b: any) => {
    if (b.dia_inteiro) blockedDates.add(b.data);
  });

  const suggestions: SuggestedSlot[] = [];

  // 5. For each day in the range, check slots
  for (let d = 0; d <= daysAhead; d++) {
    const day = addDays(startDate, d);
    const dayStr = format(day, "yyyy-MM-dd");
    const dayOfWeek = getDay(day);

    // Skip holidays and blocked days
    if (feriadoDates.has(dayStr) || blockedDates.has(dayStr)) continue;
    // Skip past today's hours
    if (d === 0 && day.getHours() >= 19) continue;

    // Find availability slots for this day of week
    const daySlots = (disponibilidades || []).filter((s: any) => s.dia_semana === dayOfWeek);

    for (const slot of daySlots) {
      const [startH, startM] = slot.hora_inicio.split(":").map(Number);
      const [endH, endM] = slot.hora_fim.split(":").map(Number);
      const slotStartMin = startH * 60 + startM;
      const slotEndMin = endH * 60 + endM;

      // Generate time slots within this availability window
      for (let t = slotStartMin; t + duracaoMinutos <= slotEndMin; t += duracaoMinutos) {
        const h = Math.floor(t / 60);
        const m = t % 60;
        const horario = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

        // Skip past times for today
        if (d === 0) {
          const now = new Date();
          if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) continue;
        }

        // Check partial blocks
        const isPartialBlocked = (bloqueios || []).some((b: any) => {
          if (b.data !== dayStr || b.dia_inteiro) return false;
          const bStart = b.hora_inicio?.replace(":", "");
          const bEnd = b.hora_fim?.replace(":", "");
          const slotTime = horario.replace(":", "");
          return slotTime >= bStart && slotTime < bEnd;
        });
        if (isPartialBlocked) continue;

        // Count existing appointments at this hour
        const agAtHour = (agendamentos || []).filter((a: any) => {
          const aDate = new Date(a.data_horario);
          return format(aDate, "yyyy-MM-dd") === dayStr &&
            aDate.getHours() === h &&
            aDate.getMinutes() === m;
        });

        const vagas = slot.max_pacientes - agAtHour.length;
        if (vagas > 0) {
          const slotDate = new Date(day);
          slotDate.setHours(h, m, 0, 0);

          suggestions.push({
            date: slotDate,
            horario,
            vagas,
            maxCapacity: slot.max_pacientes,
            dayLabel: format(slotDate, "EEE dd/MM", { locale: ptBR }),
          });
        }
      }
    }
  }

  return suggestions.slice(0, 20); // Limit to 20 best suggestions
}
