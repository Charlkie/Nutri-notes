import type { EnergyUnit } from "./types";

export const KJ_PER_KCAL = 4.184;

export function energyValue(calories: number, unit: EnergyUnit): number {
  const converted = unit === "kJ" ? calories * KJ_PER_KCAL : calories;
  return Math.round(converted);
}

export function energyText(calories: number, unit: EnergyUnit): string {
  return `${energyValue(calories, unit)} ${unit}`;
}
