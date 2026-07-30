import { describe, expect, it } from "vitest";
import { convertFoodQuantity, foodDensity, isLegacyServingUnit, unitForMode } from "./foodUnits";

describe("food units", () => {
  it("uses serving when switching a gram food to per serving", () => expect(unitForMode("perServing", "g")).toBe("serving"));
  it("keeps explicit serving units", () => expect(unitForMode("perServing", "scoop")).toBe("scoop"));
  it("only identifies the old one-unit serving bug", () => {
    expect(isLegacyServingUnit("perServing", 1, "g")).toBe(true);
    expect(isLegacyServingUnit("perServing", 30, "g")).toBe(false);
  });
  it("uses an Australian measure to convert liquid millilitres to nutrition grams",()=>{
    const milk={baseUnit:"g" as const,measures:[{id:"cup",label:"1 cup",quantity:1,grams:257.5,millilitres:250}]};
    expect(foodDensity(milk)).toBeCloseTo(1.03);
    expect(convertFoodQuantity(milk,100,"ml","g")).toBeCloseTo(103);
    expect(convertFoodQuantity(milk,103,"g","ml")).toBeCloseTo(100);
  });
});
