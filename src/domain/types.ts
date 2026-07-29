export type ID = string;
export type ISODate = string;
export type CalculationMode = "per100" | "perServing";
export type FoodUnit = "g" | "ml" | "serving" | "slice" | "item" | "scoop";

export interface Nutrients {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre?: number;
}
export type FoodSourceKind = "custom" | "seed" | "fsanz" | "open-food-facts" | "nutrition-label" | "restaurant";
export interface FoodSource {
  kind: FoodSourceKind;
  provider: string;
  externalId?: string;
  datasetVersion?: string;
  derivation?: string;
  importedAt: string;
  sourceUrl?: string;
  reviewedAt?: string;
}
export interface FoodMeasure {
  id: string;
  label: string;
  quantity: number;
  grams: number;
  millilitres?: number;
}
export interface Food extends Nutrients {
  id: ID;
  name: string;
  brand?: string;
  categoryId: ID;
  calculationMode: CalculationMode;
  baseQuantity: number;
  baseUnit: FoodUnit;
  servingDescription?: string;
  notes?: string;
  barcode?: string;
  source?: FoodSource;
  measures?: FoodMeasure[];
  logCount: number;
  lastLoggedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface CatalogFood extends Food {
  source: FoodSource;
}
export interface FoodSnapshot extends Nutrients {
  foodId?: ID;
  name: string;
  brand?: string;
  categoryId: ID;
  quantity: number;
  unit: FoodUnit;
  calculationMode: CalculationMode;
  baseQuantity: number;
}
export interface RecipeIngredient {
  id: ID;
  foodId: ID;
  quantity: number;
  sortIndex: number;
  group?: string;
}
export interface Recipe {
  id: ID;
  name: string;
  categoryId: ID;
  yieldServings: number;
  ingredients: RecipeIngredient[];
  instructions?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
export interface LoggedRecipeIngredient {
  id: ID;
  enabled: boolean;
  snapshot: FoodSnapshot;
  group?: string;
}
export interface LoggedRecipe {
  recipeId: ID;
  yieldServings: number;
  loggedServings: number;
  ingredients: LoggedRecipeIngredient[];
  instructions?: string[];
}
export interface DayFoodEntry {
  id: ID;
  dayId: ID;
  snapshot: FoodSnapshot;
  recipe?: LoggedRecipe;
  sortIndex: number;
  consumed: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
export interface DayLog {
  id: ID;
  date: ISODate;
  note?: string;
  scheduleId?: ID;
  createdAt: string;
  updatedAt: string;
}
export interface FoodCategory {
  id: ID;
  name: string;
  colour: string;
  sortIndex: number;
}
export interface TemplateItem {
  id: ID;
  foodId?: ID;
  snapshot: FoodSnapshot;
  recipe?: LoggedRecipe;
  sortIndex: number;
  categoryId: ID;
}
export interface DietTemplate {
  id: ID;
  name: string;
  folderId?: ID;
  items: TemplateItem[];
  createdAt: string;
  updatedAt: string;
}
export interface ScheduleException {
  date: ISODate;
  mode: "skip" | "template";
  templateId?: ID;
  templateName?: string;
}
export interface TemplateSchedule {
  id: ID;
  templateId: ID;
  templateName: string;
  start: ISODate;
  weeks: number;
  weekdays: number[];
  replacePopulated: boolean;
  appliedDates: ISODate[];
  skippedDates: ISODate[];
  exceptions: ScheduleException[];
  createdAt: string;
  updatedAt: string;
}
export interface WeightEntry {
  id: ID;
  date: ISODate;
  weightKg: number;
  note?: string;
}
export interface DayTotals {
  planned: Nutrients;
  consumed: Nutrients;
}
export interface NutritionTargets {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}
export type WeightUnit = "kg" | "lb";
export type EnergyUnit = "kcal" | "kJ";
export interface AppSettings {
  appearance: "system" | "light" | "dark";
  accentColour: string;
  weekStartsOn: 0 | 1;
  copyConsumedState: "reset" | "preserve";
  weightUnit: WeightUnit;
  energyUnit: EnergyUnit;
  targets: NutritionTargets;
}
export interface StoredSettings {
  key: "app";
  value: AppSettings;
}
