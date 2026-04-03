/**
 * Unit tests for shared/utils/currencyFormatters.
 */

import { describe, it, expect } from "vitest";
import {
  formatBRL,
  formatBRLCompact,
  parseCurrency,
  getCurrencySymbol,
  formatPercent,
} from "../currencyFormatters";

describe("formatBRL", () => {
  it("formats a positive integer as BRL", () => {
    expect(formatBRL(1250)).toBe("R$\u00a01.250,00");
  });

  it("formats a decimal value", () => {
    expect(formatBRL(99.9)).toBe("R$\u00a099,90");
  });

  it("formats zero", () => {
    expect(formatBRL(0)).toBe("R$\u00a00,00");
  });

  it("formats null as R$ 0,00", () => {
    expect(formatBRL(null)).toBe("R$\u00a00,00");
  });

  it("formats undefined as R$ 0,00", () => {
    expect(formatBRL(undefined)).toBe("R$\u00a00,00");
  });

  it("includes currency symbol R$", () => {
    expect(formatBRL(100)).toContain("R$");
  });
});

describe("formatBRLCompact", () => {
  it("returns a non-empty string", () => {
    expect(formatBRLCompact(1000000).length).toBeGreaterThan(0);
  });

  it("formats null as compact R$ 0", () => {
    expect(formatBRLCompact(null)).toContain("R$");
  });
});

describe("parseCurrency", () => {
  it("parses Brazilian formatted string", () => {
    expect(parseCurrency("1.250,50")).toBe(1250.5);
  });

  it("parses string with R$ symbol", () => {
    expect(parseCurrency("R$ 1.250,50")).toBe(1250.5);
  });

  it("parses plain decimal string", () => {
    expect(parseCurrency("1250.50")).toBe(1250.5);
  });

  it("parses integer string", () => {
    expect(parseCurrency("1000")).toBe(1000);
  });

  it("returns 0 for empty string", () => {
    expect(parseCurrency("")).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(parseCurrency(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(parseCurrency(undefined)).toBe(0);
  });

  it("passes through a numeric value unchanged", () => {
    expect(parseCurrency(99.9)).toBe(99.9);
  });

  it("returns 0 for non-numeric string", () => {
    expect(parseCurrency("abc")).toBe(0);
  });
});

describe("getCurrencySymbol", () => {
  it("returns 'R$'", () => {
    expect(getCurrencySymbol()).toBe("R$");
  });
});

describe("formatPercent", () => {
  it("formats a percentage value", () => {
    const result = formatPercent(12.5);
    expect(result).toContain("%");
  });

  it("formats 100 as 100%", () => {
    const result = formatPercent(100);
    expect(result).toContain("100");
    expect(result).toContain("%");
  });

  it("returns 0% for null", () => {
    expect(formatPercent(null)).toBe("0%");
  });
});
