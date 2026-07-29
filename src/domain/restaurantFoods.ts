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
];

export function searchRestaurantFoods(query: string, restaurant = "all"): RestaurantFood[] {
  const needle = query.trim().toLocaleLowerCase();
  return restaurantFoods.filter((food) =>
    (restaurant === "all" || food.restaurant === restaurant) &&
    (!needle || `${food.restaurant} ${food.name}`.toLocaleLowerCase().includes(needle)),
  );
}
