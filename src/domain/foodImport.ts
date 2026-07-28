import type { Food, FoodSource, Nutrients } from "./types";
import { createId } from "./id";

export interface FoodDraft extends Omit<Food, "id" | "logCount" | "createdAt" | "updatedAt"> {
  id?: string;
}

const finite = (value: unknown): number | undefined => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export function parseNutritionLabelText(text: string): Partial<Nutrients> & { servingDescription?: string } {
  const clean = text.replace(/\r/g, "");
  const value = (labels: string[]) => {
    for (const label of labels) {
      const match = clean.match(new RegExp(`(?:${label})\\s*(?:\\([^)]*\\))?\\s*[:–-]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:g|kcal|cal)?`, "i"));
      const parsed = finite(match?.[1]);
      if (parsed !== undefined) return parsed;
    }
    return undefined;
  };
  const kilojoules = value(["energy(?:\\s+value)?"]);
  const explicitCalories = clean.match(/(?:energy|calories?)\s*[:–-]?\s*(\d+(?:[.,]\d+)?)\s*(?:kcal|cal)\b/i);
  const serving = clean.match(/serv(?:e|ing)(?:\s+size)?\s*[:–-]?\s*([^\n]+)/i)?.[1]?.trim();
  return {
    calories: finite(explicitCalories?.[1]) ?? (kilojoules === undefined ? undefined : Math.round((kilojoules / 4.184) * 10) / 10),
    protein: value(["protein"]),
    carbohydrates: value(["carbohydrate(?:s)?", "carbs"]),
    fat: value(["total\\s+fat", "fat"]),
    fibre: value(["dietary\\s+fibre", "fiber", "fibre"]),
    servingDescription: serving,
  };
}

export function openFoodFactsProductToDraft(product: Record<string, unknown>, barcode?: string): FoodDraft {
  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const source: FoodSource = {
    kind: "open-food-facts",
    provider: "Open Food Facts contributors",
    externalId: barcode ?? String(product.code ?? ""),
    importedAt: new Date().toISOString(),
    sourceUrl: barcode ? `https://world.openfoodfacts.org/product/${barcode}` : undefined,
  };
  const kcal = finite(nutriments["energy-kcal_100g"] ?? nutriments["energy-kcal"]);
  const kj = finite(nutriments.energy_100g ?? nutriments.energy);
  return {
    name: String(product.product_name_en ?? product.product_name ?? "").trim(),
    brand: String(product.brands ?? "").split(",")[0]?.trim() || undefined,
    barcode: barcode ?? (String(product.code ?? "") || undefined),
    categoryId: "other",
    calculationMode: "per100",
    baseQuantity: 100,
    baseUnit: String(product.product_quantity_unit ?? "").toLowerCase() === "ml" ? "ml" : "g",
    calories: kcal ?? (kj === undefined ? 0 : Math.round((kj / 4.184) * 10) / 10),
    protein: finite(nutriments.proteins_100g) ?? 0,
    carbohydrates: finite(nutriments.carbohydrates_100g) ?? 0,
    fat: finite(nutriments.fat_100g) ?? 0,
    fibre: finite(nutriments.fiber_100g),
    servingDescription: String(product.serving_size ?? "").trim() || undefined,
    notes: "Community-contributed branded data — compare against the package label.",
    source,
  };
}

export function reviewedFood(draft: FoodDraft): Food {
  const required = [draft.baseQuantity, draft.calories, draft.protein, draft.carbohydrates, draft.fat];
  if (!draft.name.trim()) throw new Error("Food name is required");
  if (required.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Nutrition values must be valid and non-negative");
  if (draft.baseQuantity <= 0) throw new Error("Base quantity must be greater than zero");
  if (draft.fibre !== undefined && (!Number.isFinite(draft.fibre) || draft.fibre < 0)) throw new Error("Fibre must be valid and non-negative");
  const now = new Date().toISOString();
  return { ...draft, id: draft.id ?? createId(), name: draft.name.trim(), source: draft.source ? { ...draft.source, reviewedAt: now } : undefined, logCount: 0, createdAt: now, updatedAt: now };
}
