import type { CalculationMode, FoodUnit } from "./types";

export const per100Units: FoodUnit[] = ["g", "ml"];
export const servingUnits: FoodUnit[] = ["serving", "slice", "item", "scoop"];

export function unitForMode(mode: CalculationMode, unit: FoodUnit): FoodUnit {
  if (mode === "per100") return per100Units.includes(unit) ? unit : "g";
  return servingUnits.includes(unit) ? unit : "serving";
}

export function isLegacyServingUnit(mode: CalculationMode, baseQuantity: number, unit: FoodUnit): boolean {
  return mode === "perServing" && baseQuantity === 1 && (unit === "g" || unit === "ml");
}
