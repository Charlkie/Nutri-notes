import type { CalculationMode, Food, FoodUnit } from "./types";

export const per100Units: FoodUnit[] = ["g", "ml"];
export const servingUnits: FoodUnit[] = ["serving", "slice", "item", "scoop"];

export function unitForMode(mode: CalculationMode, unit: FoodUnit): FoodUnit {
  if (mode === "per100") return per100Units.includes(unit) ? unit : "g";
  return servingUnits.includes(unit) ? unit : "serving";
}

export function isLegacyServingUnit(mode: CalculationMode, baseQuantity: number, unit: FoodUnit): boolean {
  return mode === "perServing" && baseQuantity === 1 && (unit === "g" || unit === "ml");
}

export function foodDensity(food: Pick<Food, "baseUnit" | "measures">): number | undefined {
  if (food.baseUnit !== "g" && food.baseUnit !== "ml") return undefined;
  const measures = food.measures?.filter(measure =>
    Number.isFinite(measure.grams) && measure.grams > 0 &&
    Number.isFinite(measure.millilitres) && measure.millilitres! > 0,
  );
  if (!measures?.length) return food.baseUnit === "ml" ? 1 : undefined;
  const grams = measures.reduce((total, measure) => total + measure.grams, 0);
  const millilitres = measures.reduce((total, measure) => total + measure.millilitres!, 0);
  return grams / millilitres;
}

export function supportsVolumeUnit(food: Pick<Food, "baseUnit" | "measures">): boolean {
  return food.baseUnit === "ml" || foodDensity(food) !== undefined;
}

export function convertFoodQuantity(food: Pick<Food, "baseUnit" | "measures">, quantity: number, from: FoodUnit, to: FoodUnit): number {
  if (from === to) return quantity;
  const density = foodDensity(food);
  if (!density || !((from === "g" && to === "ml") || (from === "ml" && to === "g")))
    throw new Error(`Cannot convert ${from} to ${to} without a volume measure`);
  return from === "ml" ? quantity * density : quantity / density;
}
