import { describe,expect,it } from "vitest";
import { displayWeight, weightChange, weightInputToKg, withSevenDayAverage } from "./body";
import type { WeightEntry } from "./types";
const weight=(date:string,weightKg:number):WeightEntry=>({id:date,date,weightKg});
describe("body weight calculations",()=>{it("calculates a trailing seven-calendar-day average",()=>{const points=withSevenDayAverage([weight("2026-07-01",80),weight("2026-07-05",78),weight("2026-07-08",76)]);expect(points[2]?.rollingAverageKg).toBe(77);expect(points[1]?.rollingAverageKg).toBe(79)});it("calculates overall change independent of input order",()=>expect(weightChange([weight("2026-07-08",78),weight("2026-07-01",80)])).toBe(-2))});
describe("weight units",()=>{it("converts kilograms to pounds for display",()=>expect(displayWeight(100,"lb")).toBeCloseTo(220.462,3));it("converts pound input back to canonical kilograms",()=>expect(weightInputToKg(220.46226218,"lb")).toBeCloseTo(100,6))});
