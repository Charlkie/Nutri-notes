import { describe, expect, it } from "vitest";
import { isISODate, navigationHash, parseNavigationHash } from "./navigation";

describe("restorable navigation", () => {
  it("restores a primary screen and selected date", () => {
    expect(parseNavigationHash("#screen=calendar&date=2026-07-12", "2026-07-27")).toEqual({
      route: "calendar",
      date: "2026-07-12",
    });
  });

  it("falls back safely for editor routes and invalid dates", () => {
    expect(parseNavigationHash("#screen=entryForm&date=2026-02-30", "2026-07-27")).toEqual({
      route: "day",
      date: "2026-07-27",
    });
  });

  it("serializes a GitHub Pages-safe hash", () => {
    expect(navigationHash("charts", "2026-07-27")).toBe("#screen=charts&date=2026-07-27");
  });

  it("accepts only real calendar dates", () => {
    expect(isISODate("2024-02-29")).toBe(true);
    expect(isISODate("2025-02-29")).toBe(false);
    expect(isISODate("27-07-2026")).toBe(false);
  });
});
