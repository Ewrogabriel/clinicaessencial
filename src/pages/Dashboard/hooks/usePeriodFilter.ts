import { useState } from "react";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { PeriodValue } from "../types";

interface PeriodRange {
  start: Date;
  end: Date;
}

export function usePeriodFilter(defaultPeriod: PeriodValue = "30days") {
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);

  const getRange = (p: PeriodValue): PeriodRange => {
    const now = new Date();
    switch (p) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "7days":
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case "30days":
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    }
  };

  return {
    period,
    setPeriod,
    range: getRange(period),
  };
}
