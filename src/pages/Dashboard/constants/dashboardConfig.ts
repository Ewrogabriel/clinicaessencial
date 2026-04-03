import { PeriodValue } from "../types";

export const PERIOD_OPTIONS: Array<{ label: string; value: PeriodValue }> = [
  { label: "Hoje", value: "today" },
  { label: "Últimos 7 dias", value: "7days" },
  { label: "Últimos 30 dias", value: "30days" },
  { label: "Este mês", value: "month" },
  { label: "Este ano", value: "year" },
];

export const DEFAULT_PERIOD: PeriodValue = "30days";
