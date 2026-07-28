import type { Food, FoodUnit } from "./types";
import { createId } from "./id";

export interface ImportedIngredient {
  id: string;
  source: string;
  name: string;
  quantity?: number;
  unit?: string;
  group?: string;
  note?: string;
  warning?: string;
}

export interface ImportedRecipe {
  name: string;
  yieldServings: number;
  ingredients: ImportedIngredient[];
  instructions: string[];
}

const ingredientHeading = /^ingredients?:?$/i;
const instructionHeading = /^(instructions?|method|directions?|preparation):?$/i;
const servingLine = /^(?:serves|servings?|yield)\s*:?\s*(\d+(?:\.\d+)?)/i;
const groupLine = /^\[?([\w][^:\]]{0,40})\]?:$/;
const amountLine = /^(?:(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*)?(g|kg|ml|l|servings?|slices?|items?|scoops?|cups?|tbsp|tsp|pinch(?:es)?)?\s*(?:of\s+)?(.+)$/i;
const unicodeFractions:Record<string,string>={"¼":"1/4","½":"1/2","¾":"3/4","⅓":"1/3","⅔":"2/3","⅛":"1/8","⅜":"3/8","⅝":"5/8","⅞":"7/8"};

const normalizeFractions=(value:string)=>value.replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g,"$1 $2").replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g,fraction=>unicodeFractions[fraction]??fraction);

const numberFrom = (value?: string): number | undefined => {
  if (!value) return undefined;
  if (value.includes(" ")) {
    const [whole, fraction] = value.split(" ");
    return Number(whole) + (numberFrom(fraction) ?? 0);
  }
  if (value.includes("/")) {
    const [top, bottom] = value.split("/").map(Number);
    return bottom ? top! / bottom : undefined;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
};

export function parseRecipeText(input: string): ImportedRecipe {
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Paste a recipe to import");
  let name = lines[0]!;
  let yieldServings = 1;
  let section: "header" | "ingredients" | "instructions" = "header";
  let group: string | undefined;
  const ingredients: ImportedIngredient[] = [];
  const instructions: string[] = [];

  for (const raw of lines.slice(1)) {
    const line = normalizeFractions(raw.replace(/^[-*•]\s*/, "").trim());
    if (ingredientHeading.test(line)) { section = "ingredients"; group = undefined; continue; }
    if (instructionHeading.test(line)) { section = "instructions"; continue; }
    const serving = line.match(servingLine);
    if (section === "header" && serving) { yieldServings = Number(serving[1]); continue; }
    if (section === "ingredients") {
      const possibleGroup = line.match(groupLine);
      if (possibleGroup && (line.endsWith(":") || (line.startsWith("[") && line.endsWith("]")))) { group = possibleGroup[1]?.trim(); continue; }
      const range=line.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+|\/\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?(?:\s+\d+\/\d+|\/\d+)?)(.*)$/);
      const parsedLine=range?`${range[1]}${range[3]}`:line;
      const match = parsedLine.match(amountLine);
      const rawName = match?.[3]?.trim();
      const noteParts=[...(rawName?.matchAll(/\(([^)]+)\)/g)??[])].map(result=>result[1]!).concat(rawName?.includes(",")?rawName.split(",").slice(1).map(value=>value.trim()).filter(Boolean):[]);
      const ingredientName = rawName?.replace(/\s*\([^)]*\)/g,"").split(",")[0]?.replace(/\s+to taste$/i,"").trim();
      const unit=match?.[2]?.toLowerCase();
      const warning=range?`Quantity range ${range[1]}–${range[2]}; using ${range[1]} until reviewed.`:(!match?.[1]||unit?.startsWith("pinch")||/to taste/i.test(rawName??""))?"No precise convertible quantity; review the matched food amount.":undefined;
      if (ingredientName) ingredients.push({ id: createId(), source: raw, name: ingredientName, quantity: numberFrom(match?.[1]), unit, group, note:noteParts.length?noteParts.join(", "):undefined, warning });
      continue;
    }
    if (section === "instructions") instructions.push(line.replace(/^\d+[.)]\s*/, ""));
  }
  if (!ingredients.length) throw new Error("No ingredients found. Include an Ingredients heading.");
  return { name, yieldServings, ingredients, instructions };
}

const singular = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
export function suggestFood(importedName: string, foods: Food[]): Food | undefined {
  const target = singular(importedName);
  return foods.find(food => singular(food.name) === target)
    ?? foods.find(food => singular(food.name).includes(target) || target.includes(singular(food.name)));
}

export function compatibleQuantity(quantity: number | undefined, sourceUnit: string | undefined, food: Food): number {
  if (!quantity || quantity <= 0) return food.baseQuantity;
  const source = singular(sourceUnit ?? "");
  const target = singular(food.baseUnit);
  if (source === target) return quantity;
  if (source === "kg" && target === "g") return quantity * 1000;
  if (source === "l" && target === "ml") return quantity * 1000;
  return food.baseQuantity;
}

export const foodUnitLabel = (unit: FoodUnit): string => unit === "g" ? "g" : unit === "ml" ? "mL" : unit;
