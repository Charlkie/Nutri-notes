import { describe, expect, it } from "vitest";
import { caloriesFromEnergy, energyInputValue, energyText, energyValue } from "./energy";

describe("energy display", () => {
  it("keeps stored calories unchanged for kcal display", () => expect(energyValue(120, "kcal")).toBe(120));
  it("converts kcal to rounded kilojoules", () => expect(energyValue(120, "kJ")).toBe(502));
  it("includes the selected unit in display text", () => expect(energyText(100, "kJ")).toBe("418 kJ"));
  it("converts kilojoule food input back to canonical calories", () => expect(caloriesFromEnergy(418.4, "kJ")).toBeCloseTo(100));
  it("round-trips editable energy without meaningful drift", () => expect(caloriesFromEnergy(energyInputValue(123.45, "kJ"), "kJ")).toBeCloseTo(123.45, 3));
});
