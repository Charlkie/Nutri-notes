import {describe,expect,it} from "vitest";
import {foodSearchScore,matchesFoodSearch} from "./foodSearch";

describe("generic food search",()=>{
  it("matches words regardless of order",()=>expect(matchesFoodSearch("Orange, navel, peeled, raw","navel orange")).toBe(true));
  it("accepts the common naval orange misspelling",()=>expect(matchesFoodSearch("Orange, navel, peeled, raw","naval orange")).toBe(true));
  it("maps quick oats to Australian rolled-oat terminology",()=>expect(matchesFoodSearch("Oats, rolled, uncooked","quick oats")).toBe(true));
  it("supports partial words while typing",()=>expect(matchesFoodSearch("Barramundi, raw","barra")).toBe(true));
  it("does not return unrelated foods",()=>expect(matchesFoodSearch("Orange roughy, raw","navel orange")).toBe(false));
  it("ranks a simple leading food name above incidental matches",()=>{
    expect(foodSearchScore("Milk, cow, fluid, regular fat","milk")).toBeGreaterThan(foodSearchScore("Coffee beverage, prepared with milk","milk"));
    expect(foodSearchScore("Milk","milk")).toBeGreaterThan(foodSearchScore("Milk, cow, fluid, regular fat","milk"));
  });
});
