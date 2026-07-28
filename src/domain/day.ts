import type { DayFoodEntry, DayLog, Food, ISODate } from "./types";
import { createSnapshot } from "./nutrition";
import { createId } from "./id";

const uid = createId;
export function copyDayData(sourceEntries: DayFoodEntry[], targetDate: ISODate, now = new Date().toISOString(), preserveConsumed=false): { day: DayLog; entries: DayFoodEntry[] } {
  const dayId = uid();
  const day: DayLog = { id: dayId, date: targetDate, createdAt: now, updatedAt: now };
  const entries = [...sourceEntries].sort((a, b) => a.sortIndex - b.sortIndex).map((entry, index) => ({ ...entry, id: uid(), dayId, snapshot: { ...entry.snapshot }, recipe:entry.recipe?structuredClone(entry.recipe):undefined,sortIndex: index, consumed: preserveConsumed?entry.consumed:false, createdAt: now, updatedAt: now }));
  return { day, entries };
}

export function replaceEntryFood(entry: DayFoodEntry, food: Food, quantity: number, now = new Date().toISOString()): DayFoodEntry {
  return { ...entry, snapshot: createSnapshot(food, quantity), updatedAt: now };
}

export function transferEntryData(entry: DayFoodEntry, targetDayId: string, targetSortIndex: number, mode: "move" | "copy", now = new Date().toISOString()): DayFoodEntry {
  return {
    ...entry,
    id: mode === "copy" ? uid() : entry.id,
    dayId: targetDayId,
    snapshot: { ...entry.snapshot },recipe:entry.recipe?structuredClone(entry.recipe):undefined,
    sortIndex: targetSortIndex,
    consumed: mode === "copy" ? false : entry.consumed,
    createdAt: mode === "copy" ? now : entry.createdAt,
    updatedAt: now,
  };
}
