import { describe, expect, it } from "vitest";
import { isLegacyServingUnit, unitForMode } from "./foodUnits";

describe("food units", () => {
  it("uses serving when switching a gram food to per serving", () => expect(unitForMode("perServing", "g")).toBe("serving"));
  it("keeps explicit serving units", () => expect(unitForMode("perServing", "scoop")).toBe("scoop"));
  it("only identifies the old one-unit serving bug", () => {
    expect(isLegacyServingUnit("perServing", 1, "g")).toBe(true);
    expect(isLegacyServingUnit("perServing", 30, "g")).toBe(false);
  });
});
