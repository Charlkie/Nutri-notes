import type { FoodDraft } from "./foodImport";

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

// Curated starter catalogue from published Australian restaurant nutrition data.
// It is intentionally small, source-labelled and editable rather than presented as universal nutritional advice.
export const restaurantFoods: RestaurantFood[] = [
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

export function searchRestaurantFoods(query: string, restaurant = "all"): RestaurantFood[] {
  const needle = query.trim().toLocaleLowerCase();
  return restaurantFoods.filter((food) =>
    (restaurant === "all" || food.restaurant === restaurant) &&
    (!needle || `${food.restaurant} ${food.name}`.toLocaleLowerCase().includes(needle)),
  );
}
