import { describe, expect, it } from "vitest";
import { clampSafeBottom } from "./viewport";

describe("safe-area measurement", () => {
  it("preserves a normal iPhone portrait inset", () => {
    expect(clampSafeBottom(34)).toBe(34);
  });

  it("prevents a transient startup inset from stretching the navigation", () => {
    expect(clampSafeBottom(120)).toBe(34);
  });

  it("rejects invalid and negative measurements", () => {
    expect(clampSafeBottom(Number.NaN)).toBe(0);
    expect(clampSafeBottom(-18)).toBe(0);
  });
});
