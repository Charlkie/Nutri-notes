import { describe, expect, it } from "vitest";
import { restaurantNames,searchRestaurantFoods } from "./restaurantFoods";

describe("Australian restaurant catalogue", () => {
  it("finds the Oporto Chicken Rappa offline", () => expect(searchRestaurantFoods("chicken rappa")[0]).toMatchObject({ restaurant: "Oporto", name: "Chicken Rappa", calories: 420, protein: 27, carbohydrates: 34, fat: 19 }));
  it("searches by restaurant name", () => expect(searchRestaurantFoods("oporto").length).toBeGreaterThan(1));
  it("does not return a restaurant's item for another restaurant", () => expect(searchRestaurantFoods("big mac","Oporto")).toEqual([]));
  it("matches natural multi-word searches across punctuation",()=>expect(searchRestaurantFoods("chicken classic 6-inch","Subway")[0]?.name).toBe("Chicken Classic (6-inch sub)"));
  it("lists major restaurants before filtering their menus",()=>{expect(restaurantNames).toContain("McDonald's");expect(restaurantNames).toHaveLength(50);expect(searchRestaurantFoods("wrap","Nando's").map(item=>item.name)).toContain("Supremo Chicken Wrap")});
  it("includes traceable McDonald's Australia document imports",()=>{
    const cake=searchRestaurantFoods("birthday cake","McDonald's")[0];
    if(!cake) throw new Error("Expected the official McDonald's cake import");
    expect(cake).toMatchObject({calories:81,protein:0.8,carbohydrates:12.5,fat:2.9,servingGrams:44});
    expect(cake.source?.provider).toBe("McDonald's Australia Quality Assurance");
    expect(cake.source?.datasetVersion).toContain("June 2026");
    expect(cake.source?.sourceUrl).toMatch(/^https:\/\/www\.mcdonalds\.com\//);
  });
  it("includes McDonald's Australia's generated core menu",()=>{
    const menu=searchRestaurantFoods("","McDonald's");
    expect(menu.length).toBeGreaterThanOrEqual(62);
    expect(searchRestaurantFoods("big mac","McDonald's")[0]).toMatchObject({name:"Big Mac®",servingGrams:233,calories:557,protein:24.6,carbohydrates:44.9,fat:29.4});
    expect(searchRestaurantFoods("nuggets 20 pc","McDonald's")[0]).toMatchObject({name:"Chicken McNuggets® 20 pc",calories:721});
    expect(menu.find(item=>item.name==="Triple Cheeseburger")).toMatchObject({servingGrams:undefined,calories:607});
    expect(menu.filter(item=>item.name!=="Birthday Cake – Ice Cream Cake"&&item.name!=="Honey").every(item=>item.source?.datasetVersion?.includes("January 2026"))).toBe(true);
  });
  it("includes KFC Australia's published energy menu without fabricating macros",()=>{
    const menu=searchRestaurantFoods("","KFC");
    expect(menu).toHaveLength(118);
    const burger=searchRestaurantFoods("zinger burger","KFC")[0];
    expect(burger).toMatchObject({name:"Zinger® Burger",unavailableNutrients:["protein","carbohydrates","fat","fibre"]});
    expect(burger?.calories).toBeCloseTo(1874/4.184);
    expect(burger?.notes).toContain("1874 kJ");
    expect(menu.every(item=>item.source?.sourceUrl==="https://www.kfc.com.au/nutrition-allergen")).toBe(true);
  });
  it("includes the full generated Hungry Jack's Australian catalogue",()=>{
    const menu=searchRestaurantFoods("","Hungry Jack's");
    expect(menu.length).toBeGreaterThanOrEqual(175);
    expect(searchRestaurantFoods("whopper","Hungry Jack's").find(item=>item.name==="Whopper")).toMatchObject({servingGrams:280,calories:582,protein:28.1,carbohydrates:46.6,fat:45.2});
    expect(menu.every(item=>item.source?.sourceUrl?.startsWith("https://www.hungryjacks.com.au/"))).toBe(true);
  });
  it("includes Subway Australia's current made-to-order menu and ingredients",()=>{
    const menu=searchRestaurantFoods("","Subway");
    expect(menu.length).toBeGreaterThanOrEqual(175);
    expect(searchRestaurantFoods("chicken classic 6-inch","Subway")[0]).toMatchObject({servingGrams:248,calories:492,protein:22.3,carbohydrates:47.5,fat:22.8});
    expect(menu.every(item=>item.source?.datasetVersion?.includes("May 2026"))).toBe(true);
  });
  it("includes the current official Guzman y Gomez menu variants",()=>{
    const menu=searchRestaurantFoods("","Guzman y Gomez");
    expect(menu.length).toBeGreaterThanOrEqual(285);
    expect(searchRestaurantFoods("mild grilled chicken burrito","Guzman y Gomez")[0]).toMatchObject({name:"Mild Grilled Chicken (Burrito)",servingGrams:480,calories:773,protein:48.3,carbohydrates:91,fat:23.5});
    expect(menu.every(item=>item.source?.sourceUrl?.startsWith("https://www.guzmanygomez.com.au/"))).toBe(true);
  });
});
