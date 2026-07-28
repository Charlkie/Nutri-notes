import { z } from "zod";
import type {
  AppSettings,
  DayFoodEntry,
  DayLog,
  DietTemplate,
  Food,
  FoodCategory,
  Recipe,
  TemplateSchedule,
  WeightEntry,
} from "./types";
import { sumEntries } from "./nutrition";

export const BACKUP_VERSION = 1;
export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  app: "Nutri Notes";
  foods: Food[];
  categories: FoodCategory[];
  recipes: Recipe[];
  templates: DietTemplate[];
  schedules: TemplateSchedule[];
  days: DayLog[];
  entries: DayFoodEntry[];
  weights: WeightEntry[];
  settings: Partial<AppSettings>;
}

const nutrients = {
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbohydrates: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fibre: z.number().nonnegative().optional(),
};
const snapshot = z.object({
  foodId: z.string().optional(),
  name: z.string().min(1),
  brand: z.string().optional(),
  categoryId: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.enum(["g", "ml", "serving", "slice", "item", "scoop"]),
  calculationMode: z.enum(["per100", "perServing"]),
  baseQuantity: z.number().positive(),
  ...nutrients,
});
const schedule = z.object({
  id: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  start: z.string(),
  weeks: z.number().int().min(1).max(52),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  replacePopulated: z.boolean(),
  appliedDates: z.array(z.string()),
  skippedDates: z.array(z.string()),
  exceptions: z
    .array(
      z.object({
        date: z.string(),
        mode: z.enum(["skip", "template"]),
        templateId: z.string().optional(),
        templateName: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const backupSchema = z.object({
  schemaVersion: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  app: z.literal("Nutri Notes"),
  foods: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().min(1),
        categoryId: z.string(),
        calculationMode: z.enum(["per100", "perServing"]),
        baseQuantity: z.number().positive(),
        baseUnit: z.enum(["g", "ml", "serving", "slice", "item", "scoop"]),
        logCount: z.number().nonnegative(),
        createdAt: z.string(),
        updatedAt: z.string(),
        ...nutrients,
      })
      .passthrough(),
  ),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      colour: z.string(),
      sortIndex: z.number(),
    }),
  ),
  recipes: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        categoryId: z.string(),
        yieldServings: z.number().positive(),
        ingredients: z.array(
          z.object({
            id: z.string(),
            foodId: z.string(),
            quantity: z.number().positive(),
            sortIndex: z.number().nonnegative(),
            group: z.string().optional(),
          }),
        ),
        instructions: z.array(z.string()).optional(),
        notes: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .optional()
    .default([]),
  templates: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        items: z.array(
          z
            .object({
              id: z.string(),
              snapshot,
              sortIndex: z.number(),
              categoryId: z.string(),
            })
            .passthrough(),
        ),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .passthrough(),
  ),
  schedules: z.array(schedule).optional().default([]),
  days: z.array(
    z
      .object({
        id: z.string(),
        date: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .passthrough(),
  ),
  entries: z.array(
    z
      .object({
        id: z.string(),
        dayId: z.string(),
        snapshot,
        sortIndex: z.number(),
        consumed: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .passthrough(),
  ),
  weights: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      weightKg: z.number().positive(),
      note: z.string().optional(),
    }),
  ),
  settings: z.record(z.string(), z.unknown()),
});

export function parseBackup(input: unknown): BackupData {
  const result = backupSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid backup: ${result.error.issues[0]?.message ?? "unknown format"}`,
    );
  const backup = result.data as BackupData;
  const dayIds = new Set(backup.days.map((day) => day.id));
  if (backup.entries.some((entry) => !dayIds.has(entry.dayId)))
    throw new Error("Invalid backup: a food entry references a missing day");
  return backup;
}

const safeText = (value: string) =>
  /^[=+\-@]/.test(value) ? `'${value}` : value;
export function csvCell(value: string | number | boolean | undefined): string {
  if (value === undefined) return "";
  const raw = typeof value === "string" ? safeText(value) : String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}
const csv = (rows: (string | number | boolean | undefined)[][]) =>
  rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";

export function createCsvExports(
  data: Pick<BackupData, "days" | "entries" | "weights" | "categories">,
): Record<"day_totals.csv" | "food_entries.csv" | "weight.csv", string> {
  const dayMap = new Map(data.days.map((day) => [day.id, day]));
  const categoryMap = new Map(data.categories.map((c) => [c.id, c.name]));
  const byDay = new Map<string, DayFoodEntry[]>();
  for (const entry of data.entries) {
    const group = byDay.get(entry.dayId) ?? [];
    group.push(entry);
    byDay.set(entry.dayId, group);
  }
  const dayRows: (string | number | boolean | undefined)[][] = [
    [
      "Date",
      "Planned calories",
      "Consumed calories",
      "Protein",
      "Carbohydrates",
      "Fat",
      "Day note",
    ],
  ];
  for (const day of [...data.days].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const totals = sumEntries(byDay.get(day.id) ?? []);
    dayRows.push([
      day.date,
      totals.planned.calories,
      totals.consumed.calories,
      totals.planned.protein,
      totals.planned.carbohydrates,
      totals.planned.fat,
      day.note,
    ]);
  }
  const foodRows: (string | number | boolean | undefined)[][] = [
    [
      "Date",
      "Food",
      "Brand",
      "Quantity",
      "Unit",
      "Calories",
      "Protein",
      "Carbohydrates",
      "Fat",
      "Fibre",
      "Category",
      "Consumed",
      "Entry note",
      "Sort order",
    ],
  ];
  for (const entry of [...data.entries].sort(
    (a, b) =>
      (dayMap.get(a.dayId)?.date ?? "").localeCompare(
        dayMap.get(b.dayId)?.date ?? "",
      ) || a.sortIndex - b.sortIndex,
  ))
    foodRows.push([
      dayMap.get(entry.dayId)?.date,
      entry.snapshot.name,
      entry.snapshot.brand,
      entry.snapshot.quantity,
      entry.snapshot.unit,
      entry.snapshot.calories,
      entry.snapshot.protein,
      entry.snapshot.carbohydrates,
      entry.snapshot.fat,
      entry.snapshot.fibre,
      categoryMap.get(entry.snapshot.categoryId) ?? entry.snapshot.categoryId,
      entry.consumed,
      entry.note,
      entry.sortIndex,
    ]);
  const weightRows: (string | number | boolean | undefined)[][] = [
    ["Date", "Weight kg", "Note"],
    ...[...data.weights]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(
        (weight) =>
          [weight.date, weight.weightKg, weight.note] as (
            string | number | undefined
          )[],
      ),
  ];
  return {
    "day_totals.csv": csv(dayRows),
    "food_entries.csv": csv(foodRows),
    "weight.csv": csv(weightRows),
  };
}
