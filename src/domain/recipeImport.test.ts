import { describe, expect, it } from "vitest";
import { compatibleQuantity, parseRecipeText, suggestFood } from "./recipeImport";
import type { Food } from "./types";

const food=(id:string,name:string,baseUnit:Food["baseUnit"]="g"):Food=>({id,name,categoryId:"other",calculationMode:"per100",baseQuantity:100,baseUnit,calories:1,protein:0,carbohydrates:0,fat:0,logCount:0,createdAt:"old",updatedAt:"old"});

describe("pasted recipe import",()=>{
  it("parses servings, groups, fractions, and numbered instructions",()=>{const parsed=parseRecipeText(`Spaghetti\nServes: 4\nIngredients\nSauce:\n1/2 l tomato passata\n500 g lean beef mince\nPasta:\n400 g spaghetti\nInstructions\n1. Brown the beef.\n2. Simmer the sauce.`);expect(parsed).toMatchObject({name:"Spaghetti",yieldServings:4,instructions:["Brown the beef.","Simmer the sauce."]});expect(parsed.ingredients).toMatchObject([{name:"tomato passata",quantity:.5,unit:"l",group:"Sauce"},{name:"lean beef mince",quantity:500,unit:"g",group:"Sauce"},{name:"spaghetti",quantity:400,unit:"g",group:"Pasta"}])});
  it("rejects text without an ingredient section",()=>expect(()=>parseRecipeText("Soup\nSimmer everything")).toThrow(/Ingredients heading/));
  it("suggests normalized saved-food matches",()=>expect(suggestFood("Lean beef minces",[food("beef","Lean beef mince")])?.id).toBe("beef"));
  it("converts compatible metric quantities and falls back safely",()=>{expect(compatibleQuantity(1,"kg",food("rice","Rice"))).toBe(1000);expect(compatibleQuantity(2,"cups",food("rice","Rice"))).toBe(100)});
  it("handles Unicode fractions, preparation notes, ranges, and amounts to taste",()=>{const parsed=parseRecipeText(`Soup\nIngredients\n1½ l stock (low sodium)\n2–3 g garlic, minced\nsalt to taste\nMethod\nSimmer.`);expect(parsed.ingredients).toMatchObject([{name:"stock",quantity:1.5,unit:"l",note:"low sodium"},{name:"garlic",quantity:2,unit:"g",note:"minced",warning:expect.stringContaining("range")},{name:"salt",warning:expect.stringContaining("No precise")}])});
});
