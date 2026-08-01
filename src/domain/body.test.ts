import { describe,expect,it } from "vitest";
import { aggregateWeightsByDay, displayWeight, weeklyWeightChange, weightChange, weightInputToKg, withSevenDayAverage } from "./body";
import type { WeightEntry } from "./types";
const weight=(date:string,weightKg:number):WeightEntry=>({id:date,date,weightKg});
describe("body weight calculations",()=>{it("calculates a trailing seven-calendar-day average",()=>{const points=withSevenDayAverage([weight("2026-07-01",80),weight("2026-07-05",78),weight("2026-07-08",76)]);expect(points[2]?.rollingAverageKg).toBe(77);expect(points[1]?.rollingAverageKg).toBe(79)});it("calculates overall change independent of input order",()=>expect(weightChange([weight("2026-07-08",78),weight("2026-07-01",80)])).toBe(-2))});
describe("weight units",()=>{it("converts kilograms to pounds for display",()=>expect(displayWeight(100,"lb")).toBeCloseTo(220.462,3));it("converts pound input back to canonical kilograms",()=>expect(weightInputToKg(220.46226218,"lb")).toBeCloseTo(100,6))});

describe("multiple daily weight readings", () => {
  it("calculates a daily average and min/max without discarding measurements", () => {
    const readings: WeightEntry[] = [
      { id: "morning", date: "2026-07-31", recordedAt: "2026-07-31T07:00:00", weightKg: 68.4 },
      { id: "evening", date: "2026-07-31", recordedAt: "2026-07-31T20:00:00", weightKg: 69.2 },
    ];
    const day = aggregateWeightsByDay(readings)[0];
    expect(day).toEqual(
      expect.objectContaining({ date: "2026-07-31", minKg: 68.4, maxKg: 69.2, count: 2 }),
    );
    expect(day?.averageKg).toBeCloseTo(68.8, 8);
  });

  it("uses daily averages rather than weighting days with more readings", () => {
    const readings: WeightEntry[] = [
      { id: "a", date: "2026-07-30", weightKg: 70 },
      { id: "b", date: "2026-07-30", weightKg: 72 },
      { id: "c", date: "2026-07-31", weightKg: 68 },
    ];
    expect(withSevenDayAverage(readings).at(-1)?.rollingAverageKg).toBe(69.5);
    expect(weightChange(readings)).toBe(-3);
  });
});

describe("weekly weight change", () => {
  it("computes a weekly rate of change from the trailing seven-day averages", () => {
    const readings = Array.from({ length: 14 }, (_, day) =>
      weight(`2026-07-${String(day + 1).padStart(2, "0")}`, 80 - day),
    );
    const rate = weeklyWeightChange(readings);
    expect(rate?.kgPerWeek).toBeCloseTo(-7, 8);
    expect(rate?.percentPerWeek).toBeCloseTo(-10, 8);
  });

  it("withholds a rate until entries span enough days to avoid noisy extrapolation", () => {
    const readings = [weight("2026-07-01", 80), weight("2026-07-02", 79.5)];
    expect(weeklyWeightChange(readings)).toBeUndefined();
  });

  it("returns undefined with fewer than two data points", () => {
    expect(weeklyWeightChange([weight("2026-07-01", 80)])).toBeUndefined();
  });
});
