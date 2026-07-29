import Dexie, { type EntityTable } from "dexie";
import { subDays } from "date-fns";
import type {
  AppSettings,
  DayFoodEntry,
  DayLog,
  DietTemplate,
  Food,
  CatalogFood,
  FoodCategory,
  ID,
  ISODate,
  Recipe,
  ScheduleException,
  StoredSettings,
  TemplateSchedule,
  WeightEntry,
} from "../domain/types";
import { createId } from "../domain/id";
import {
  copyDayData,
  replaceEntryFood,
  transferEntryData,
} from "../domain/day";
import { createSnapshot } from "../domain/nutrition";
import {
  applyTemplateData,
  scheduledTemplateDates,
  templateFromDay,
} from "../domain/templates";
import {
  BACKUP_VERSION,
  parseBackup,
  type BackupData,
} from "../domain/portability";
import { seedCategories, seedFoods, seedRecipes } from "./seed";
import { defaultSettings, validateSettings } from "../domain/settings";
import { buildLoggedRecipe, recipeSnapshot, renameLoggedRecipeEntries } from "../domain/recipes";
import { isLegacyServingUnit } from "../domain/foodUnits";

export class NutritionDB extends Dexie {
  foods!: EntityTable<Food, "id">;
  catalogFoods!: EntityTable<CatalogFood, "id">;
  categories!: EntityTable<FoodCategory, "id">;
  days!: EntityTable<DayLog, "id">;
  entries!: EntityTable<DayFoodEntry, "id">;
  templates!: EntityTable<DietTemplate, "id">;
  schedules!: EntityTable<TemplateSchedule, "id">;
  recipes!: EntityTable<Recipe, "id">;
  weights!: EntityTable<WeightEntry, "id">;
  settings!: EntityTable<StoredSettings, "key">;
  constructor(name = "nutri-notes") {
    super(name);
    this.version(1).stores({
      foods: "id, name, categoryId, lastLoggedAt, logCount",
      categories: "id, sortIndex",
      days: "id, &date",
      entries: "id, dayId, [dayId+sortIndex]",
      templates: "id, name",
      weights: "id, date",
    });
    this.version(2).stores({
      foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt",
      categories: "id, sortIndex",
      days: "id, &date, updatedAt",
      entries: "id, dayId, [dayId+sortIndex], consumed",
      templates: "id, name, updatedAt",
      weights: "id, date",
    });
    this.version(3)
      .stores({
        foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt",
        categories: "id, sortIndex",
        days: "id, &date, updatedAt",
        entries: "id, dayId, [dayId+sortIndex], consumed",
        templates: "id, name, updatedAt",
        weights: "id, date",
        settings: "key",
      })
      .upgrade((tx) =>
        tx.table("settings").put({ key: "app", value: defaultSettings }),
      );
    this.version(4)
      .stores({
        foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt",
        categories: "id, sortIndex",
        days: "id, &date, updatedAt",
        entries: "id, dayId, [dayId+sortIndex], consumed",
        templates: "id, name, updatedAt",
        weights: "id, date",
        settings: "key",
      })
      .upgrade(async (tx) => {
        const stored = await tx.table("settings").get("app");
        await tx.table("settings").put({
          key: "app",
          value: {
            ...defaultSettings,
            ...stored?.value,
            weightUnit: stored?.value?.weightUnit ?? defaultSettings.weightUnit,
            targets: {
              ...defaultSettings.targets,
              ...stored?.value?.targets,
            },
          },
        });
      });
    this.version(5).stores({
      foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt",
      categories: "id, sortIndex",
      days: "id, &date, updatedAt",
      entries: "id, dayId, [dayId+sortIndex], consumed",
      templates: "id, name, updatedAt",
      recipes: "id, name, categoryId, updatedAt",
      weights: "id, date",
      settings: "key",
    });
    this.version(6)
      .stores({
        foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt",
        categories: "id, sortIndex",
        days: "id, &date, updatedAt",
        entries: "id, dayId, [dayId+sortIndex], consumed",
        templates: "id, name, updatedAt",
        recipes: "id, name, categoryId, updatedAt",
        weights: "id, date",
        settings: "key",
      })
      .upgrade(async (tx) => {
        if ((await tx.table("recipes").count()) === 0)
          await tx.table("recipes").bulkAdd(seedRecipes);
      });
    this.version(7)
      .stores({
        foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt",
        categories: "id, sortIndex",
        days: "id, &date, updatedAt",
        entries: "id, dayId, [dayId+sortIndex], consumed",
        templates: "id, name, updatedAt",
        recipes: "id, name, categoryId, updatedAt",
        weights: "id, date",
        settings: "key",
      })
      .upgrade(async (tx) => {
        const existing = await tx.table("recipes").get("beef-rice-bowl");
        const seeded = seedRecipes[0];
        if (existing && seeded && !existing.instructions)
          await tx.table("recipes").put({
            ...existing,
            ingredients: existing.ingredients.map(
              (item: Recipe["ingredients"][number]) => ({
                ...item,
                group: "Bowl",
              }),
            ),
            instructions: seeded.instructions,
            updatedAt: new Date().toISOString(),
          });
      });
    this.version(8).stores({
      foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt",
      categories: "id, sortIndex",
      days: "id, &date, updatedAt, scheduleId",
      entries: "id, dayId, [dayId+sortIndex], consumed",
      templates: "id, name, updatedAt",
      schedules: "id, templateId, start, updatedAt",
      recipes: "id, name, categoryId, updatedAt",
      weights: "id, date",
      settings: "key",
    });
    this.version(9)
      .stores({
        foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt",
        categories: "id, sortIndex",
        days: "id, &date, updatedAt, scheduleId",
        entries: "id, dayId, [dayId+sortIndex], consumed",
        templates: "id, name, updatedAt",
        schedules: "id, templateId, start, updatedAt",
        recipes: "id, name, categoryId, updatedAt",
        weights: "id, date",
        settings: "key",
      })
      .upgrade(async (tx) => {
        const schedules = await tx.table("schedules").toArray();
        await tx
          .table("schedules")
          .bulkPut(
            schedules.map((item: TemplateSchedule) => ({
              ...item,
              exceptions: item.exceptions ?? [],
            })),
          );
      });
    this.version(10).stores({
      foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt, barcode",
      catalogFoods: "id, name, categoryId, barcode, source.externalId",
      categories: "id, sortIndex",
      days: "id, &date, updatedAt, scheduleId",
      entries: "id, dayId, [dayId+sortIndex], consumed",
      templates: "id, name, updatedAt",
      schedules: "id, templateId, start, updatedAt",
      recipes: "id, name, categoryId, updatedAt",
      weights: "id, date",
      settings: "key",
    });
    this.version(11)
      .stores({
        foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt, barcode",
        catalogFoods: "id, name, categoryId, barcode, source.externalId",
        categories: "id, sortIndex",
        days: "id, &date, updatedAt, scheduleId",
        entries: "id, dayId, [dayId+sortIndex], consumed",
        templates: "id, name, updatedAt",
        schedules: "id, templateId, start, updatedAt",
        recipes: "id, name, categoryId, updatedAt",
        weights: "id, date",
        settings: "key",
      })
      .upgrade(async (tx) => {
        const stored = await tx.table("settings").get("app");
        await tx.table("settings").put({
          key: "app",
          value: { ...defaultSettings, ...stored?.value, energyUnit: stored?.value?.energyUnit ?? "kcal" },
        });
      });
    this.version(12)
      .stores({
        foods: "id, name, categoryId, lastLoggedAt, logCount, updatedAt, barcode",
        catalogFoods: "id, name, categoryId, barcode, source.externalId",
        categories: "id, sortIndex",
        days: "id, &date, updatedAt, scheduleId",
        entries: "id, dayId, [dayId+sortIndex], consumed",
        templates: "id, name, updatedAt",
        schedules: "id, templateId, start, updatedAt",
        recipes: "id, name, categoryId, updatedAt",
        weights: "id, date",
        settings: "key",
      })
      .upgrade(async (tx) => {
        await tx.table("foods").toCollection().modify((food: Food) => {
          if (isLegacyServingUnit(food.calculationMode, food.baseQuantity, food.baseUnit)) food.baseUnit = "serving";
        });
        await tx.table("entries").toCollection().modify((entry: DayFoodEntry) => {
          if (isLegacyServingUnit(entry.snapshot.calculationMode, entry.snapshot.baseQuantity, entry.snapshot.unit)) entry.snapshot.unit = "serving";
          entry.recipe?.ingredients.forEach((ingredient) => {
            if (isLegacyServingUnit(ingredient.snapshot.calculationMode, ingredient.snapshot.baseQuantity, ingredient.snapshot.unit)) ingredient.snapshot.unit = "serving";
          });
        });
        await tx.table("templates").toCollection().modify((template: DietTemplate) => {
          template.items.forEach((item) => {
            if (isLegacyServingUnit(item.snapshot.calculationMode, item.snapshot.baseQuantity, item.snapshot.unit)) item.snapshot.unit = "serving";
          });
        });
      });
    this.on("populate", async () => {
      await this.categories.bulkAdd(seedCategories);
      await this.foods.bulkAdd(seedFoods);
      await this.recipes.bulkAdd(seedRecipes);
      await this.settings.add({ key: "app", value: defaultSettings });
    });
  }
}

export const db = new NutritionDB();
let catalogLoad: Promise<void> | undefined;
export function ensureFoodCatalog(): Promise<void> {
  catalogLoad ??= (async () => {
    if (await db.catalogFoods.count()) return;
    const url = new URL("./catalog/fsanz-ausnut-2023.json", document.baseURI);
    const response = await fetch(url);
    if (!response.ok) throw new Error("The bundled FSANZ catalogue could not be opened");
    const foods = (await response.json()) as CatalogFood[];
    await db.catalogFoods.bulkPut(foods);
  })();
  return catalogLoad.catch((error) => {
    catalogLoad = undefined;
    throw error;
  });
}
export const id = createId;
export const isoDate = (date: Date): ISODate =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export async function ensureDay(date: ISODate): Promise<DayLog> {
  const existing = await db.days.where("date").equals(date).first();
  if (existing) return existing;
  const now = new Date().toISOString();
  const day = { id: id(), date, createdAt: now, updatedAt: now };
  await db.days.add(day);
  return day;
}
export async function addFoodToDay(
  date: ISODate,
  food: Food,
  quantity: number,
): Promise<DayFoodEntry> {
  return db.transaction("rw", db.days, db.entries, db.foods, async () => {
    const day = await ensureDay(date);
    const count = await db.entries.where("dayId").equals(day.id).count();
    const now = new Date().toISOString();
    const entry: DayFoodEntry = {
      id: id(),
      dayId: day.id,
      snapshot: createSnapshot(food, quantity),
      sortIndex: count,
      consumed: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.entries.add(entry);
    if (food.id.startsWith("catalog:")) await db.foods.put(food);
    await db.foods.update(food.id, {
      logCount: food.logCount + 1,
      lastLoggedAt: now,
    });
    return entry;
  });
}
export async function replaceFoodEntry(
  entryId: ID,
  food: Food,
  quantity: number,
): Promise<void> {
  await db.transaction("rw", db.entries, db.foods, async () => {
    const entry = await db.entries.get(entryId);
    if (!entry) throw new Error("Food entry no longer exists");
    const now = new Date().toISOString();
    await db.entries.put(replaceEntryFood(entry, food, quantity, now));
    if (food.id.startsWith("catalog:")) await db.foods.put(food);
    await db.foods.update(food.id, {
      logCount: food.logCount + 1,
      lastLoggedAt: now,
    });
  });
}

export async function addRecipeToDay(
  date: ISODate,
  recipe: Recipe,
  foods: Food[],
  servings: number,
): Promise<DayFoodEntry> {
  return db.transaction("rw", db.days, db.entries, async () => {
    const day = await ensureDay(date);
    const sortIndex = await db.entries.where("dayId").equals(day.id).count();
    const now = new Date().toISOString();
    const built = buildLoggedRecipe(recipe, foods, servings);
    const entry: DayFoodEntry = {
      id: id(),
      dayId: day.id,
      snapshot: built.snapshot,
      recipe: built.recipe,
      sortIndex,
      consumed: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.entries.add(entry);
    return entry;
  });
}

export async function saveRecipe(recipe:Recipe):Promise<void>{
  await db.transaction("rw",db.recipes,db.entries,async()=>{
    const previous=await db.recipes.get(recipe.id);
    await db.recipes.put(recipe);
    if(previous&&previous.name!==recipe.name){
      const logged=await db.entries.filter(entry=>entry.recipe?.recipeId===recipe.id).toArray();
      if(logged.length)await db.entries.bulkPut(renameLoggedRecipeEntries(logged,recipe.id,recipe.name,recipe.updatedAt));
    }
  });
}

export async function updateLoggedRecipeEntry(
  entry: DayFoodEntry,
  recipe: Pick<Recipe, "id" | "name" | "categoryId">,
): Promise<void> {
  if (!entry.recipe) throw new Error("This entry is not a recipe");
  await db.entries.put({
    ...entry,
    snapshot: recipeSnapshot(recipe, entry.recipe),
    updatedAt: new Date().toISOString(),
  });
}

export interface EntryTransfer {
  mode: "move" | "copy";
  before: DayFoodEntry;
  after: DayFoodEntry;
}

async function normalizeDayEntries(dayId: ID): Promise<void> {
  const entries = await db.entries
    .where("dayId")
    .equals(dayId)
    .sortBy("sortIndex");
  const now = new Date().toISOString();
  await Promise.all(
    entries.map((entry, sortIndex) =>
      db.entries.update(entry.id, { sortIndex, updatedAt: now }),
    ),
  );
}

export async function transferFoodEntry(
  entryId: ID,
  targetDate: ISODate,
  mode: "move" | "copy",
): Promise<EntryTransfer> {
  return db.transaction("rw", db.days, db.entries, async () => {
    const before = await db.entries.get(entryId);
    if (!before) throw new Error("Food entry no longer exists");
    const sourceDay = await db.days.get(before.dayId);
    if (sourceDay?.date === targetDate)
      throw new Error("Choose a different date");
    const targetDay = await ensureDay(targetDate);
    const targetCount = await db.entries
      .where("dayId")
      .equals(targetDay.id)
      .count();
    const after = transferEntryData(before, targetDay.id, targetCount, mode);
    if (mode === "move") await db.entries.put(after);
    else await db.entries.add(after);
    if (mode === "move") await normalizeDayEntries(before.dayId);
    return { mode, before, after };
  });
}

export async function undoEntryTransfer(
  transfer: EntryTransfer,
): Promise<void> {
  await db.transaction("rw", db.entries, async () => {
    if (transfer.mode === "copy") await db.entries.delete(transfer.after.id);
    else {
      const sourceEntries = await db.entries
        .where("dayId")
        .equals(transfer.before.dayId)
        .sortBy("sortIndex");
      sourceEntries.splice(
        Math.min(transfer.before.sortIndex, sourceEntries.length),
        0,
        transfer.before,
      );
      await db.entries.bulkPut(
        sourceEntries.map((entry, sortIndex) => ({ ...entry, sortIndex })),
      );
      await normalizeDayEntries(transfer.after.dayId);
    }
  });
}
export async function copyPreviousDay(
  targetDate: ISODate,
  preserveConsumed = false,
): Promise<number> {
  return db.transaction("rw", db.days, db.entries, async () => {
    const prior = await db.days
      .where("date")
      .below(targetDate)
      .reverse()
      .sortBy("date");
    for (const source of prior) {
      const sourceEntries = await db.entries
        .where("dayId")
        .equals(source.id)
        .sortBy("sortIndex");
      if (!sourceEntries.length) continue;
      const targetExisting = await db.days
        .where("date")
        .equals(targetDate)
        .first();
      if (targetExisting)
        await db.entries.where("dayId").equals(targetExisting.id).delete();
      const copied = copyDayData(
        sourceEntries,
        targetDate,
        new Date().toISOString(),
        preserveConsumed,
      );
      if (targetExisting) copied.day.id = targetExisting.id;
      if (targetExisting) await db.days.put(copied.day);
      else await db.days.add(copied.day);
      copied.entries = copied.entries.map((e) => ({
        ...e,
        dayId: copied.day.id,
      }));
      await db.entries.bulkAdd(copied.entries);
      return copied.entries.length;
    }
    return 0;
  });
}
export async function seedDemoDay(
  date = isoDate(subDays(new Date(), 1)),
): Promise<void> {
  const existing = await db.days.where("date").equals(date).first();
  if (existing && (await db.entries.where("dayId").equals(existing.id).count()))
    return;
  const foods = await db.foods.toArray();
  const quantities: Record<string, number> = {
    "quick-oats": 45,
    "protein-powder": 1,
    sourdough: 2,
    "white-rice": 180,
    barramundi: 170,
    broccolini: 120,
  };
  for (const food of foods.filter((f) => f.id in quantities))
    await addFoodToDay(date, food, quantities[food.id] ?? food.baseQuantity);
}

export async function convertDayToTemplate(
  date: ISODate,
  name: string,
  conflict: "error" | "replace" | "copy" = "error",
): Promise<DietTemplate> {
  const day = await db.days.where("date").equals(date).first();
  if (!day) throw new Error("This day has no foods");
  const entries = await db.entries
    .where("dayId")
    .equals(day.id)
    .sortBy("sortIndex");
  if (!entries.length) throw new Error("This day has no foods");
  const template = templateFromDay(name, entries);
  const existing = await db.templates
    .where("name")
    .equalsIgnoreCase(template.name)
    .first();
  if (existing && conflict === "error")
    throw new Error("A template with this name already exists");
  if (existing && conflict === "replace") {
    template.id = existing.id;
    template.createdAt = existing.createdAt;
  }
  if (existing && conflict === "copy") {
    let suffix = 1;
    let candidate = `${template.name} Copy`;
    while (
      await db.templates.where("name").equalsIgnoreCase(candidate).first()
    ) {
      suffix += 1;
      candidate = `${template.name} Copy ${suffix}`;
    }
    template.name = candidate;
  }
  await db.templates.put(template);
  return template;
}

export async function applyTemplate(
  template: DietTemplate,
  date: ISODate,
): Promise<number> {
  return db.transaction("rw", db.days, db.entries, async () => {
    const existing = await db.days.where("date").equals(date).first();
    if (existing) await db.entries.where("dayId").equals(existing.id).delete();
    const applied = applyTemplateData(template, date);
    if (existing) {
      applied.day.id = existing.id;
      applied.entries = applied.entries.map((e) => ({
        ...e,
        dayId: existing.id,
      }));
    }
    await db.days.put(applied.day);
    await db.entries.bulkAdd(applied.entries);
    return applied.entries.length;
  });
}

export interface TemplateScheduleResult {
  schedule: TemplateSchedule;
  scheduled: number;
  applied: number;
  skipped: number;
}

async function detachScheduledDate(
  scheduleId: ID | undefined,
  date: ISODate,
): Promise<void> {
  if (!scheduleId) return;
  const owner = await db.schedules.get(scheduleId);
  if (!owner) return;
  await db.schedules.put({
    ...owner,
    appliedDates: owner.appliedDates.filter((value) => value !== date),
    skippedDates: [...new Set([...owner.skippedDates, date])],
    updatedAt: new Date().toISOString(),
  });
}

async function scheduledTemplateForDate(
  base: DietTemplate,
  date: ISODate,
  exceptions: ScheduleException[],
): Promise<DietTemplate | undefined> {
  const exception = exceptions.find((item) => item.date === date);
  if (!exception) return base;
  if (exception.mode === "skip") return undefined;
  const substitute = exception.templateId
    ? await db.templates.get(exception.templateId)
    : undefined;
  if (!substitute)
    throw new Error(`Substitute template for ${date} no longer exists`);
  return substitute;
}

export async function applyTemplateSchedule(
  template: DietTemplate,
  start: ISODate,
  weeks: number,
  weekdays: number[],
  replacePopulated = false,
  exceptions: ScheduleException[] = [],
): Promise<TemplateScheduleResult> {
  const dates = scheduledTemplateDates(start, weeks, weekdays);
  return db.transaction(
    "rw",
    db.days,
    db.entries,
    db.schedules,
    db.templates,
    async () => {
      const now = new Date().toISOString();
      const schedule: TemplateSchedule = {
        id: id(),
        templateId: template.id,
        templateName: template.name,
        start,
        weeks,
        weekdays: [...weekdays].sort(),
        replacePopulated,
        appliedDates: [],
        skippedDates: [],
        exceptions: structuredClone(exceptions),
        createdAt: now,
        updatedAt: now,
      };
      let appliedCount = 0;
      let skipped = 0;
      for (const date of dates) {
        const dateTemplate = await scheduledTemplateForDate(
          template,
          date,
          exceptions,
        );
        if (!dateTemplate) continue;
        const existing = await db.days.where("date").equals(date).first();
        const existingCount = existing
          ? await db.entries.where("dayId").equals(existing.id).count()
          : 0;
        if (existingCount > 0 && !replacePopulated) {
          skipped += 1;
          schedule.skippedDates.push(date);
          continue;
        }
        if (existing?.scheduleId && existing.scheduleId !== schedule.id)
          await detachScheduledDate(existing.scheduleId, date);
        if (existing)
          await db.entries.where("dayId").equals(existing.id).delete();
        const next = applyTemplateData(dateTemplate, date);
        if (existing) {
          next.day.id = existing.id;
          next.day.createdAt = existing.createdAt;
          next.entries = next.entries.map((entry) => ({
            ...entry,
            dayId: existing.id,
          }));
        }
        next.day.scheduleId = schedule.id;
        await db.days.put(next.day);
        await db.entries.bulkAdd(next.entries);
        schedule.appliedDates.push(date);
        appliedCount += 1;
      }
      await db.schedules.add(schedule);
      return {
        schedule,
        scheduled: dates.length,
        applied: appliedCount,
        skipped,
      };
    },
  );
}

export async function updateTemplateSchedule(
  schedule: TemplateSchedule,
  template: DietTemplate,
  start: ISODate,
  weeks: number,
  weekdays: number[],
  replacePopulated = false,
  exceptions: ScheduleException[] = [],
): Promise<TemplateScheduleResult> {
  const dates = scheduledTemplateDates(start, weeks, weekdays);
  const today = isoDate(new Date());
  return db.transaction(
    "rw",
    db.days,
    db.entries,
    db.schedules,
    db.templates,
    async () => {
      const tagged = await db.days
        .where("scheduleId")
        .equals(schedule.id)
        .toArray();
      const future = tagged.filter((day) => day.date > today);
      if (future.length) {
        await db.entries
          .where("dayId")
          .anyOf(future.map((day) => day.id))
          .delete();
        await db.days.bulkDelete(future.map((day) => day.id));
      }
      const preserved = tagged
        .filter((day) => day.date <= today)
        .map((day) => day.date);
      const appliedDates = [...preserved];
      const skippedDates: ISODate[] = [];
      let applied = 0;
      for (const date of dates.filter((value) => value > today)) {
        const dateTemplate = await scheduledTemplateForDate(
          template,
          date,
          exceptions,
        );
        if (!dateTemplate) continue;
        const existing = await db.days.where("date").equals(date).first();
        const count = existing
          ? await db.entries.where("dayId").equals(existing.id).count()
          : 0;
        if (count && !replacePopulated) {
          skippedDates.push(date);
          continue;
        }
        if (existing?.scheduleId && existing.scheduleId !== schedule.id)
          await detachScheduledDate(existing.scheduleId, date);
        if (existing)
          await db.entries.where("dayId").equals(existing.id).delete();
        const next = applyTemplateData(dateTemplate, date);
        if (existing) {
          next.day.id = existing.id;
          next.day.createdAt = existing.createdAt;
          next.entries = next.entries.map((entry) => ({
            ...entry,
            dayId: existing.id,
          }));
        }
        next.day.scheduleId = schedule.id;
        await db.days.put(next.day);
        await db.entries.bulkAdd(next.entries);
        appliedDates.push(date);
        applied++;
      }
      const updated: TemplateSchedule = {
        ...schedule,
        templateId: template.id,
        templateName: template.name,
        start,
        weeks,
        weekdays: [...weekdays].sort(),
        replacePopulated,
        appliedDates,
        skippedDates,
        exceptions: structuredClone(exceptions),
        updatedAt: new Date().toISOString(),
      };
      await db.schedules.put(updated);
      return {
        schedule: updated,
        scheduled: dates.length,
        applied,
        skipped: skippedDates.length,
      };
    },
  );
}

export async function cancelTemplateSchedule(
  scheduleId: ID,
  removeFutureDays: boolean,
): Promise<number> {
  const today = isoDate(new Date());
  return db.transaction("rw", db.days, db.entries, db.schedules, async () => {
    const tagged = await db.days
      .where("scheduleId")
      .equals(scheduleId)
      .toArray();
    const future = tagged.filter((day) => day.date > today);
    if (removeFutureDays && future.length) {
      await db.entries
        .where("dayId")
        .anyOf(future.map((day) => day.id))
        .delete();
      await db.days.bulkDelete(future.map((day) => day.id));
    }
    const retained = removeFutureDays
      ? tagged.filter((day) => day.date <= today)
      : tagged;
    await db.days.bulkPut(
      retained.map((day) => ({ ...day, scheduleId: undefined })),
    );
    await db.schedules.delete(scheduleId);
    return removeFutureDays ? future.length : 0;
  });
}

export async function reorderDayEntries(orderedIds: ID[]): Promise<void> {
  await db.transaction("rw", db.entries, async () => {
    const now = new Date().toISOString();
    await Promise.all(
      orderedIds.map((entryId, sortIndex) =>
        db.entries.update(entryId, { sortIndex, updatedAt: now }),
      ),
    );
  });
}

export async function reorderTemplateItems(
  template: DietTemplate,
  orderedIds: ID[],
): Promise<void> {
  const positions = new Map(orderedIds.map((itemId, index) => [itemId, index]));
  const updated = {
    ...template,
    items: template.items
      .map((item) => ({
        ...item,
        sortIndex: positions.get(item.id) ?? item.sortIndex,
      }))
      .sort((a, b) => a.sortIndex - b.sortIndex),
    updatedAt: new Date().toISOString(),
  };
  await db.templates.put(updated);
}

export async function saveWeight(
  date: ISODate,
  weightKg: number,
  note?: string,
): Promise<WeightEntry> {
  assertWeight(weightKg);
  const existing = await db.weights.where("date").equals(date).first();
  const entry: WeightEntry = {
    id: existing?.id ?? id(),
    date,
    weightKg,
    note: note?.trim() || undefined,
  };
  await db.weights.put(entry);
  return entry;
}

function assertWeight(value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > 500)
    throw new Error("Enter a weight between 0 and 500 kg");
}

export async function saveAppSettings(value: AppSettings): Promise<void> {
  await db.settings.put({ key: "app", value: validateSettings(value) });
}

export async function reorderCategory(
  categoryId: ID,
  offset: -1 | 1,
): Promise<void> {
  await db.transaction("rw", db.categories, async () => {
    const categories = await db.categories.orderBy("sortIndex").toArray();
    const from = categories.findIndex((category) => category.id === categoryId);
    const to = Math.max(0, Math.min(categories.length - 1, from + offset));
    if (from < 0 || from === to) return;
    const [category] = categories.splice(from, 1);
    if (!category) return;
    categories.splice(to, 0, category);
    await db.categories.bulkPut(
      categories.map((item, sortIndex) => ({ ...item, sortIndex })),
    );
  });
}

export async function deleteCategory(
  categoryId: ID,
  replacementId: ID,
): Promise<void> {
  if (categoryId === replacementId)
    throw new Error("Choose a different replacement category");
  await db.transaction(
    "rw",
    [db.categories, db.foods, db.entries, db.templates, db.recipes],
    async () => {
      const [category, replacement] = await Promise.all([
        db.categories.get(categoryId),
        db.categories.get(replacementId),
      ]);
      if (!category || !replacement)
        throw new Error("Category no longer exists");
      const foods = await db.foods
        .where("categoryId")
        .equals(categoryId)
        .toArray();
      await db.foods.bulkPut(
        foods.map((food) => ({
          ...food,
          categoryId: replacementId,
          updatedAt: new Date().toISOString(),
        })),
      );
      const entries = await db.entries.toArray();
      await db.entries.bulkPut(
        entries
          .filter((entry) => entry.snapshot.categoryId === categoryId)
          .map((entry) => ({
            ...entry,
            snapshot: { ...entry.snapshot, categoryId: replacementId },
            updatedAt: new Date().toISOString(),
          })),
      );
      const templates = await db.templates.toArray();
      await db.templates.bulkPut(
        templates
          .filter((template) =>
            template.items.some(
              (item) =>
                item.categoryId === categoryId ||
                item.snapshot.categoryId === categoryId,
            ),
          )
          .map((template) => ({
            ...template,
            items: template.items.map((item) =>
              item.categoryId === categoryId ||
              item.snapshot.categoryId === categoryId
                ? {
                    ...item,
                    categoryId: replacementId,
                    snapshot: { ...item.snapshot, categoryId: replacementId },
                  }
                : item,
            ),
            updatedAt: new Date().toISOString(),
          })),
      );
      const recipes = await db.recipes
        .where("categoryId")
        .equals(categoryId)
        .toArray();
      await db.recipes.bulkPut(
        recipes.map((recipe) => ({
          ...recipe,
          categoryId: replacementId,
          updatedAt: new Date().toISOString(),
        })),
      );
      await db.categories.delete(categoryId);
      const remaining = await db.categories.orderBy("sortIndex").toArray();
      await db.categories.bulkPut(
        remaining.map((item, sortIndex) => ({ ...item, sortIndex })),
      );
    },
  );
}

export async function createFullBackup(): Promise<BackupData> {
  const [
    foods,
    categories,
    recipes,
    templates,
    schedules,
    days,
    entries,
    weights,
    settings,
  ] = await Promise.all([
    db.foods.toArray(),
    db.categories.toArray(),
    db.recipes.toArray(),
    db.templates.toArray(),
    db.schedules.toArray(),
    db.days.toArray(),
    db.entries.toArray(),
    db.weights.toArray(),
    db.settings.get("app"),
  ]);
  return {
    schemaVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "Nutri Notes",
    foods,
    categories,
    recipes,
    templates,
    schedules,
    days,
    entries,
    weights,
    settings: settings?.value ?? defaultSettings,
  };
}

export async function importFullBackup(
  input: unknown,
  mode: "replace" | "merge",
): Promise<BackupData> {
  const backup = parseBackup(input);
  const importedSettings = validateSettings({
    ...defaultSettings,
    ...backup.settings,
    targets: { ...defaultSettings.targets, ...(backup.settings.targets ?? {}) },
  } as AppSettings);
  await db.transaction(
    "rw",
    [
      db.foods,
      db.categories,
      db.recipes,
      db.templates,
      db.schedules,
      db.days,
      db.entries,
      db.weights,
      db.settings,
    ],
    async () => {
      if (mode === "replace")
        await Promise.all([
          db.foods.clear(),
          db.categories.clear(),
          db.recipes.clear(),
          db.templates.clear(),
          db.schedules.clear(),
          db.days.clear(),
          db.entries.clear(),
          db.weights.clear(),
          db.settings.clear(),
        ]);
      const dayIds = new Map<string, string>();
      const incomingDays = [];
      if (mode === "merge")
        for (const day of backup.days) {
          const existing = await db.days.where("date").equals(day.date).first();
          if (existing && existing.id !== day.id) {
            dayIds.set(day.id, existing.id);
            incomingDays.push({
              ...day,
              id: existing.id,
              createdAt: existing.createdAt,
            });
          } else incomingDays.push(day);
        }
      else incomingDays.push(...backup.days);
      const entries = backup.entries.map((entry) =>
        dayIds.has(entry.dayId)
          ? { ...entry, dayId: dayIds.get(entry.dayId)! }
          : entry,
      );
      await Promise.all([
        db.foods.bulkPut(backup.foods),
        db.categories.bulkPut(backup.categories),
        db.recipes.bulkPut(backup.recipes),
        db.templates.bulkPut(backup.templates),
        db.schedules.bulkPut(backup.schedules),
        db.days.bulkPut(incomingDays),
        db.entries.bulkPut(entries),
        db.weights.bulkPut(backup.weights),
        db.settings.put({ key: "app", value: importedSettings }),
      ]);
    },
  );
  return backup;
}
