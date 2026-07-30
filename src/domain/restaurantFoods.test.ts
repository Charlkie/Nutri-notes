import { describe, expect, it } from "vitest";
import { restaurantNames,searchRestaurantFoods } from "./restaurantFoods";

describe("Australian restaurant catalogue", () => {
  it("finds the official Oporto Chicken Rappa without fabricating unpublished macros", () => expect(searchRestaurantFoods("chicken rappa","Oporto")[0]).toMatchObject({ restaurant: "Oporto", name: "Chicken Rappa", calories: 421, unavailableNutrients: ["protein","carbohydrates","fat","fibre"] }));
  it("searches by restaurant name", () => expect(searchRestaurantFoods("oporto").length).toBeGreaterThan(1));
  it("does not return a restaurant's item for another restaurant", () => expect(searchRestaurantFoods("big mac","Oporto")).toEqual([]));
  it("matches natural multi-word searches across punctuation",()=>expect(searchRestaurantFoods("chicken classic 6-inch","Subway")[0]?.name).toBe("Chicken Classic (6-inch sub)"));
  it("lists major restaurants before filtering their menus",()=>{expect(restaurantNames).toContain("McDonald's");expect(restaurantNames).toHaveLength(50);expect(searchRestaurantFoods("supremo","Nando's").map(item=>item.name)).toContain("Supremo")});
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
  it("includes current official Oporto and Red Rooster ordering menus",()=>{
    const oporto=searchRestaurantFoods("","Oporto");
    const redRooster=searchRestaurantFoods("","Red Rooster");
    expect(oporto).toHaveLength(152);
    expect(redRooster).toHaveLength(188);
    expect(searchRestaurantFoods("chicken rappa","Oporto")[0]).toMatchObject({name:"Chicken Rappa",calories:421});
    expect(searchRestaurantFoods("reds burger","Red Rooster")[0]).toMatchObject({name:"Reds Burger",calories:798});
    expect(oporto[0]?.source?.datasetVersion).toContain("2026-07-29");
    expect(redRooster[0]?.source?.datasetVersion).toContain("2026-07-29");
    expect([...oporto,...redRooster].every(item=>item.unavailableNutrients?.includes("protein"))).toBe(true);
  });
  it("includes Domino's complete published crust and size variants",()=>{
    const menu=searchRestaurantFoods("","Domino's");
    expect(menu).toHaveLength(259);
    expect(searchRestaurantFoods("margherita classic crust","Domino's")[0]).toMatchObject({name:"MARGHERITA — Classic Crust",servingGrams:53,calories:116,protein:5,carbohydrates:16.4,fat:3.1});
    expect(searchRestaurantFoods("bbq chicken bacon extra large","Domino's")[0]).toMatchObject({name:"BBQ CHICKEN & BACON — Extra Large",servingGrams:98,calories:229});
    expect(menu.filter(item=>item.name.includes("Classic Crust")).every(item=>item.servingDescription?.includes("slice"))).toBe(true);
    expect(menu.every(item=>item.source?.sourceUrl==="https://www.dominos.com.au/menu/nutritional-information")).toBe(true);
  });
  it("includes Nando's current item nutrition pages and serving variants",()=>{
    const menu=searchRestaurantFoods("","Nando's");
    expect(menu).toHaveLength(21);
    expect(searchRestaurantFoods("half peri peri chicken","Nando's")[0]).toMatchObject({servingGrams:460,calories:715,protein:108,carbohydrates:1.1,fat:30.8});
    expect(searchRestaurantFoods("chips regular","Nando's")[0]).toMatchObject({name:"PERi-PERi Chips — Regular PERi-PERi Chips",servingGrams:140,calories:326});
    expect(menu.every(item=>item.source?.sourceUrl?.startsWith("https://www.nandos.com.au/menu-item/"))).toBe(true);
  });
  it("includes Pizza Hut's current Australian ordering catalogue without fabricating macros",()=>{
    const menu=searchRestaurantFoods("","Pizza Hut");
    expect(menu).toHaveLength(121);
    const margherita=searchRestaurantFoods("margherita large original pan","Pizza Hut")[0];
    expect(margherita).toMatchObject({name:"Margherita — Large Original Pan",unavailableNutrients:["protein","carbohydrates","fat","fibre"]});
    expect(margherita?.calories).toBeCloseTo(6793/4.184);
    expect(margherita?.servingDescription).toBe("1 Large Original Pan pizza");
    expect(menu.every(item=>item.source?.provider==="Pizza Hut Australia official ordering menu")).toBe(true);
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
