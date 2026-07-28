import { describe, expect, it } from "vitest";
import { createSnapshot, calculateNutrients, resizeSnapshot, sumEntries } from "./nutrition";
import type { DayFoodEntry, Food } from "./types";

const food = (overrides: Partial<Food> = {}): Food => ({ id:"food-1", name:"Test food", categoryId:"other", calculationMode:"perServing", baseQuantity:1, baseUnit:"serving", calories:200, protein:20, carbohydrates:10, fat:5, logCount:0, createdAt:"2026-01-01", updatedAt:"2026-01-01", ...overrides });
const entry = (snapshot: ReturnType<typeof createSnapshot>, consumed: boolean): DayFoodEntry => ({ id:crypto.randomUUID(), dayId:"day", snapshot, sortIndex:0, consumed, createdAt:"2026-01-01", updatedAt:"2026-01-01" });

describe("nutrition calculations", () => {
  it("calculates per-serving nutrition", () => expect(calculateNutrients(food(),2.5)).toMatchObject({ calories:500, protein:50, carbohydrates:25, fat:12.5 }));
  it("calculates per-100-g nutrition", () => { const result=calculateNutrients(food({calculationMode:"per100",baseQuantity:100,baseUnit:"g",calories:380,protein:13}),45); expect(result.calories).toBe(171); expect(result.protein).toBeCloseTo(5.85); expect(result.carbohydrates).toBeCloseTo(4.5); expect(result.fat).toBeCloseTo(2.25); });
  it("separates planned and consumed totals", () => { const snap=createSnapshot(food(),1); const totals=sumEntries([entry(snap,true),entry(snap,false)]); expect(totals.planned.calories).toBe(400); expect(totals.consumed.calories).toBe(200); expect(totals.planned.protein).toBe(40); expect(totals.consumed.protein).toBe(20); });
  it("keeps historical snapshots stable when a saved food changes", () => { const saved=food(); const historical=createSnapshot(saved,1); saved.calories=999; saved.name="Edited food"; expect(historical.calories).toBe(200); expect(historical.name).toBe("Test food"); });
  it("recalculates every nutrient when an entry snapshot quantity changes",()=>{const resized=resizeSnapshot(createSnapshot(food(),1),2.5);expect(resized).toMatchObject({quantity:2.5,calories:500,protein:50,carbohydrates:25,fat:12.5})});
});
