import { describe, it, expect, vi } from "vitest";

describe("Utility Functions", () => {
  describe("Date Formatting", () => {
    it("should format dates correctly for Brazilian locale", () => {
      const date = new Date("2024-01-15T10:30:00");
      // Using standard date formatting
      const formatted = date.toLocaleDateString("pt-BR");
      expect(formatted).toContain("15");
      expect(formatted.includes("01") || formatted.includes("1")).toBe(true);
    });

    it("should handle timezone differences", () => {
      const date = new Date("2024-06-15T00:00:00Z");
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCMonth()).toBe(5); // June is month 5 (0-indexed)
    });
  });

  describe("Currency Formatting", () => {
    it("should format Brazilian Real correctly", () => {
      const value = 1500.50;
      const formatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
      
      expect(formatted).toContain("1.500,50") || expect(formatted).toContain("1500,50");
      expect(formatted).toContain("R$");
    });

    it("should handle zero values", () => {
      const value = 0;
      const formatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
      
      expect(formatted).toContain("0,00") || expect(formatted).toContain("0");
    });
  });

  describe("CPF Validation", () => {
    it("should identify valid CPF format", () => {
      const cpf = "123.456.789-01";
      const digits = cpf.replace(/\D/g, "");
      expect(digits.length).toBe(11);
    });

    it("should extract only digits from CPF", () => {
      const cpf = "123.456.789-01";
      const digits = cpf.replace(/\D/g, "");
      expect(digits).toBe("12345678901");
    });
  });

  describe("Phone Formatting", () => {
    it("should extract digits from phone number", () => {
      const phone = "(11) 99999-9999";
      const digits = phone.replace(/\D/g, "");
      expect(digits).toBe("11999999999");
    });

    it("should handle international format", () => {
      const phone = "+55 (11) 99999-9999";
      const digits = phone.replace(/\D/g, "");
      expect(digits).toBe("5511999999999");
    });
  });

  describe("Email Validation Pattern", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it("should validate correct email format", () => {
      expect(emailRegex.test("user@example.com")).toBe(true);
      expect(emailRegex.test("user.name@example.com")).toBe(true);
      expect(emailRegex.test("user+tag@example.co.uk")).toBe(true);
    });

    it("should reject invalid email format", () => {
      expect(emailRegex.test("invalid")).toBe(false);
      expect(emailRegex.test("invalid@")).toBe(false);
      expect(emailRegex.test("@invalid.com")).toBe(false);
    });
  });

  describe("Password Strength", () => {
    it("should check minimum length", () => {
      const minLength = 6;
      expect("abc123".length >= minLength).toBe(true);
      expect("abc".length >= minLength).toBe(false);
    });

    it("should check for mixed characters", () => {
      const hasNumber = /\d/.test("password1");
      const hasLetter = /[a-zA-Z]/.test("password1");
      expect(hasNumber && hasLetter).toBe(true);
    });
  });

  describe("String Utilities", () => {
    it("should capitalize first letter", () => {
      const capitalize = (str: string) => 
        str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      
      expect(capitalize("hello")).toBe("Hello");
      expect(capitalize("HELLO")).toBe("Hello");
    });

    it("should truncate long strings", () => {
      const truncate = (str: string, maxLength: number) =>
        str.length > maxLength ? str.slice(0, maxLength) + "..." : str;
      
      expect(truncate("Hello World", 5)).toBe("Hello...");
      expect(truncate("Hi", 5)).toBe("Hi");
    });

    it("should generate slug from string", () => {
      const slugify = (str: string) =>
        str
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
      
      expect(slugify("Hello World")).toBe("hello-world");
      expect(slugify("Olá Mundo!")).toBe("ol-mundo");
    });
  });

  describe("Array Utilities", () => {
    it("should remove duplicates", () => {
      const arr = [1, 2, 2, 3, 3, 3];
      const unique = [...new Set(arr)];
      expect(unique).toEqual([1, 2, 3]);
    });

    it("should group by property", () => {
      const items = [
        { type: "a", value: 1 },
        { type: "b", value: 2 },
        { type: "a", value: 3 },
      ];
      
      const grouped = items.reduce((acc, item) => {
        if (!acc[item.type]) acc[item.type] = [];
        acc[item.type].push(item);
        return acc;
      }, {} as Record<string, typeof items>);
      
      expect(grouped["a"].length).toBe(2);
      expect(grouped["b"].length).toBe(1);
    });

    it("should sort by property", () => {
      const items = [
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 25 },
        { name: "Bob", age: 35 },
      ];
      
      const sorted = [...items].sort((a, b) => a.age - b.age);
      expect(sorted[0].name).toBe("Alice");
      expect(sorted[2].name).toBe("Bob");
    });
  });
});

describe("LocalStorage Mock", () => {
  it("should handle storage operations", () => {
    const storage: Record<string, string> = {};
    
    const mockStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
    };

    mockStorage.setItem("test", "value");
    expect(mockStorage.getItem("test")).toBe("value");
    
    mockStorage.removeItem("test");
    expect(mockStorage.getItem("test")).toBeNull();
  });
});

describe("URL Utilities", () => {
  it("should parse query parameters", () => {
    const url = new URL("https://example.com?name=John&age=30");
    expect(url.searchParams.get("name")).toBe("John");
    expect(url.searchParams.get("age")).toBe("30");
  });

  it("should build query string", () => {
    const params = new URLSearchParams({ name: "John", age: "30" });
    expect(params.toString()).toBe("name=John&age=30");
  });
});
