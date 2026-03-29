/**
 * Parse dates in multiple formats (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, etc.)
 * and convert to ISO format (YYYY-MM-DD).
 * If day > 12, assumes DD/MM format (Brazilian standard).
 */
export function parseDateMultiFormat(value: string | number | null | undefined): string | null {
  if (value == null || String(value).trim() === "") return null;

  const str = String(value).trim();

  // Already ISO (YYYY-MM-DD or full ISO string)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : str.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (brMatch) {
    const [, p1, p2, year] = brMatch;
    const a = parseInt(p1, 10);
    const b = parseInt(p2, 10);

    // If first part > 12, it must be day (DD/MM/YYYY)
    // If second part > 12, it must be day (MM/DD/YYYY)
    // If ambiguous (both <= 12), assume Brazilian DD/MM/YYYY
    let day: number, month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      day = b;
      month = a;
    } else {
      // Ambiguous — assume Brazilian format DD/MM
      day = a;
      month = b;
    }

    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const d = new Date(isoDate);
    return isNaN(d.getTime()) ? null : isoDate;
  }

  // DD/MM/YY or DD-MM-YY
  const shortYear = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (shortYear) {
    const [, p1, p2, yy] = shortYear;
    const year = parseInt(yy, 10) + (parseInt(yy, 10) > 50 ? 1900 : 2000);
    const a = parseInt(p1, 10);
    const b = parseInt(p2, 10);
    let day: number, month: number;
    if (a > 12) { day = a; month = b; }
    else if (b > 12) { day = b; month = a; }
    else { day = a; month = b; }

    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const d = new Date(isoDate);
    return isNaN(d.getTime()) ? null : isoDate;
  }

  // Excel serial date number
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utcDays = serial - 25569;
    const d = new Date(utcDays * 86400000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  // Fallback: try native Date parse
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback.toISOString().slice(0, 10);
}
