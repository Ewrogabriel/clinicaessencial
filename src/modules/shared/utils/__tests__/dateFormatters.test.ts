/**
 * Unit tests for shared/utils/dateFormatters.
 */

import { describe, it, expect } from "vitest";
import { dateFormats } from "../dateFormatters";

describe("dateFormats", () => {
  // ── full ───────────────────────────────────────────────────────────────────
  describe("full", () => {
    it("formats an ISO datetime as dd/MM/yyyy HH:mm", () => {
      expect(dateFormats.full("2026-03-25T14:30:00")).toBe("25/03/2026 14:30");
    });

    it("returns empty string for null", () => {
      expect(dateFormats.full(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(dateFormats.full(undefined)).toBe("");
    });

    it("accepts a Date object", () => {
      const d = new Date("2026-03-25T14:30:00.000Z");
      const result = dateFormats.full(d);
      // Just validate format pattern, not the exact time (timezone-dependent)
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });
  });

  // ── short ──────────────────────────────────────────────────────────────────
  describe("short", () => {
    it("formats an ISO date as dd/MM", () => {
      expect(dateFormats.short("2026-03-25")).toBe("25/03");
    });

    it("returns empty string for empty input", () => {
      expect(dateFormats.short("")).toBe("");
    });
  });

  // ── date ───────────────────────────────────────────────────────────────────
  describe("date", () => {
    it("formats an ISO date as dd/MM/yyyy", () => {
      expect(dateFormats.date("2026-03-25")).toBe("25/03/2026");
    });

    it("returns empty string for null", () => {
      expect(dateFormats.date(null)).toBe("");
    });
  });

  // ── time ───────────────────────────────────────────────────────────────────
  describe("time", () => {
    it("extracts the time portion as HH:mm", () => {
      expect(dateFormats.time("2026-03-25T14:30:00")).toBe("14:30");
    });

    it("returns empty string for null", () => {
      expect(dateFormats.time(null)).toBe("");
    });
  });

  // ── monthYear ──────────────────────────────────────────────────────────────
  describe("monthYear", () => {
    it("formats as Capitalized Month/Year in Portuguese", () => {
      // "março" → "Março/2026"
      expect(dateFormats.monthYear("2026-03-25")).toBe("Março/2026");
    });

    it("formats January correctly", () => {
      expect(dateFormats.monthYear("2026-01-01")).toBe("Janeiro/2026");
    });

    it("returns empty string for null", () => {
      expect(dateFormats.monthYear(null)).toBe("");
    });
  });

  // ── relative ───────────────────────────────────────────────────────────────
  describe("relative", () => {
    it("returns a non-empty string for a valid date", () => {
      const result = dateFormats.relative("2026-01-01T00:00:00");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns empty string for null", () => {
      expect(dateFormats.relative(null)).toBe("");
    });
  });

  // ── iso ────────────────────────────────────────────────────────────────────
  describe("iso", () => {
    it("returns the YYYY-MM-DD portion", () => {
      expect(dateFormats.iso("2026-03-25T14:30:00")).toBe("2026-03-25");
    });

    it("is stable for a plain date string", () => {
      expect(dateFormats.iso("2026-12-31")).toBe("2026-12-31");
    });

    it("returns empty string for null", () => {
      expect(dateFormats.iso(null)).toBe("");
    });
  });
});
