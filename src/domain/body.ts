import type { WeightEntry, WeightUnit } from "./types";

const dayMs = 86_400_000;
const dateMs = (date: string) => new Date(`${date}T12:00:00`).getTime();
const entryTime = (entry: WeightEntry) =>
  entry.recordedAt ?? `${entry.date}T12:00:00`;

export interface DailyWeight {
  id: string;
  date: string;
  recordedAt: string;
  weightKg: number;
  averageKg: number;
  minKg: number;
  maxKg: number;
  count: number;
}

export interface WeightPoint extends DailyWeight {
  rollingAverageKg: number;
}

/** Collapses timestamped readings into one statistical point per calendar day. */
export function aggregateWeightsByDay(entries: WeightEntry[]): DailyWeight[] {
  const groups = new Map<string, WeightEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.date) ?? [];
    group.push(entry);
    groups.set(entry.date, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, group]) => {
      const ordered = [...group].sort((a, b) =>
        entryTime(a).localeCompare(entryTime(b)),
      );
      const values = ordered.map((entry) => entry.weightKg);
      const averageKg = values.reduce((sum, value) => sum + value, 0) / values.length;
      return {
        id: date,
        date,
        recordedAt: entryTime(ordered.at(-1)!),
        weightKg: averageKg,
        averageKg,
        minKg: Math.min(...values),
        maxKg: Math.max(...values),
        count: values.length,
      };
    });
}

export function withSevenDayAverage(entries: WeightEntry[]): WeightPoint[] {
  const daily = aggregateWeightsByDay(entries);
  return daily.map((entry) => {
    const end = dateMs(entry.date);
    const start = end - 6 * dayMs;
    const window = daily.filter((candidate) => {
      const time = dateMs(candidate.date);
      return time >= start && time <= end;
    });
    return {
      ...entry,
      rollingAverageKg:
        window.reduce((sum, item) => sum + item.averageKg, 0) / window.length,
    };
  });
}

export function weightChange(entries: WeightEntry[]): number | undefined {
  const daily = aggregateWeightsByDay(entries);
  if (daily.length < 2) return undefined;
  return daily.at(-1)!.averageKg - daily[0]!.averageKg;
}

const poundsPerKilogram = 2.2046226218;
export const displayWeight = (kilograms: number, unit: WeightUnit): number =>
  unit === "lb" ? kilograms * poundsPerKilogram : kilograms;
export const weightInputToKg = (value: number, unit: WeightUnit): number =>
  unit === "lb" ? value / poundsPerKilogram : value;
