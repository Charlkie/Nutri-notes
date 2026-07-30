import { describe, expect, it } from "vitest";
import { restaurantNames,searchRestaurantFoods } from "./restaurantFoods";

describe("Australian restaurant catalogue", () => {
  it("finds the Oporto Chicken Rappa offline", () => expect(searchRestaurantFoods("chicken rappa")[0]).toMatchObject({ restaurant: "Oporto", name: "Chicken Rappa", calories: 420, protein: 27, carbohydrates: 34, fat: 19 }));
  it("searches by restaurant name", () => expect(searchRestaurantFoods("oporto").length).toBeGreaterThan(1));
  it("returns no unrelated menu items", () => expect(searchRestaurantFoods("big mac")).toEqual([]));
  it("lists restaurants before filtering their menus",()=>{expect(restaurantNames).toEqual(["Nando's","Oporto"]);expect(searchRestaurantFoods("wrap","Nando's").map(item=>item.name)).toContain("Supremo Chicken Wrap")});
});
