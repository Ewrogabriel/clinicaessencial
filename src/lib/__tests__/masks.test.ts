import { describe, it, expect } from "vitest";
import { maskCPF, maskPhone, maskCEP, maskRG, maskCNPJ, unmask, isValidCPF } from "../masks";

describe("maskCPF", () => {
  it("should format a full CPF", () => {
    expect(maskCPF("12345678901")).toBe("123.456.789-01");
  });
  it("should handle partial input", () => {
    expect(maskCPF("123")).toBe("123");
    expect(maskCPF("1234")).toBe("123.4");
    expect(maskCPF("1234567")).toBe("123.456.7");
  });
  it("should strip non-digit characters", () => {
    expect(maskCPF("123.456.789-01")).toBe("123.456.789-01");
  });
  it("should limit to 11 digits", () => {
    expect(maskCPF("123456789012345")).toBe("123.456.789-01");
  });
});

describe("maskPhone", () => {
  it("should format a landline (10 digits)", () => {
    expect(maskPhone("1133334444")).toBe("(11) 3333-4444");
  });
  it("should format a mobile (11 digits)", () => {
    expect(maskPhone("11999998888")).toBe("(11) 99999-8888");
  });
  it("should handle partial input", () => {
    expect(maskPhone("11")).toBe("11");
    expect(maskPhone("119")).toBe("(11) 9");
  });
});

describe("maskCEP", () => {
  it("should format a CEP", () => {
    expect(maskCEP("01001000")).toBe("01001-000");
  });
  it("should handle partial input", () => {
    expect(maskCEP("010")).toBe("010");
  });
});

describe("maskRG", () => {
  it("should format a full RG", () => {
    expect(maskRG("123456789")).toBe("12.345.678-9");
  });
});

describe("maskCNPJ", () => {
  it("should format a full CNPJ", () => {
    expect(maskCNPJ("12345678000199")).toBe("12.345.678/0001-99");
  });
  it("should handle partial input", () => {
    expect(maskCNPJ("12345")).toBe("12.345");
  });
});

describe("unmask", () => {
  it("should remove all non-digit characters", () => {
    expect(unmask("123.456.789-01")).toBe("12345678901");
    expect(unmask("(11) 99999-8888")).toBe("11999998888");
    expect(unmask("abc123")).toBe("123");
  });
  it("should return empty string for no digits", () => {
    expect(unmask("abc")).toBe("");
  });
});

describe("isValidCPF", () => {
  it("should validate a correct CPF", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("52998224725")).toBe(true);
  });
  it("should reject all-same-digit CPFs", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("000.000.000-00")).toBe(false);
  });
  it("should reject CPFs with wrong length", () => {
    expect(isValidCPF("123")).toBe(false);
    expect(isValidCPF("")).toBe(false);
  });
  it("should reject invalid CPFs", () => {
    expect(isValidCPF("123.456.789-00")).toBe(false);
    expect(isValidCPF("12345678900")).toBe(false);
  });
});
