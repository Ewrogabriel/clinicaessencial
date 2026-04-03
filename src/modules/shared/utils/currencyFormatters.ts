/**
 * Centralized currency-formatting utilities for BRL (Brazilian Real).
 *
 * Usage:
 *   import { formatBRL, parseCurrency, getCurrencySymbol }
 *     from "@/modules/shared/utils/currencyFormatters";
 *
 *   formatBRL(1250)          → "R$ 1.250,00"
 *   parseCurrency("1.250,50") → 1250.5
 *   getCurrencySymbol()       → "R$"
 */

// ── Intl formatter (created once for performance) ─────────────────────────────

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Format a number as BRL currency string.
 *
 * @example
 *   formatBRL(1250)    → "R$ 1.250,00"
 *   formatBRL(-99.9)   → "-R$ 99,90"
 *   formatBRL(null)    → "R$ 0,00"
 */
export function formatBRL(value: number | null | undefined): string {
  return brlFormatter.format(value ?? 0);
}

/**
 * Format a number as compact BRL currency (useful for charts/cards).
 *
 * @example
 *   formatBRLCompact(1250000) → "R$ 1,3 mi"
 *   formatBRLCompact(980)     → "R$ 980"
 */
export function formatBRLCompact(value: number | null | undefined): string {
  return compactFormatter.format(value ?? 0);
}

/**
 * Parse a BRL-formatted string (or a plain numeric string) into a number.
 *
 * Handles both Brazilian formatting ("1.250,50") and plain values ("1250.50").
 *
 * @example
 *   parseCurrency("R$ 1.250,50") → 1250.5
 *   parseCurrency("1.250,50")    → 1250.5
 *   parseCurrency("1250.50")     → 1250.5
 *   parseCurrency("")            → 0
 */
export function parseCurrency(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;

  // Remove currency symbol and whitespace
  const cleaned = value.trim().replace(/[R$\s]/g, "");

  // Brazilian format: dots as thousands separators, comma as decimal
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(cleaned)) {
    const normalised = cleaned.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalised);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Plain numeric or already decimal-dot format
  const parsed = parseFloat(cleaned.replace(",", "."));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Return the BRL currency symbol.
 *
 * @example
 *   getCurrencySymbol() → "R$"
 */
export function getCurrencySymbol(): string {
  return "R$";
}

/**
 * Format a percentage value with up to two decimal places.
 *
 * @example
 *   formatPercent(12.5)  → "12,5%"
 *   formatPercent(100)   → "100%"
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "0%";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}
