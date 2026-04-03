import { describe, it, expect, vi, beforeEach } from "vitest";
import { splitService } from "../splitService";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/modules/shared/utils/errorHandler", () => ({
  handleError: vi.fn(),
}));

describe("splitService", () => {
  it("throws when sum does not match transaction total", async () => {
    await expect(
      splitService.createSplits("clinic-1", "tx-1", 3000, [
        { amount: 1000, description: "Part A" },
        { amount: 500, description: "Part B" },
      ])
    ).rejects.toThrow("não corresponde ao valor da transação");
  });

  it("throws when fewer than 2 splits provided", async () => {
    await expect(
      splitService.createSplits("clinic-1", "tx-1", 1000, [
        { amount: 1000, description: "Only one" },
      ])
    ).rejects.toThrow("ao menos 2 splits");
  });

  it("accepts splits that sum to transaction total within tolerance", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const mockFrom = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    (supabase.from as any) = mockFrom;

    // Should not throw
    await expect(
      splitService.createSplits("clinic-1", "tx-1", 3000, [
        { amount: 1500, description: "Part A" },
        { amount: 1500, description: "Part B" },
      ])
    ).resolves.not.toThrow();
  });
});
