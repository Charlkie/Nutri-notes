import { describe, expect, it } from "vitest";
import { restaurantNames,searchRestaurantFoods } from "./restaurantFoods";

describe("Australian restaurant catalogue", () => {
  it("finds the Oporto Chicken Rappa offline", () => expect(searchRestaurantFoods("chicken rappa")[0]).toMatchObject({ restaurant: "Oporto", name: "Chicken Rappa", calories: 420, protein: 27, carbohydrates: 34, fat: 19 }));
  it("searches by restaurant name", () => expect(searchRestaurantFoods("oporto").length).toBeGreaterThan(1));
  it("returns no unrelated menu items", () => expect(searchRestaurantFoods("big mac")).toEqual([]));
  it("lists major restaurants before filtering their menus",()=>{expect(restaurantNames).toContain("McDonald's");expect(restaurantNames).toHaveLength(50);expect(searchRestaurantFoods("wrap","Nando's").map(item=>item.name)).toContain("Supremo Chicken Wrap")});
  it("includes traceable McDonald's Australia document imports",()=>{
    const cake=searchRestaurantFoods("birthday cake","McDonald's")[0];
    if(!cake) throw new Error("Expected the official McDonald's cake import");
    expect(cake).toMatchObject({calories:81,protein:0.8,carbohydrates:12.5,fat:2.9,servingGrams:44});
    expect(cake.source?.provider).toBe("McDonald's Australia Quality Assurance");
    expect(cake.source?.datasetVersion).toContain("June 2026");
    expect(cake.source?.sourceUrl).toMatch(/^https:\/\/www\.mcdonalds\.com\//);
  });
});
