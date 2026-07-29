import type { FoodUnit } from "./types";

export function foodUnitLabel(quantity: number, unit: FoodUnit): string {
  if (unit === "g") return "g";
  if (unit === "ml") return "mL";
  if (unit === "serving") return quantity === 1 ? "serve" : "serves";
  if (quantity === 1) return unit;
  return `${unit}s`;
}

export function formatFoodQuantity(quantity: number, unit: FoodUnit): string {
  return `${quantity} ${foodUnitLabel(quantity, unit)}`;
}
