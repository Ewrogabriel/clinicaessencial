/**
 * Unit tests for shared/utils/errorHandler.
 *
 * Covers:
 * - AppError class (constructor, name, message, code, originalError, instanceof)
 * - handleError function (message resolution priority, code propagation, return type)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, handleError } from "../errorHandler";

// ── Mock sonner (toast library) ───────────────────────────────────────────────

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
    },
}));

const getToast = async () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((await import("sonner")) as any).toast;

// ── AppError tests ────────────────────────────────────────────────────────────

describe("AppError", () => {
    it("sets name to 'AppError'", () => {
        const err = new AppError("test error");
        expect(err.name).toBe("AppError");
    });

    it("sets message correctly", () => {
        const err = new AppError("something went wrong");
        expect(err.message).toBe("something went wrong");
    });

    it("sets optional code when provided", () => {
        const err = new AppError("msg", "ERR_CODE");
        expect(err.code).toBe("ERR_CODE");
    });

    it("code is undefined when not provided", () => {
        const err = new AppError("msg");
        expect(err.code).toBeUndefined();
    });

    it("stores originalError reference", () => {
        const original = new Error("root cause");
        const err = new AppError("wrapped", "E1", original);
        expect(err.originalError).toBe(original);
    });

    it("is an instance of Error", () => {
        const err = new AppError("msg");
        expect(err).toBeInstanceOf(Error);
    });

    it("is an instance of AppError", () => {
        const err = new AppError("msg");
        expect(err).toBeInstanceOf(AppError);
    });
});

// ── handleError tests ─────────────────────────────────────────────────────────

describe("handleError", () => {
    let toast: Awaited<ReturnType<typeof getToast>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        toast = await getToast();
    });

    it("returns an AppError instance", () => {
        const result = handleError(new Error("boom"), "Custom message");
        expect(result).toBeInstanceOf(AppError);
    });

    it("uses Error.message even when customMessage is provided (Error branch overrides)", () => {
        const result = handleError(new Error("original"), "Custom message");
        expect(result.message).toBe("original");
        expect(toast.error).toHaveBeenCalledWith("original", expect.any(Object));
    });

    it("uses the AppError's own message (ignores customMessage)", () => {
        const appErr = new AppError("AppError message");
        const result = handleError(appErr, "Custom message");
        expect(result.message).toBe("AppError message");
        expect(toast.error).toHaveBeenCalledWith("AppError message", expect.any(Object));
    });

    it("uses the Error.message when no customMessage", () => {
        const result = handleError(new Error("native error message"));
        expect(result.message).toBe("native error message");
    });

    it("uses default fallback message when error is a non-Error value", () => {
        const result = handleError("some string error");
        expect(result.message).toBe("Ocorreu um erro inesperado.");
    });

    it("falls back to default message when error is null", () => {
        const result = handleError(null);
        expect(result.message).toBe("Ocorreu um erro inesperado.");
    });

    it("propagates error code when the error object has a code property", () => {
        const errWithCode = Object.assign(new Error("db error"), { code: "PGRST116" });
        const result = handleError(errWithCode, "Database error");
        expect(result.code).toBe("PGRST116");
        // Error.message wins over customMessage; code is exposed as description
        expect(toast.error).toHaveBeenCalledWith(
            "db error",
            { description: "Código: PGRST116" }
        );
    });

    it("passes description: undefined when there is no code", () => {
        handleError(new Error("no code"));
        expect(toast.error).toHaveBeenCalledWith(
            "no code",
            { description: undefined }
        );
    });

    it("calls console.error once per invocation", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        handleError(new Error("test"), "test");
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it("translates 'Failed to fetch' network error to Portuguese", () => {
        const result = handleError(new Error("Failed to fetch"));
        expect(result.message).toBe(
            "Erro de conexão com o servidor. Verifique sua conexão com a internet e tente novamente."
        );
        expect(toast.error).toHaveBeenCalledWith(
            "Erro de conexão com o servidor. Verifique sua conexão com a internet e tente novamente.",
            expect.any(Object)
        );
    });

    it("translates Firefox 'NetworkError when attempting to fetch resource.' to Portuguese", () => {
        const result = handleError(new Error("NetworkError when attempting to fetch resource."));
        expect(result.message).toBe(
            "Erro de conexão com o servidor. Verifique sua conexão com a internet e tente novamente."
        );
    });
});
