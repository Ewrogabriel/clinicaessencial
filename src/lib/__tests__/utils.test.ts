import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn (classnames merge)", () => {
  it("should merge simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });
  it("should handle conditional classes", () => {
    const condition = false;
    expect(cn("base", condition && "hidden", "visible")).toBe("base visible");
  });
  it("should merge conflicting tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
  it("should handle undefined and null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });
  it("should return empty string for no args", () => {
    expect(cn()).toBe("");
  });
});
