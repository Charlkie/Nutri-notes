import { describe, expect, it } from "vitest";
import { applyTemplateData, scheduledTemplateDates, templateFromDay } from "./templates";
import type { DayFoodEntry } from "./types";

const entry:DayFoodEntry={id:"entry",dayId:"day",snapshot:{foodId:"oats",name:"Oats",categoryId:"breakfast",quantity:45,unit:"g",calculationMode:"per100",baseQuantity:100,calories:171,protein:5.8,carbohydrates:30,fat:3.1},sortIndex:3,consumed:true,note:"old note",createdAt:"old",updatedAt:"old"};
describe("templates",()=>{
  it("converts a day into an independent template snapshot",()=>{const template=templateFromDay("Cutting Day",[entry],"now");expect(template.items[0]?.sortIndex).toBe(0);template.items[0]!.snapshot.quantity=60;expect(entry.snapshot.quantity).toBe(45)});
  it("applies independent, unconsumed day entries",()=>{const template=templateFromDay("Cutting Day",[entry],"now");const applied=applyTemplateData(template,"2026-07-27","later");expect(applied.entries[0]).toMatchObject({dayId:applied.day.id,sortIndex:0,consumed:false});applied.entries[0]!.snapshot.quantity=80;expect(template.items[0]?.snapshot.quantity).toBe(45)});
});

describe("template schedules", () => {
  it("creates six Monday-to-Friday weeks from the chosen start date", () => {
    const dates = scheduledTemplateDates("2026-07-27", 6, [1, 2, 3, 4, 5]);
    expect(dates).toHaveLength(30);
    expect(dates.slice(0, 5)).toEqual(["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"]);
    expect(dates.at(-1)).toBe("2026-09-04");
  });

  it("supports a schedule that starts part-way through a week", () => {
    expect(scheduledTemplateDates("2026-07-29", 1, [1, 3, 5])).toEqual(["2026-07-29", "2026-07-31", "2026-08-03"]);
  });

  it("requires a bounded duration and at least one day", () => {
    expect(() => scheduledTemplateDates("2026-07-27", 0, [1])).toThrow("between 1 and 52");
    expect(() => scheduledTemplateDates("2026-07-27", 6, [])).toThrow("at least one weekday");
  });
});
