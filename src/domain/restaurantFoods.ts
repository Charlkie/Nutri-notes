import type { FoodDraft } from "./foodImport";
import { dominosMenu, dominosMenuSourceUrl } from "./dominosMenu.generated";
import { gygMenu } from "./gygMenu.generated";
import { hungryJacksMenu } from "./hungryJacksMenu.generated";
import { kfcMenu } from "./kfcMenu.generated";
import { mcdonaldsMenu } from "./mcdonaldsMenu.generated";
import { nandosMenu } from "./nandosMenu.generated";
import { oportoMenu, oportoMenuSource } from "./oportoMenu.generated";
import { pizzaHutMenu, pizzaHutMenuSource } from "./pizzaHutMenu.generated";
import { redRoosterMenu, redRoosterMenuSource } from "./redRoosterMenu.generated";
import { subwayMenu } from "./subwayMenu.generated";

export interface RestaurantFood extends FoodDraft {
  restaurant: string;
  servingGrams?: number;
}

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

const dominosFoods: RestaurantFood[] = dominosMenu.map(([name, category, variant, servingGrams, servingsPerItem, kilojoules, calories, protein, carbohydrates, fat]) => ({
  restaurant: "Domino's",
  name,
  brand: "Domino's",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: servingsPerItem > 1
    ? `1 ${variant} slice (${servingGrams} g; ${servingsPerItem} slices per pizza)`
    : `1 ${variant} serving (${servingGrams} g)`,
  servingGrams,
  calories,
  protein,
  carbohydrates,
  fat,
  notes: `Domino's Australia publishes ${kilojoules} kJ per serving for this ${category} configuration. Pizza values are per slice, not per whole pizza. Standard formulations, portions and availability can change.`,
  source: {
    kind: "restaurant",
    provider: "Domino's Australia nutritional information",
    datasetVersion: "Official online nutrition catalogue captured 31 July 2026",
    importedAt: "2026-07-31T00:00:00.000Z",
    sourceUrl: dominosMenuSourceUrl,
  },
}));

const nandosFoods: RestaurantFood[] = nandosMenu.map(([name, category, servingGrams, kilojoules, calories, protein, carbohydrates, fat, sourcePath]) => ({
  restaurant: "Nando's",
  name,
  brand: "Nando's",
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
  notes: `Nando's Australia publishes ${kilojoules} kJ per serving for this ${category} item. Hand-portioned serves, recipes and availability can change.`,
  source: {
    kind: "restaurant",
    provider: "Nando's Australia nutritional information",
    datasetVersion: "Official item nutrition pages captured 31 July 2026",
    importedAt: "2026-07-31T00:00:00.000Z",
    sourceUrl: `https://www.nandos.com.au/${sourcePath}`,
  },
}));

const pizzaHutFoods: RestaurantFood[] = pizzaHutMenu.map(([name, category, sizeName, productType, kilojoules]) => ({
  restaurant: "Pizza Hut",
  name,
  brand: "Pizza Hut",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: productType === "Pizzas" ? `1 ${sizeName} Original Pan pizza` : `1 ${sizeName.toLocaleLowerCase()} menu item`,
  calories: kilojoules / 4.184,
  protein: 0,
  carbohydrates: 0,
  fat: 0,
  unavailableNutrients: ["protein", "carbohydrates", "fat", "fibre"],
  notes: `Pizza Hut Australia's official ${pizzaHutMenuSource.storeName} ordering feed publishes ${kilojoules} kJ for this ${category} item. Pizza energy is based on the Original Pan base. Catalogue-level macros were not published and are intentionally unavailable.`,
  source: {
    kind: "restaurant",
    provider: "Pizza Hut Australia official ordering menu",
    datasetVersion: `Store ${pizzaHutMenuSource.storeCode} catalogue captured 31 July 2026`,
    importedAt: "2026-07-31T00:00:00.000Z",
    sourceUrl: pizzaHutMenuSource.configurationUrl,
  },
}));

const oportoFoods: RestaurantFood[] = oportoMenu.map(([name, kilojoules, calories, sourceCategory]) => ({
  restaurant: "Oporto",
  name,
  brand: "Oporto",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: "1 configured menu item",
  calories,
  protein: 0,
  carbohydrates: 0,
  fat: 0,
  unavailableNutrients: ["protein", "carbohydrates", "fat", "fibre"],
  notes: `Oporto's official ${oportoMenuSource.storeName} pickup feed publishes ${kilojoules} kJ for this ${sourceCategory} item. Catalogue-level macros were not published and are intentionally unavailable. Store configurations and promotions can vary.`,
  source: {
    kind: "restaurant",
    provider: "Oporto Australia official ordering menu",
    datasetVersion: `Pickup menu updated ${oportoMenuSource.menuUpdatedAt}`,
    importedAt: "2026-07-30T00:00:00.000Z",
    sourceUrl: oportoMenuSource.sourcePage,
  },
}));

const redRoosterFoods: RestaurantFood[] = redRoosterMenu.map(([name, kilojoules, calories, sourceCategory]) => ({
  restaurant: "Red Rooster",
  name,
  brand: "Red Rooster",
  categoryId: "other",
  calculationMode: "perServing",
  baseQuantity: 1,
  baseUnit: "serving",
  servingDescription: "1 configured menu item",
  calories,
  protein: 0,
  carbohydrates: 0,
  fat: 0,
  unavailableNutrients: ["protein", "carbohydrates", "fat", "fibre"],
  notes: `Red Rooster's official ${redRoosterMenuSource.storeName} pickup feed publishes ${kilojoules} kJ for this ${sourceCategory} item. Catalogue-level macros were not published and are intentionally unavailable. Store configurations and promotions can vary.`,
  source: {
    kind: "restaurant",
    provider: "Red Rooster Australia official ordering menu",
    datasetVersion: `Pickup menu updated ${redRoosterMenuSource.menuUpdatedAt}`,
    importedAt: "2026-07-30T00:00:00.000Z",
    sourceUrl: redRoosterMenuSource.sourcePage,
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
  ...dominosFoods,
  ...pizzaHutFoods,
  ...redRoosterFoods,
  ...oportoFoods,
  ...nandosFoods,
  ...hungryJacksFoods,
  ...subwayFoods,
  ...gygFoods,
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
