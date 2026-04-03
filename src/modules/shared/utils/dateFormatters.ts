/**
 * Centralised date-formatting utilities.
 *
 * All formatters use `date-fns` with the `pt-BR` locale and `parseISO` to
 * avoid timezone shifts when working with YYYY-MM-DD strings (see memory:
 * "Finance date formatting uses date-fns parseISO").
 *
 * Usage:
 *   import { dateFormats } from "@/modules/shared/utils/dateFormatters";
 *
 *   dateFormats.full("2026-03-25T14:30:00")  → "25/03/2026 14:30"
 *   dateFormats.short("2026-03-25")           → "25/03"
 *   dateFormats.time("2026-03-25T14:30:00")  → "14:30"
 *   dateFormats.monthYear("2026-03-25")       → "Março/2026"
 *   dateFormats.relative("2026-03-25T12:00") → "Há 2 horas"
 */

import { format, parseISO, formatDistanceToNow, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Safely parse an ISO date string or `Date` object.
 * Returns `null` when the input is falsy or cannot be parsed.
 */
function safeParse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : parseISO(value as string);
  return isValid(d) ? d : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const dateFormats = {
  /**
   * Full date and time: "25/03/2026 14:30"
   */
  full(value: string | Date | null | undefined): string {
    const d = safeParse(value);
    return d ? format(d, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "";
  },

  /**
   * Short date (day/month only): "25/03"
   */
  short(value: string | Date | null | undefined): string {
    const d = safeParse(value);
    return d ? format(d, "dd/MM", { locale: ptBR }) : "";
  },

  /**
   * Date only: "25/03/2026"
   */
  date(value: string | Date | null | undefined): string {
    const d = safeParse(value);
    return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "";
  },

  /**
   * Time only: "14:30"
   */
  time(value: string | Date | null | undefined): string {
    const d = safeParse(value);
    return d ? format(d, "HH:mm", { locale: ptBR }) : "";
  },

  /**
   * Month and year: "Março/2026"
   */
  monthYear(value: string | Date | null | undefined): string {
    const d = safeParse(value);
    if (!d) return "";
    const month = format(d, "MMMM", { locale: ptBR });
    const capitalised = month.charAt(0).toUpperCase() + month.slice(1);
    return `${capitalised}/${format(d, "yyyy")}`;
  },

  /**
   * Relative time: "Há 2 horas", "Há 3 dias", etc.
   */
  relative(value: string | Date | null | undefined): string {
    const d = safeParse(value);
    if (!d) return "";
    return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
  },

  /**
   * ISO date part only (YYYY-MM-DD), safe for input[type=date] values.
   */
  iso(value: string | Date | null | undefined): string {
    const d = safeParse(value);
    return d ? format(d, "yyyy-MM-dd") : "";
  },
};
