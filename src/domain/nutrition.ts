import type { DayFoodEntry, DayTotals, Food, FoodSnapshot, Nutrients } from "./types";

export const emptyNutrients = (): Nutrients => ({ calories: 0, protein: 0, carbohydrates: 0, fat: 0, fibre: 0 });
const nutrientKeys = ["calories", "protein", "carbohydrates", "fat", "fibre"] as const;

export function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a valid non-negative number`);
}

export function calculateNutrients(food: Food, quantity: number): Nutrients {
  assertNonNegative(quantity, "Quantity");
  const factor = food.calculationMode === "per100" ? quantity / 100 : quantity / food.baseQuantity;
  return {
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbohydrates: food.carbohydrates * factor,
    fat: food.fat * factor,
    fibre: food.fibre === undefined ? undefined : food.fibre * factor,
  };
}

export function createSnapshot(food: Food, quantity: number): FoodSnapshot {
  return { foodId: food.id, name: food.name, brand: food.brand, categoryId: food.categoryId, quantity, unit: food.baseUnit, calculationMode: food.calculationMode, baseQuantity: food.baseQuantity, ...calculateNutrients(food, quantity) };
}

export function resizeSnapshot(snapshot:FoodSnapshot,quantity:number):FoodSnapshot {
  assertNonNegative(quantity,"Quantity");
  const factor=quantity/snapshot.quantity;
  return {...snapshot,quantity,calories:snapshot.calories*factor,protein:snapshot.protein*factor,carbohydrates:snapshot.carbohydrates*factor,fat:snapshot.fat*factor,fibre:snapshot.fibre===undefined?undefined:snapshot.fibre*factor};
}

export function sumEntries(entries: DayFoodEntry[]): DayTotals {
  const planned = emptyNutrients(); const consumed = emptyNutrients();
  for (const entry of entries) for (const key of nutrientKeys) {
    const value = entry.snapshot[key] ?? 0;
    planned[key] = (planned[key] ?? 0) + value;
    if (entry.consumed) consumed[key] = (consumed[key] ?? 0) + value;
  }
  return { planned, consumed };
}

export const roundCalories = (value: number) => Math.round(value);
export const roundMacro = (value: number) => Math.round(value * 10) / 10;
