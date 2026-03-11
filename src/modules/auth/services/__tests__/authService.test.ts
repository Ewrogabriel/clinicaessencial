import { describe, it, expect, vi, beforeEach } from "vitest";
import { authService } from "../authService";
import { supabase } from "@/integrations/supabase/client";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => {
    const mock = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        auth: {
            signOut: vi.fn(),
        },
    };
    return { supabase: mock };
});

describe("AuthService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default chain behavior
        vi.mocked(supabase.from).mockReturnValue(supabase as any);
        vi.mocked(supabase.select).mockReturnValue(supabase as any);
        vi.mocked(supabase.eq).mockReturnValue(supabase as any);
    });

    describe("getProfile", () => {
        it("should return profile data when successful", async () => {
            const mockProfile = { id: "1", nome: "Test User" };
            vi.mocked(supabase.single).mockResolvedValue({ data: mockProfile, error: null } as any);

            const result = await authService.getProfile("user-123");
            expect(result).toEqual(mockProfile);
            expect(supabase.from).toHaveBeenCalledWith("profiles");
        });

        it("should return null and handle error on failure", async () => {
            vi.mocked(supabase.single).mockResolvedValue({ data: null, error: { message: "Error" } } as any);

            const result = await authService.getProfile("user-123");
            expect(result).toBeNull();
        });
    });

    describe("getRoles", () => {
        it("should return an array of roles", async () => {
            const mockRoles = [{ role: "admin" }, { role: "profissional" }];
            // eq is the last call in authService.getRoles
            vi.mocked(supabase.eq).mockResolvedValue({ data: mockRoles, error: null } as any);

            const result = await authService.getRoles("user-123");
            expect(result).toEqual(["admin", "profissional"]);
            expect(supabase.from).toHaveBeenCalledWith("user_roles");
        });
    });
});
