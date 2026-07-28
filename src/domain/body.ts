import type { WeightEntry, WeightUnit } from "./types";

const dayMs=86_400_000;
const dateMs=(date:string)=>new Date(`${date}T12:00:00`).getTime();

export interface WeightPoint extends WeightEntry { rollingAverageKg:number }

export function withSevenDayAverage(entries:WeightEntry[]):WeightPoint[] {
  const ordered=[...entries].sort((a,b)=>a.date.localeCompare(b.date));
  return ordered.map(entry=>{const end=dateMs(entry.date);const start=end-6*dayMs;const window=ordered.filter(candidate=>{const time=dateMs(candidate.date);return time>=start&&time<=end});return {...entry,rollingAverageKg:window.reduce((sum,item)=>sum+item.weightKg,0)/window.length}});
}

export function weightChange(entries:WeightEntry[]):number|undefined {
  const ordered=[...entries].sort((a,b)=>a.date.localeCompare(b.date));if(ordered.length<2)return undefined;return ordered.at(-1)!.weightKg-ordered[0]!.weightKg;
}

const poundsPerKilogram = 2.2046226218;
export const displayWeight = (kilograms:number, unit:WeightUnit):number => unit === "lb" ? kilograms * poundsPerKilogram : kilograms;
export const weightInputToKg = (value:number, unit:WeightUnit):number => unit === "lb" ? value / poundsPerKilogram : value;
