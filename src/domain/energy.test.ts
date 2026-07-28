import { describe, expect, it } from "vitest";
import { energyText, energyValue } from "./energy";

describe("energy display", () => {
  it("keeps stored calories unchanged for kcal display", () => expect(energyValue(120, "kcal")).toBe(120));
  it("converts kcal to rounded kilojoules", () => expect(energyValue(120, "kJ")).toBe(502));
  it("includes the selected unit in display text", () => expect(energyText(100, "kJ")).toBe("418 kJ"));
});
