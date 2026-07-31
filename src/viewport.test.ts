import { describe, expect, it } from "vitest";
import { clampSafeBottom, standaloneViewportBottomGap } from "./viewport";

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

describe("standalone viewport positioning", () => {
  it("moves the dock through an iOS standalone bottom gap", () => {
    expect(standaloneViewportBottomGap(852, 770, 0, true)).toBe(82);
  });

  it("does not move the dock in a normal browser tab", () => {
    expect(standaloneViewportBottomGap(852, 770, 0, false)).toBe(0);
  });

  it("caps malformed viewport gaps", () => {
    expect(standaloneViewportBottomGap(852, 400, 0, true)).toBe(140);
  });
});
