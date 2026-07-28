import type { DayFoodEntry, DayLog, DietTemplate, ID, ISODate, TemplateItem } from "./types";
import { createId } from "./id";

const uid = (): ID => createId();

export function templateFromDay(name: string, entries: DayFoodEntry[], now = new Date().toISOString()): DietTemplate {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Template name is required");
  const items: TemplateItem[] = [...entries].sort((a,b)=>a.sortIndex-b.sortIndex).map((entry,index)=>({id:uid(),foodId:entry.snapshot.foodId,snapshot:{...entry.snapshot},recipe:entry.recipe?structuredClone(entry.recipe):undefined,sortIndex:index,categoryId:entry.snapshot.categoryId}));
  return { id:uid(), name:trimmed, items, createdAt:now, updatedAt:now };
}

export function applyTemplateData(template: DietTemplate, date: ISODate, now = new Date().toISOString()): {day:DayLog;entries:DayFoodEntry[]} {
  const dayId=uid();
  return { day:{id:dayId,date,createdAt:now,updatedAt:now}, entries:[...template.items].sort((a,b)=>a.sortIndex-b.sortIndex).map((item,index)=>({id:uid(),dayId,snapshot:{...item.snapshot},recipe:item.recipe?structuredClone(item.recipe):undefined,sortIndex:index,consumed:false,createdAt:now,updatedAt:now})) };
}

export function scheduledTemplateDates(start: ISODate, weeks: number, weekdays: number[]): ISODate[] {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw new Error("Duration must be between 1 and 52 weeks");
  const selected = new Set(weekdays);
  if (!weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Choose at least one weekday");
  const cursor = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime())) throw new Error("Choose a valid start date");
  const dates: ISODate[] = [];
  for (let offset = 0; offset < weeks * 7; offset += 1) {
    const date = new Date(cursor);
    date.setUTCDate(cursor.getUTCDate() + offset);
    if (selected.has(date.getUTCDay())) dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}
