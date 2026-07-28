import { describe, expect, it } from "vitest";
import { copyDayData, replaceEntryFood, transferEntryData } from "./day";
import type { DayFoodEntry, Food } from "./types";

describe("copy previous day", () => { const source:DayFoodEntry[]=[{id:"a",dayId:"old",snapshot:{name:"Oats",categoryId:"breakfast",quantity:45,unit:"g",calculationMode:"per100",baseQuantity:100,calories:171,protein:5.8,carbohydrates:30,fat:3.1},sortIndex:4,consumed:true,createdAt:"old",updatedAt:"old"}];it("creates independent ordered, unconsumed entries", () => { const copied=copyDayData(source,"2026-07-26","2026-07-26T01:00:00Z"); expect(copied.day.date).toBe("2026-07-26");expect(copied.entries[0]).toMatchObject({dayId:copied.day.id,sortIndex:0,consumed:false});expect(copied.entries[0]?.id).not.toBe(source[0]?.id);copied.entries[0]!.snapshot.quantity=60;expect(source[0]?.snapshot.quantity).toBe(45); });it("can preserve consumed state when configured",()=>expect(copyDayData(source,"2026-07-27","now",true).entries[0]?.consumed).toBe(true)) });

describe("replace food entry", () => {
  it("replaces the snapshot while preserving entry identity, order and state", () => {
    const entry: DayFoodEntry = {id:"entry",dayId:"day",snapshot:{name:"Oats",categoryId:"breakfast",quantity:45,unit:"g",calculationMode:"per100",baseQuantity:100,calories:171,protein:5.8,carbohydrates:30,fat:3.1},sortIndex:3,consumed:true,note:"post workout",createdAt:"old",updatedAt:"old"};
    const food: Food = {id:"rice",name:"White rice",categoryId:"lunch",calculationMode:"per100",baseQuantity:100,baseUnit:"g",calories:130,protein:2.7,carbohydrates:28,fat:0.3,logCount:2,createdAt:"old",updatedAt:"old"};
    const replaced = replaceEntryFood(entry,food,200,"new");
    expect(replaced).toMatchObject({id:"entry",dayId:"day",sortIndex:3,consumed:true,note:"post workout",updatedAt:"new"});
    expect(replaced.snapshot).toMatchObject({foodId:"rice",name:"White rice",quantity:200,calories:260});
    expect(entry.snapshot.name).toBe("Oats");
  });
});

describe("transfer food entry", () => {
  const entry: DayFoodEntry = {id:"entry",dayId:"source",snapshot:{name:"Oats",categoryId:"breakfast",quantity:45,unit:"g",calculationMode:"per100",baseQuantity:100,calories:171,protein:5.8,carbohydrates:30,fat:3.1},sortIndex:2,consumed:true,note:"packed",createdAt:"old",updatedAt:"old"};
  it("moves the same entry and preserves its state", () => expect(transferEntryData(entry,"target",4,"move","now")).toMatchObject({id:"entry",dayId:"target",sortIndex:4,consumed:true,note:"packed",createdAt:"old",updatedAt:"now"}));
  it("copies an independent snapshot and resets completion", () => {const copied=transferEntryData(entry,"target",0,"copy","now");expect(copied).toMatchObject({dayId:"target",sortIndex:0,consumed:false,createdAt:"now"});expect(copied.id).not.toBe(entry.id);copied.snapshot.quantity=60;expect(entry.snapshot.quantity).toBe(45)});
});
