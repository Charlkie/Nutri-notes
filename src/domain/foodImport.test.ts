import { describe, expect, it } from "vitest";
import { openFoodFactsProductToDraft, parseNutritionLabelText, reviewedFood } from "./foodImport";

describe("food import", () => {
  it("extracts Australian label macros and converts kJ", () => {
    const result = parseNutritionLabelText("SERVING SIZE 40 g\nEnergy 640 kJ\nProtein 5.2 g\nFat 3.1 g\nCarbohydrate 24.6 g\nDietary fibre 4 g");
    expect(result).toMatchObject({ calories: 153, protein: 5.2, fat: 3.1, carbohydrates: 24.6, fibre: 4 });
  });
  it("maps community data but preserves its provenance", () => {
    const result = openFoodFactsProductToDraft({ product_name: "Oats", brands: "Example", nutriments: { "energy-kcal_100g": 380, proteins_100g: 12, carbohydrates_100g: 60, fat_100g: 7 } }, "9300000000000");
    expect(result).toMatchObject({ name: "Oats", barcode: "9300000000000", calories: 380, source: { kind: "open-food-facts" } });
  });
  it("requires valid reviewed values", () => {
    expect(() => reviewedFood({ name: "Bad", categoryId: "other", calculationMode: "per100", baseQuantity: 100, baseUnit: "g", calories: -1, protein: 0, carbohydrates: 0, fat: 0 })).toThrow(/non-negative/);
  });
});
