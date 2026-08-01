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

export interface WeeklyWeightChange {
  kgPerWeek: number;
  percentPerWeek: number;
}

export interface WeeklyRatePoint extends WeeklyWeightChange {
  date: string;
}

/** How far back to look for the comparison point when deriving a rate; "all" reaches back to the first entry. */
export type RateSpan = 7 | 14 | 28 | "all";

const minRateSpanDays = 3;

function priorPointForSpan(points: WeightPoint[], index: number, span: RateSpan): WeightPoint {
  const referenceTime = dateMs(points[index]!.date);
  const targetTime = span === "all" ? -Infinity : referenceTime - span * dayMs;
  for (let i = index - 1; i >= 0; i--) {
    if (dateMs(points[i]!.date) <= targetTime) return points[i]!;
  }
  return points[0]!;
}

function rateAtIndex(points: WeightPoint[], index: number, span: RateSpan): WeeklyWeightChange | undefined {
  if (index < 1) return undefined;
  const point = points[index]!;
  const prior = priorPointForSpan(points, index, span);
  const elapsedDays = (dateMs(point.date) - dateMs(prior.date)) / dayMs;
  if (elapsedDays < minRateSpanDays) return undefined;
  const kgPerWeek = ((point.rollingAverageKg - prior.rollingAverageKg) / elapsedDays) * 7;
  const percentPerWeek = (kgPerWeek / point.rollingAverageKg) * 100;
  return { kgPerWeek, percentPerWeek };
}

/**
 * Rate of change extrapolated to a per-week figure from the trailing
 * seven-day rolling averages, so a couple of noisy days don't swing it.
 * Compares the latest point against the closest one at least `span` days
 * earlier (or the very first entry once `span` reaches past the history),
 * and withholds a result until the compared points are at least
 * minRateSpanDays apart, to avoid amplifying single-day noise into a wild
 * weekly extrapolation.
 */
export function weeklyWeightChange(entries: WeightEntry[], span: RateSpan = 7): WeeklyWeightChange | undefined {
  const points = withSevenDayAverage(entries);
  if (!points.length) return undefined;
  return rateAtIndex(points, points.length - 1, span);
}

/** The same weekly rate as weeklyWeightChange, computed as of every day that has enough prior history, for plotting. */
export function weeklyRateSeries(entries: WeightEntry[], span: RateSpan = 7): WeeklyRatePoint[] {
  const points = withSevenDayAverage(entries);
  const series: WeeklyRatePoint[] = [];
  points.forEach((point, index) => {
    const rate = rateAtIndex(points, index, span);
    if (rate) series.push({ date: point.date, ...rate });
  });
  return series;
}

const poundsPerKilogram = 2.2046226218;
export const displayWeight = (kilograms: number, unit: WeightUnit): number =>
  unit === "lb" ? kilograms * poundsPerKilogram : kilograms;
export const weightInputToKg = (value: number, unit: WeightUnit): number =>
  unit === "lb" ? value / poundsPerKilogram : value;
