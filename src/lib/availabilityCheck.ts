import { supabase } from "@/integrations/supabase/client";

export interface AvailabilitySlot {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  max_pacientes: number;
}

export interface AvailabilityCheckResult {
  isWithinSchedule: boolean;
  isOverCapacity: boolean;
  currentCount: number;
  maxCapacity: number;
  matchingSlot: AvailabilitySlot | null;
  message: string;
}

/**
 * Check if a given datetime fits within a professional's availability
 * and whether the slot still has capacity.
 */
export async function checkAvailability(
  profissionalId: string,
  dateTime: Date,
  requestedTipoSessao: 'individual' | 'grupo' = 'individual'
): Promise<AvailabilityCheckResult> {
  const dayOfWeek = dateTime.getDay(); // 0=Sun, 1=Mon...
  const timeStr = `${String(dateTime.getHours()).padStart(2, "0")}:${String(dateTime.getMinutes()).padStart(2, "0")}:00`;

  // 1. Fetch all active slots for this professional on this day
  const { data: slots } = await (supabase
    .from("disponibilidade_profissional") as any)
    .select("*")
    .eq("profissional_id", profissionalId)
    .eq("dia_semana", dayOfWeek)
    .eq("ativo", true);

  if (!slots || slots.length === 0) {
    return {
      isWithinSchedule: false,
      isOverCapacity: false,
      currentCount: 0,
      maxCapacity: 0,
      matchingSlot: null,
      message: "O profissional não tem disponibilidade configurada para este dia da semana.",
    };
  }

  // 2. Find a slot that covers this time
  const matchingSlot = slots.find((s: AvailabilitySlot) => {
    return timeStr >= s.hora_inicio && timeStr < s.hora_fim;
  });

  if (!matchingSlot) {
    const available = slots.map((s: AvailabilitySlot) =>
      `${s.hora_inicio.slice(0, 5)}-${s.hora_fim.slice(0, 5)}`
    ).join(", ");
    return {
      isWithinSchedule: false,
      isOverCapacity: false,
      currentCount: 0,
      maxCapacity: 0,
      matchingSlot: null,
      message: `Horário fora da disponibilidade do profissional. Horários disponíveis: ${available}`,
    };
  }

  // 3. Define the specific 60-minute interval for this time
  const durationMin = 60;
  const [hRequested, mRequested] = timeStr.split(":").map(Number);
  const requestedStartTotalMin = hRequested * 60 + mRequested;
  
  // The interval starts exactly at the requested time (since users pick slots from the UI)
  const intervalStartTimeStr = timeStr;
  const intervalEndTotalMin = requestedStartTotalMin + durationMin;
  const hEnd = Math.floor(intervalEndTotalMin / 60);
  const mEnd = intervalEndTotalMin % 60;
  const intervalEndTimeStr = `${String(hEnd).padStart(2, "0")}:${String(mEnd).padStart(2, "0")}:00`;

  // 4. Count existing appointments in this 60-minute interval on this date
  const dateStart = new Date(dateTime);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(dateTime);
  dateEnd.setHours(23, 59, 59, 999);

  const { data: appointments } = await supabase
    .from("agendamentos")
    .select("id, data_horario, tipo_sessao")
    .eq("profissional_id", profissionalId)
    .gte("data_horario", dateStart.toISOString())
    .lte("data_horario", dateEnd.toISOString())
    .not("status", "in", '("cancelado","falta")');

  // Count how many appointments fall within THIS SPECIFIC 60-minute interval
  const slotAppointments = (appointments ?? []).filter((a: any) => {
    const aTime = new Date(a.data_horario);
    const aTimeStr = `${String(aTime.getHours()).padStart(2, "0")}:${String(aTime.getMinutes()).padStart(2, "0")}:00`;
    return aTimeStr >= intervalStartTimeStr && aTimeStr < intervalEndTimeStr;
  });

  const hasIndividual = slotAppointments.some((a: any) => a.tipo_sessao === 'individual');
  const currentCount = slotAppointments.length;
  
  let isOverCapacity = false;
  if (requestedTipoSessao === 'individual') {
    isOverCapacity = currentCount > 0;
  } else {
    isOverCapacity = hasIndividual || currentCount >= matchingSlot.max_pacientes;
  }

  return {
    isWithinSchedule: true,
    isOverCapacity,
    currentCount,
    maxCapacity: matchingSlot.max_pacientes,
    matchingSlot: { ...matchingSlot, hora_inicio: intervalStartTimeStr, hora_fim: intervalEndTimeStr },
    message: isOverCapacity
      ? (requestedTipoSessao === 'individual' && currentCount > 0 
          ? `O horário já possui agendamentos. Sessões individuais exigem horário vazio.` 
          : `Capacidade máxima atingida: ${currentCount}/${matchingSlot.max_pacientes} pacientes neste horário.`)
      : `Disponível: ${currentCount}/${matchingSlot.max_pacientes} pacientes neste horário.`,
  };
}

/**
 * Fetch available time slots for a given professional and date
 */
export async function getAvailableSlots(
  profissionalId: string,
  date: Date,
  requestedTipoSessao: 'individual' | 'grupo' = 'individual'
): Promise<{ slot: AvailabilitySlot; currentCount: number; available: number }[]> {
  const dayOfWeek = date.getDay();

  const { data: slots } = await (supabase
    .from("disponibilidade_profissional") as any)
    .select("*")
    .eq("profissional_id", profissionalId)
    .eq("dia_semana", dayOfWeek)
    .eq("ativo", true)
    .order("hora_inicio");

  if (!slots || slots.length === 0) return [];

  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const { data: appointments } = await supabase
    .from("agendamentos")
    .select("id, data_horario")
    .eq("profissional_id", profissionalId)
    .gte("data_horario", dateStart.toISOString())
    .lte("data_horario", dateEnd.toISOString())
    .not("status", "in", '("cancelado","falta")');

  const slicedSlots: { slot: AvailabilitySlot; currentCount: number; available: number }[] = [];
  const durationMin = 60;

  for (const block of slots) {
    const [hStart, mStart] = block.hora_inicio.split(":").map(Number);
    const [hEnd, mEnd] = block.hora_fim.split(":").map(Number);
    const startMin = hStart * 60 + mStart;
    const endMin = hEnd * 60 + mEnd;

    for (let t = startMin; t + durationMin <= endMin; t += durationMin) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      const startTimeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

      const endT = t + durationMin;
      const hE = Math.floor(endT / 60);
      const mE = endT % 60;
      const endTimeStr = `${String(hE).padStart(2, "0")}:${String(mE).padStart(2, "0")}:00`;

      const slicedSlot = { ...block, id: `${block.id}-${startTimeStr}`, hora_inicio: startTimeStr, hora_fim: endTimeStr };

      const slotAppointments = (appointments ?? []).filter((a: any) => {
        const aTime = new Date(a.data_horario);
        const aTimeStr = `${String(aTime.getHours()).padStart(2, "0")}:${String(aTime.getMinutes()).padStart(2, "0")}:00`;
        return aTimeStr >= startTimeStr && aTimeStr < endTimeStr;
      });

      const hasIndividual = slotAppointments.some((a: any) => a.tipo_sessao === 'individual');
      const count = slotAppointments.length;

      let available = 0;
      if (requestedTipoSessao === 'individual') {
        available = count > 0 ? 0 : block.max_pacientes;
      } else {
        available = hasIndividual ? 0 : Math.max(0, block.max_pacientes - count);
      }

      slicedSlots.push({
        slot: slicedSlot,
        currentCount: count,
        available,
      });
    }
  }

  return slicedSlots;
}


/**
 * Fetch a summary of available slots for each day of a month for a professional.
 * If specificTime is provided, it only returns availability for that exact time slot.
 */
export async function getMonthlyAvailability(
  profissionalId: string,
  year: number,
  month: number,
  specificTime?: string
): Promise<Record<number, number>> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  // 1. Get all availability slots for this professional
  const { data: availabilitySlots } = await (supabase
    .from("disponibilidade_profissional") as any)
    .select("*")
    .eq("profissional_id", profissionalId)
    .eq("ativo", true);

  if (!availabilitySlots || availabilitySlots.length === 0) return {};

  // 2. Get all appointments for this professional in this month
  const { data: appointments } = await supabase
    .from("agendamentos")
    .select("data_horario, status, tipo_sessao")
    .eq("profissional_id", profissionalId)
    .gte("data_horario", startDate.toISOString())
    .lte("data_horario", endDate.toISOString())
    .not("status", "in", '("cancelado","falta")');

  const dailyAvailability: Record<number, number> = {};
  const lastDay = endDate.getDate();

  for (let day = 1; day <= lastDay; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();

    let daySlots = (availabilitySlots as AvailabilitySlot[]).filter(s => s.dia_semana === dayOfWeek);

    // Filter by specific time if provided
    if (specificTime) {
      const timeStr = specificTime.includes(":") && specificTime.split(":").length === 2
        ? `${specificTime}:00`
        : specificTime;
      daySlots = daySlots.filter(s => timeStr >= s.hora_inicio && timeStr < s.hora_fim);
    }

    if (daySlots.length === 0) {
      dailyAvailability[day] = 0;
      continue;
    }

    let totalAvailable = 0;
    const durationMin = 60;

    for (const block of daySlots) {
      const [hStart, mStart] = block.hora_inicio.split(":").map(Number);
      const [hEnd, mEnd] = block.hora_fim.split(":").map(Number);
      const startMin = hStart * 60 + mStart;
      const endMin = hEnd * 60 + mEnd;

      for (let t = startMin; t + durationMin <= endMin; t += durationMin) {
        const h = Math.floor(t / 60);
        const m = t % 60;
        const startTimeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

        const endT = t + durationMin;
        const hE = Math.floor(endT / 60);
        const mE = endT % 60;
        const endTimeStr = `${String(hE).padStart(2, "0")}:${String(mE).padStart(2, "0")}:00`;

        const slotAppointments = (appointments ?? []).filter((a: any) => {
          const aDate = new Date(a.data_horario);
          if (aDate.getDate() !== day) return false;
          const aTimeStr = `${String(aDate.getHours()).padStart(2, "0")}:${String(aDate.getMinutes()).padStart(2, "0")}:00`;
          return aTimeStr >= startTimeStr && aTimeStr < endTimeStr;
        });

        const hasIndividual = slotAppointments.some((a: any) => a.tipo_sessao === 'individual');
        totalAvailable += hasIndividual ? 0 : Math.max(0, block.max_pacientes - slotAppointments.length);
      }
    }
    dailyAvailability[day] = totalAvailable;
  }

  return dailyAvailability;
}

