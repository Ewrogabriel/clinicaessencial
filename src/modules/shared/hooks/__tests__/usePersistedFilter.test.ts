import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedFilter } from "../usePersistedFilter";

describe("usePersistedFilter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should return default value when no stored value", () => {
    const { result } = renderHook(() => usePersistedFilter("test-key", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("should persist value in localStorage", () => {
    const { result } = renderHook(() => usePersistedFilter("test-key", "default"));
    act(() => {
      result.current[1]("default"); // same type
    });
    expect(result.current[0]).toBe("default");
  });

  it("should read persisted value on mount", () => {
    localStorage.setItem("filter:persist-key", "stored");
    const { result } = renderHook(() => usePersistedFilter("persist-key", "default"));
    expect(result.current[0]).toBe("stored");
  });
});
