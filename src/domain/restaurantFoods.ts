import type { FoodDraft } from "./foodImport";
import { gygMenu } from "./gygMenu.generated";
import { hungryJacksMenu } from "./hungryJacksMenu.generated";
import { kfcMenu } from "./kfcMenu.generated";
import { mcdonaldsMenu } from "./mcdonaldsMenu.generated";
import { subwayMenu } from "./subwayMenu.generated";

export interface RestaurantFood extends FoodDraft {
  restaurant: string;
  servingGrams?: number;
}

const oportoSource = {
  kind: "restaurant" as const,
  provider: "Oporto Australia nutrition information",
  datasetVersion: "Checked July 2026",
  importedAt: "2026-07-29T00:00:00.000Z",
  sourceUrl: "https://www.oporto.com.au/nutrition-and-allergens/",
};

const oporto = (name: string, grams: number | undefined, calories: number, protein: number, carbohydrates: number, fat: number): RestaurantFood => ({
  restaurant: "Oporto",
  name,
  brand: "Oporto",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: grams ? `1 serve (${grams} g)` : "1 serve",
  servingGrams: grams,
  calories,
  protein,
  carbohydrates,
  fat,
  notes: "Bundled Australian restaurant data — menu recipes and hand-portioned serves can change. Verify against the restaurant's current information.",
  source: oportoSource,
});

const nandosSource={kind:"restaurant" as const,provider:"Nando's Australia nutritional information",datasetVersion:"Checked July 2026",importedAt:"2026-07-30T00:00:00.000Z",sourceUrl:"https://www.nandos.com.au/menu-item"};
const nandos=(name:string,grams:number,calories:number,protein:number,carbohydrates:number,fat:number):RestaurantFood=>({restaurant:"Nando's",name,brand:"Nando's",categoryId:"other",calculationMode:"perServing",baseQuantity:1,baseUnit:"serving",servingDescription:`1 serve (${grams} g)`,servingGrams:grams,calories,protein,carbohydrates,fat,notes:"Bundled from Nando's Australia published nutrition information. Menu recipes and portions can change; verify against the current restaurant listing.",source:nandosSource});

const mcdonaldsDessertsSource = {
  kind: "restaurant" as const,
  provider: "McDonald's Australia Quality Assurance",
  datasetVersion: "Desserts and Condiments · June 2026 · revision 11",
  importedAt: "2026-07-30T00:00:00.000Z",
  sourceUrl: "https://www.mcdonalds.com/content/dam/sites/au/nfl/our-impact/food-quality-sourcing/Aus%20Dessert%20and%20Condiments_Jun%202026%20%281%29.pdf",
};

const mcdonaldsDessert = (name: string, servingDescription: string, servingGrams: number, calories: number, protein: number, carbohydrates: number, fat: number): RestaurantFood => ({
  restaurant: "McDonald's",
  name,
  brand: "McDonald's",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription,
  servingGrams,
  calories,
  protein,
  carbohydrates,
  fat,
  notes: "Imported from McDonald's Australia published nutrition information. Standard formulations and portions can change; verify against the current official document.",
  source: mcdonaldsDessertsSource,
});

const mcdonaldsCoreSourceUrl = "https://www.mcdonalds.com/content/dam/sites/au/nfl/nutrition/PDFs/Aus%20Core%20Food%20Menu_January%202026.pdf";
const mcdonaldsCoreFoods: RestaurantFood[] = mcdonaldsMenu.map(([name, servingGrams, calories, protein, carbohydrates, fat]) => ({
  restaurant: "McDonald's",
  name,
  brand: "McDonald's",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: servingGrams ? `1 serve (${servingGrams} g)` : "1 serve",
  servingGrams,
  calories,
  protein,
  carbohydrates,
  fat,
  notes: "Imported from McDonald's Australia's January 2026 core-food nutrition guide. Serving weights are inferred from published per-serve and per-100-g energy where internally consistent; formulations and portions can change.",
  source: {
    kind: "restaurant",
    provider: "McDonald's Australia Quality Assurance",
    datasetVersion: "Core Food Menu · January 2026 · revision 113",
    importedAt: "2026-07-30T00:00:00.000Z",
    sourceUrl: mcdonaldsCoreSourceUrl,
  },
}));

const kfcSourceUrl = "https://www.kfc.com.au/nutrition-allergen";
const kfcFoods: RestaurantFood[] = kfcMenu.map(([name, kilojoules]) => ({
  restaurant: "KFC",
  name,
  brand: "KFC",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: "1 menu item",
  calories: kilojoules / 4.184,
  protein: 0,
  carbohydrates: 0,
  fat: 0,
  unavailableNutrients: ["protein", "carbohydrates", "fat", "fibre"],
  notes: `KFC Australia publishes ${kilojoules} kJ for this menu item. Catalogue-level macros were not published and are intentionally unavailable rather than recorded as zero. Products, portions and promotions can change.`,
  source: {
    kind: "restaurant",
    provider: "KFC Australia Nutrition & Allergen menu",
    datasetVersion: "Official online menu captured 30 July 2026; page nutrition notice dated September 2023",
    importedAt: "2026-07-30T00:00:00.000Z",
    sourceUrl: kfcSourceUrl,
  },
}));

const hungryJacksFoods: RestaurantFood[] = hungryJacksMenu.map(([name, servingGrams, calories, protein, carbohydrates, fat, sourcePath, sourceVersion]) => ({
  restaurant: "Hungry Jack's",
  name,
  brand: "Hungry Jack's",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: `1 serve (${servingGrams} g)`,
  servingGrams,
  calories,
  protein,
  carbohydrates,
  fat,
  notes: "Imported from Hungry Jack's Australia published nutrition information. Standard formulations, availability and portions can change; verify against the current official document.",
  source: {
    kind: "restaurant",
    provider: "Hungry Jack's Australia nutritional information",
    datasetVersion: sourceVersion,
    importedAt: "2026-07-30T00:00:00.000Z",
    sourceUrl: `https://www.hungryjacks.com.au${sourcePath}`,
  },
}));

const subwaySourceUrl = "https://media.subway.com/dam/urn:aaid:aem:9e27a496-e421-4bf1-b6d6-afa95d70746d/original/as/AUS_Nutritional_Web_Guide_May_2026.pdf";
const subwayFoods: RestaurantFood[] = subwayMenu.map(([name, servingGrams, calories, protein, carbohydrates, fat]) => ({
  restaurant: "Subway",
  name,
  brand: "Subway",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: `1 serve (${servingGrams} g)`,
  servingGrams,
  calories,
  protein,
  carbohydrates,
  fat,
  notes: "Imported from Subway Australia's published May 2026 nutrition guide. Made-to-order portions and formulations can change; verify against the current official document.",
  source: {
    kind: "restaurant",
    provider: "Subway Australia nutrition information",
    datasetVersion: "Australian nutritional web guide · May 2026",
    importedAt: "2026-07-30T00:00:00.000Z",
    sourceUrl: subwaySourceUrl,
  },
}));

const gygSourceUrl = "https://www.guzmanygomez.com.au/wp-content/uploads/2026/07/260617_NUTRITION_ALLERGEN_GUIDE_420X297MM.pdf";
const gygFoods: RestaurantFood[] = gygMenu.map(([name, servingGrams, calories, protein, carbohydrates, fat]) => ({
  restaurant: "Guzman y Gomez",
  name,
  brand: "Guzman y Gomez",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: `1 serve (${servingGrams} g)`,
  servingGrams,
  calories,
  protein,
  carbohydrates,
  fat,
  notes: "Imported from Guzman y Gomez Australia's published July 2026 nutrition guide. Published '<0.1 g' values use 0.05 g for calculations. Formulations and portions can change; verify against the current official document.",
  source: {
    kind: "restaurant",
    provider: "Guzman y Gomez Australia nutritional information",
    datasetVersion: "Nutrition, ingredient and allergen guide · current 2 July 2026",
    importedAt: "2026-07-30T00:00:00.000Z",
    sourceUrl: gygSourceUrl,
  },
}));

// Source-labelled catalogue from published Australian restaurant nutrition data.
// Every imported item remains editable and is not presented as universal nutritional advice.
export const restaurantFoods: RestaurantFood[] = [
  ...mcdonaldsCoreFoods,
  mcdonaldsDessert("Birthday Cake – Ice Cream Cake", "1 slice (44 g)", 44, 81, 0.8, 12.5, 2.9),
  mcdonaldsDessert("Honey", "1 packet (13 g)", 13, 44, 0, 10.8, 0),
  ...kfcFoods,
  ...hungryJacksFoods,
  ...subwayFoods,
  ...gygFoods,
  oporto("Chicken Rappa", 276, 420, 27, 34, 19),
  oporto("Chicken Rappsnacker", 160, 340, 17, 44, 10),
  oporto("Quarter Chicken", 179, 300, 42, 3, 13),
  oporto("Chicken Salad Bowl", 325, 530, 46, 28, 20),
  oporto("Chips (Regular)", 150, 360, 6, 46, 16),
  oporto("Crispy Chicken Strips (3 Pieces)", 155, 380, 31, 15, 22),
  oporto("Spicy Rice (Single)", 170, 230, 4, 41, 5),
  oporto("Portuguese Salad (Single)", 160, 30, 2, 4, 0),
  nandos("Half PERi-PERi Chicken",460,715,108,1.1,30.8),
  nandos("Supremo Chicken Wrap",332,648,41.9,52.5,28.9),
];

export const majorAustralianRestaurantNames=["McDonald's","KFC","Hungry Jack's","Subway","Domino's","Pizza Hut","Red Rooster","Oporto","Nando's","Guzman y Gomez","Grill'd","Zambrero","Mad Mex","Taco Bell","Carl's Jr.","Starbucks","Gloria Jean's","The Coffee Club","Boost Juice","Donut King","Krispy Kreme","Bakers Delight","Muffin Break","Sushi Hub","Roll'd","Schnitz","Betty's Burgers","Burger Urge","Lord of the Fries","Soul Origin","SumoSalad","Fishbowl","El Jannah","Ribs & Burgers","Crust Pizza","Pizza Capers","Gelatissimo","San Churro","Max Brenner","Chatime","Gong Cha","Sharetea","Oliver's Real Food","Jamaica Blue","Hudsons Coffee","Zarraffa's Coffee","Pie Face","Chicken Treat","Rashays","The Cheesecake Shop"];
export const restaurantNames=[...new Set([...majorAustralianRestaurantNames,...restaurantFoods.map(food=>food.restaurant)])];

const normalizeRestaurantSearch = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

export function searchRestaurantFoods(query: string, restaurant = "all"): RestaurantFood[] {
  const needle = normalizeRestaurantSearch(query);
  const tokens = needle.split(" ").filter(Boolean);
  const candidates = restaurantFoods.filter((food) => {
    if (restaurant !== "all" && food.restaurant !== restaurant) return false;
    const searchable = normalizeRestaurantSearch(`${food.restaurant} ${food.name}`);
    return tokens.every((token) => searchable.includes(token));
  });
  if (!needle) return candidates;
  return candidates.sort((left, right) => {
    const leftName = normalizeRestaurantSearch(left.name);
    const rightName = normalizeRestaurantSearch(right.name);
    const score = (name: string) => name === needle ? 4 : name.startsWith(`${needle} `) ? 3 : name.includes(needle) ? 2 : 1;
    return score(rightName) - score(leftName) || left.name.localeCompare(right.name);
  });
}
