import type { Food, FoodCategory, Recipe } from "../domain/types";

export const seedCategories: FoodCategory[] = [
  { id: "breakfast", name: "Breakfast", colour: "#f6c453", sortIndex: 0 }, { id: "protein", name: "Protein", colour: "#ff6b75", sortIndex: 1 },
  { id: "carbohydrate", name: "Carbohydrate", colour: "#9b8cff", sortIndex: 2 }, { id: "fruit", name: "Fruit", colour: "#ff9f43", sortIndex: 3 },
  { id: "vegetables", name: "Vegetables", colour: "#4dd48a", sortIndex: 4 }, { id: "snack", name: "Snack", colour: "#f27ac2", sortIndex: 5 },
  { id: "drink", name: "Drink", colour: "#4eb8ff", sortIndex: 6 }, { id: "condiment", name: "Condiment", colour: "#d5c7a1", sortIndex: 7 }, { id: "other", name: "Other", colour: "#9aa3ad", sortIndex: 8 },
];

// Editable starter data only. Values are realistic placeholders, not authoritative nutritional advice.
const now = "2026-01-01T00:00:00.000Z";
const base = { brand: undefined, notes: "Editable seed data — verify against your product label.", logCount: 0, createdAt: now, updatedAt: now };
export const seedFoods: Food[] = [
  { ...base, id: "quick-oats", name: "Quick oats", categoryId: "breakfast", calculationMode: "per100", baseQuantity: 100, baseUnit: "g", calories: 380, protein: 13, carbohydrates: 68, fat: 7, fibre: 10 },
  { ...base, id: "protein-powder", name: "Protein powder", categoryId: "protein", calculationMode: "perServing", baseQuantity: 1, baseUnit: "scoop", servingDescription: "30 g scoop", calories: 120, protein: 24, carbohydrates: 3, fat: 2 },
  { ...base, id: "sourdough", name: "Sourdough", categoryId: "carbohydrate", calculationMode: "perServing", baseQuantity: 1, baseUnit: "slice", servingDescription: "1 slice", calories: 125, protein: 4.5, carbohydrates: 24, fat: 1, fibre: 1.5 },
  { ...base, id: "white-rice", name: "White rice", categoryId: "carbohydrate", calculationMode: "per100", baseQuantity: 100, baseUnit: "g", calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3 },
  { ...base, id: "barramundi", name: "Barramundi", categoryId: "protein", calculationMode: "per100", baseQuantity: 100, baseUnit: "g", calories: 108, protein: 23, carbohydrates: 0, fat: 2 },
  { ...base, id: "lean-beef-mince", name: "Lean beef mince", categoryId: "protein", calculationMode: "per100", baseQuantity: 100, baseUnit: "g", calories: 176, protein: 21.4, carbohydrates: 0, fat: 10 },
  { ...base, id: "broccolini", name: "Broccolini", categoryId: "vegetables", calculationMode: "per100", baseQuantity: 100, baseUnit: "g", calories: 35, protein: 3, carbohydrates: 4, fat: 0.4, fibre: 3.2 },
  { ...base, id: "large-orange", name: "Large orange", categoryId: "fruit", calculationMode: "perServing", baseQuantity: 1, baseUnit: "item", servingDescription: "1 large orange", calories: 86, protein: 1.7, carbohydrates: 21.6, fat: 0.2, fibre: 4.4 },
];

// Editable example recipe assembled from editable seed foods; values are not nutritional advice.
export const seedRecipes:Recipe[]=[{id:"beef-rice-bowl",name:"Beef Rice Bowl",categoryId:"other",yieldServings:2,ingredients:[{id:"beef-rice",foodId:"white-rice",quantity:360,sortIndex:0,group:"Bowl"},{id:"beef-mince",foodId:"lean-beef-mince",quantity:300,sortIndex:1,group:"Bowl"},{id:"beef-broccolini",foodId:"broccolini",quantity:200,sortIndex:2,group:"Bowl"}],instructions:["Cook the rice and divide between two bowls.","Brown the beef mince and cook the broccolini.","Assemble each bowl and season to taste."],notes:"Editable example meal combo — adjust quantities and ingredients to match your preparation.",createdAt:now,updatedAt:now}];
