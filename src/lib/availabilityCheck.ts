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
  dateTime: Date
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

  // 3. Count existing appointments in this slot range on this date
  const dateStart = new Date(dateTime);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(dateTime);
  dateEnd.setHours(23, 59, 59, 999);

  const { data: appointments } = await supabase
    .from("agendamentos")
    .select("id, data_horario")
    .eq("profissional_id", profissionalId)
    .gte("data_horario", dateStart.toISOString())
    .lte("data_horario", dateEnd.toISOString())
    .not("status", "in", '("cancelado","falta")');

  // Count how many appointments fall within this specific slot
  const slotAppointments = (appointments ?? []).filter((a: any) => {
    const aTime = new Date(a.data_horario);
    const aTimeStr = `${String(aTime.getHours()).padStart(2, "0")}:${String(aTime.getMinutes()).padStart(2, "0")}:00`;
    return aTimeStr >= matchingSlot.hora_inicio && aTimeStr < matchingSlot.hora_fim;
  });

  const hasIndividual = slotAppointments.some((a: any) => a.tipo_sessao === 'individual');
  const currentCount = slotAppointments.length;
  const isOverCapacity = hasIndividual || currentCount >= matchingSlot.max_pacientes;

  return {
    isWithinSchedule: true,
    isOverCapacity,
    currentCount,
    maxCapacity: matchingSlot.max_pacientes,
    matchingSlot,
    message: isOverCapacity
      ? `Capacidade máxima atingida: ${currentCount}/${matchingSlot.max_pacientes} pacientes neste horário.`
      : `Disponível: ${currentCount}/${matchingSlot.max_pacientes} pacientes neste horário.`,
  };
}

/**
 * Fetch available time slots for a given professional and date
 */
export async function getAvailableSlots(
  profissionalId: string,
  date: Date
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

  return slots.map((slot: AvailabilitySlot) => {
    const slotAppointments = (appointments ?? []).filter((a: any) => {
      const aTime = new Date(a.data_horario);
      const aTimeStr = `${String(aTime.getHours()).padStart(2, "0")}:${String(aTime.getMinutes()).padStart(2, "0")}:00`;
      return aTimeStr >= slot.hora_inicio && aTimeStr < slot.hora_fim;
    });

    const hasIndividual = slotAppointments.some((a: any) => a.tipo_sessao === 'individual');
    const count = slotAppointments.length;
    const available = hasIndividual ? 0 : Math.max(0, slot.max_pacientes - count);

    return {
      slot,
      currentCount: count,
      available,
    };
  });
}


/**
 * Fetch a summary of available slots for each day of a month for a professional
 */
export async function getMonthlyAvailability(
  profissionalId: string,
  year: number,
  month: number
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
    .select("data_horario, status")
    .eq("profissional_id", profissionalId)
    .gte("data_horario", startDate.toISOString())
    .lte("data_horario", endDate.toISOString())
    .not("status", "in", '("cancelado","falta")');

  const dailyAvailability: Record<number, number> = {};
  const lastDay = endDate.getDate();

  for (let day = 1; day <= lastDay; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();

    const daySlots = (availabilitySlots as AvailabilitySlot[]).filter(s => s.dia_semana === dayOfWeek);
    if (daySlots.length === 0) {
      dailyAvailability[day] = 0;
      continue;
    }

    let totalAvailable = 0;
    for (const slot of daySlots) {
      const slotAppointments = (appointments ?? []).filter((a: any) => {
        const aDate = new Date(a.data_horario);
        if (aDate.getDate() !== day) return false;

        const aTimeStr = `${String(aDate.getHours()).padStart(2, "0")}:${String(aDate.getMinutes()).padStart(2, "0")}:00`;
        return aTimeStr >= slot.hora_inicio && aTimeStr < slot.hora_fim;
      });

      const hasIndividual = slotAppointments.some((a: any) => a.tipo_sessao === 'individual');
      totalAvailable += hasIndividual ? 0 : Math.max(0, slot.max_pacientes - slotAppointments.length);
    }
    dailyAvailability[day] = totalAvailable;
  }

  return dailyAvailability;
}

