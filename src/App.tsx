import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  Apple,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  ImagePlus,
  FolderOpen,
  GripVertical,
  Info,
  Leaf,
  List,
  MoreHorizontal,
  MoveRight,
  Paintbrush,
  Pencil,
  PieChart,
  Plus,
  Replace,
  Save,
  Scale,
  Search,
  ScanBarcode,
  Settings,
  Share2,
  ShieldCheck,
  Tags,
  Target,
  Trash2,
  TrendingDown,
  Upload,
  UserRound,
  Utensils,
  Unlink,
  X,
} from "lucide-react";
import {
  addFoodToDay,
  applyTemplate,
  applyTemplateSchedule,
  cancelTemplateSchedule,
  convertDayToTemplate,
  copyPreviousDay,
  createFullBackup,
  db,
  deleteCategory,
  id,
  ensureFoodCatalog,
  importFullBackup,
  isoDate,
  reorderCategory,
  reorderDayEntries,
  reorderTemplateItems,
  replaceFoodEntry,
  saveAppSettings,
  saveWeight,
  seedDemoDay,
  transferFoodEntry,
  undoEntryTransfer,
  updateTemplateSchedule,
} from "./data/db";
import {
  assertNonNegative,
  calculateNutrients,
  resizeSnapshot,
  roundCalories,
  roundMacro,
  sumEntries,
} from "./domain/nutrition";
import { monthGrid } from "./domain/calendar";
import {
  displayWeight,
  weightChange,
  weightInputToKg,
  withSevenDayAverage,
} from "./domain/body";
import {
  categoryBreakdown,
  dailyNutrition,
  foodStatistics,
  macroCalorieBreakdown,
  type BreakdownItem,
  type DatedEntry,
} from "./domain/analytics";
import {
  createCsvExports,
  parseBackup,
  type BackupData,
} from "./domain/portability";
import { defaultSettings } from "./domain/settings";
import { scheduledTemplateDates } from "./domain/templates";
import {
  isPrimaryRoute,
  navigationHash,
  parseNavigationHash,
  type PrimaryRoute,
} from "./domain/navigation";
import {
  useDropboxBackup,
  type DropboxBackupController,
} from "./dropbox";
import {
  useGoogleDriveBackup,
  type GoogleDriveBackupController,
} from "./googleDrive";
import type {
  AppSettings,
  DayFoodEntry,
  DietTemplate,
  Food,
  FoodCategory,
  FoodUnit,
  ISODate,
  ScheduleException,
  TemplateSchedule,
  WeightEntry,
  WeightUnit,
} from "./domain/types";
const RecipePanel = lazy(() =>
  import("./recipes").then((module) => ({ default: module.RecipePanel })),
);
const RecipeEntryEditor = lazy(() =>
  import("./recipes").then((module) => ({ default: module.RecipeEntryEditor })),
);
const FoodImportTools = lazy(() =>
  import("./foodImport").then((module) => ({ default: module.FoodImportTools })),
);
type PickerTab = "foods" | "recipes" | "templates";
type Route =
  | PrimaryRoute
  | "picker"
  | "foodForm"
  | "foodImport"
  | "entryForm"
  | "recipeEntry"
  | "templateEditor";
type Toast = {
  message: string;
  undo?: () => Promise<void>;
};
const units: FoodUnit[] = ["g", "ml", "serving", "slice", "item", "scoop"];
function dateLabel(date: Date) {
  const today = new Date();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, subDays(today, 1))) return "Yesterday";
  return format(date, "EEE, d MMM");
}
function useDay(date: ISODate) {
  return useLiveQuery(async () => {
    const day = await db.days.where("date").equals(date).first();
    return {
      day,
      entries: day
        ? await db.entries.where("dayId").equals(day.id).sortBy("sortIndex")
        : [],
    };
  }, [date]);
}
export default function App() {
  const initialNavigation = useMemo(
    () => parseNavigationHash(location.hash, isoDate(new Date())),
    [],
  );
  const [route, setRoute] = useState<Route>(initialNavigation.route);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date(`${initialNavigation.date}T12:00:00`),
  );
  const [pickerTab, setPickerTab] = useState<PickerTab>("foods");
  const [editingFood, setEditingFood] = useState<Food>();
  const [editingEntry, setEditingEntry] = useState<DayFoodEntry>();
  const [editingTemplate, setEditingTemplate] = useState<DietTemplate>();
  const [toast, setToast] = useState<Toast>();
  const [dbError, setDbError] = useState<string>();
  const dropbox = useDropboxBackup();
  const googleDrive = useGoogleDriveBackup(route === "settings");
  const date = isoDate(selectedDate);
  const data = useDay(date);
  const categories =
    useLiveQuery(() => db.categories.orderBy("sortIndex").toArray(), []) ?? [];
  const appSettings =
    useLiveQuery(() => db.settings.get("app"), [])?.value ?? defaultSettings;
  useEffect(() => {
    db.open()
      .then(() => seedDemoDay())
      .then(() => ensureFoodCatalog().catch(() => setToast({ message: "FSANZ catalogue is temporarily unavailable · saved foods still work" })))
      .catch((e) =>
        setDbError(e instanceof Error ? e.message : "Database unavailable"),
      );
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const root = document.documentElement;
    if (appSettings.appearance === "system") delete root.dataset.theme;
    else root.dataset.theme = appSettings.appearance;
    root.style.setProperty("--accent", appSettings.accentColour);
  }, [appSettings]);
  useEffect(() => {
    if (!isPrimaryRoute(route)) return;
    const next = navigationHash(route, date);
    if (location.hash !== next) history.replaceState(null, "", next);
  }, [route, date]);
  useEffect(() => {
    const restore = () => {
      const next = parseNavigationHash(location.hash, isoDate(new Date()));
      setRoute(next.route);
      setSelectedDate(new Date(`${next.date}T12:00:00`));
      setEditingEntry(undefined);
      setEditingFood(undefined);
      setEditingTemplate(undefined);
    };
    addEventListener("hashchange", restore);
    return () => removeEventListener("hashchange", restore);
  }, []);
  const goDay = () => {
    setRoute("day");
    setEditingEntry(undefined);
    setEditingFood(undefined);
  };
  const nav = (next: Route) => {
    if (next === "day" && route === "day") {
      setPickerTab("foods");
      setRoute("picker");
    } else setRoute(next);
  };
  if (dbError)
    return (
      <main className="fatal">
        <CircleHelp />
        <h1>Nutri Notes couldn’t open</h1>
        <p>Your local database reported: {dbError}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </main>
    );
  return (
    <div className="app-shell">
      {route === "day" && (
        <DayScreen
          date={date}
          selectedDate={selectedDate}
          data={data}
          categories={categories}
          settings={appSettings}
          onMoveDate={(d) => setSelectedDate(d)}
          onPick={() => {
            setPickerTab("foods");
            setRoute("picker");
          }}
          onTemplates={() => {
            setPickerTab("templates");
            setRoute("picker");
          }}
          onCopy={async () => {
            const count = await copyPreviousDay(
              date,
              appSettings.copyConsumedState === "preserve",
            );
            setToast({
              message: count
                ? `Copied ${count} foods`
                : "No previous day to copy",
            });
          }}
          onEdit={(e) => {
            setEditingFood(undefined);
            setEditingEntry(e);
            setRoute(e.recipe ? "recipeEntry" : "entryForm");
          }}
          onToast={setToast}
        />
      )}
      {route === "picker" && (
        <FoodPicker
          date={date}
          categories={categories}
          tab={editingEntry ? "foods" : pickerTab}
          onTab={setPickerTab}
          replacing={Boolean(editingEntry)}
          onClose={editingEntry ? () => setRoute("entryForm") : goDay}
          onCustom={() => {
            setEditingFood(undefined);
            setRoute("foodForm");
          }}
          onImport={() => setRoute("foodImport")}
          onEditFood={(food) => {
            setEditingFood(food);
            setRoute("foodForm");
          }}
          onSelected={(food) => {
            setEditingFood(food);
            setRoute("entryForm");
          }}
          onEditTemplate={(template) => {
            setEditingTemplate(template);
            setRoute("templateEditor");
          }}
          onApplied={(message) => {
            setToast({ message });
            goDay();
          }}
        />
      )}
      {route === "foodImport" && (
        <Suspense fallback={<div className="loading">Opening food importer…</div>}>
          <FoodImportTools
            categories={categories}
            onClose={() => setRoute("picker")}
            onSaved={(food) => {
              setEditingFood(food);
              setToast({ message: `${food.name} saved after review` });
              setRoute("entryForm");
            }}
          />
        </Suspense>
      )}
      {route === "templateEditor" && editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => setRoute("picker")}
          onChanged={setEditingTemplate}
          onDeleted={() => {
            setToast({ message: "Template deleted" });
            setRoute("picker");
          }}
        />
      )}
      {route === "foodForm" && (
        <FoodForm
          food={editingFood}
          categories={categories}
          onClose={() => setRoute("picker")}
          onSaved={() => setRoute("picker")}
        />
      )}
      {route === "entryForm" && (
        <EntryForm
          date={date}
          food={editingFood}
          entry={editingEntry}
          categories={categories}
          onReplace={() => {
            setEditingFood(undefined);
            setPickerTab("foods");
            setRoute("picker");
          }}
          onClose={editingEntry ? goDay : () => setRoute("picker")}
          onSaved={goDay}
          onDelete={(entry) =>
            setToast({
              message: `${entry.snapshot.name} deleted`,
              undo: async () => {
                await db.entries.put(entry);
              },
            })
          }
        />
      )}
      {route === "recipeEntry" && editingEntry?.recipe && (
        <Suspense fallback={<div className="loading">Loading recipe…</div>}>
          <RecipeEntryEditor
            entry={editingEntry}
            onClose={goDay}
            onSaved={goDay}
            onDelete={(entry) =>
              setToast({
                message: `${entry.snapshot.name} deleted`,
                undo: async () => {
                  await db.entries.put(entry);
                },
              })
            }
          />
        </Suspense>
      )}
      {route === "entryForm" && editingEntry && (
        <EntryTransferAction
          entry={editingEntry}
          sourceDate={date}
          onTransfer={async (targetDate, mode) => {
            const transfer = await transferFoodEntry(
              editingEntry.id,
              targetDate,
              mode,
            );
            setToast({
              message: `${editingEntry.snapshot.name} ${mode === "move" ? "moved" : "copied"} to ${format(new Date(`${targetDate}T12:00:00`), "d MMM")}`,
              undo: async () => undoEntryTransfer(transfer),
            });
            goDay();
          }}
        />
      )}
      {route === "calendar" && (
        <CalendarScreen
          selectedDate={selectedDate}
          categories={categories}
          weekStartsOn={appSettings.weekStartsOn}
          onSelectDate={setSelectedDate}
          onOpenDay={(d) => {
            setSelectedDate(d);
            setRoute("day");
          }}
        />
      )}
      {route === "body" && (
        <BodyScreen unit={appSettings.weightUnit} onToast={setToast} />
      )}
      {route === "charts" && <ChartsScreen categories={categories} />}
      {route === "settings" && (
        <SettingsScreen
          categories={categories}
          settings={appSettings}
          dropbox={dropbox}
          googleDrive={googleDrive}
          onToast={setToast}
        />
      )}
      {route !== "picker" &&
        route !== "foodForm" &&
        route !== "foodImport" &&
        route !== "entryForm" &&
        route !== "recipeEntry" &&
        route !== "templateEditor" && <BottomNav active={route} onNav={nav} />}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={async () => {
                await toast.undo?.();
                setToast(undefined);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function DayScreen({
  date,
  selectedDate,
  data,
  categories,
  settings,
  onMoveDate,
  onPick,
  onTemplates,
  onCopy,
  onEdit,
  onToast,
}: {
  date: ISODate;
  selectedDate: Date;
  data: ReturnType<typeof useDay>;
  categories: FoodCategory[];
  settings: AppSettings;
  onMoveDate: (d: Date) => void;
  onPick: () => void;
  onTemplates: () => void;
  onCopy: () => Promise<void>;
  onEdit: (e: DayFoodEntry) => void;
  onToast: (t: Toast) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [nameConflict, setNameConflict] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 380, tolerance: 8 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { delay: 350, tolerance: 6 },
    }),
  );
  if (data === undefined)
    return (
      <main className="screen loading">
        <Activity className="spin" />
        <p>Opening your day…</p>
      </main>
    );
  const totals = sumEntries(data.entries);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const editing = selectedId !== undefined;
  const remove = async (entry: DayFoodEntry) => {
    await db.entries.delete(entry.id);
    setSelectedId(undefined);
    onToast({
      message: `${entry.snapshot.name} deleted`,
      undo: async () => {
        await db.entries.put(entry);
      },
    });
  };
  const moveSelected = async (offset: number) => {
    const oldIndex = data.entries.findIndex((e) => e.id === selectedId);
    const newIndex = Math.max(
      0,
      Math.min(data.entries.length - 1, oldIndex + offset),
    );
    if (oldIndex < 0 || oldIndex === newIndex) return;
    await reorderDayEntries(
      arrayMove(data.entries, oldIndex, newIndex).map((e) => e.id),
    );
  };
  const dragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !data.day) return;
    const oldIndex = data.entries.findIndex((e) => e.id === active.id);
    const newIndex = data.entries.findIndex((e) => e.id === over.id);
    const ordered = arrayMove(data.entries, oldIndex, newIndex).map(
      (e) => e.id,
    );
    await reorderDayEntries(ordered);
    setSelectedId(String(active.id));
  };
  const saveTemplate = async (
    conflict: "error" | "replace" | "copy" = "error",
  ) => {
    try {
      const template = await convertDayToTemplate(date, templateName, conflict);
      setConvertOpen(false);
      setMenu(false);
      setTemplateName("");
      setNameConflict(false);
      onToast({ message: `Saved “${template.name}”` });
    } catch (ex) {
      if (ex instanceof Error && ex.message.includes("already exists")) {
        setNameConflict(true);
        return;
      }
      onToast({
        message: ex instanceof Error ? ex.message : "Could not save template",
      });
    }
  };
  const convert = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveTemplate();
  };
  return (
    <main className={`screen day-screen ${editing ? "edit-mode" : ""}`}>
      <header className="brand-bar">
        <span className="brand-mark">
          <Leaf /> Nutri Notes
        </span>
        <button
          className="icon-button muted"
          aria-label="Day options"
          onClick={() => setMenu((v) => !v)}
        >
          <MoreHorizontal />
        </button>
        {menu && (
          <div className="day-menu">
            <button
              onClick={() => {
                setConvertOpen(true);
                setMenu(false);
              }}
              disabled={!data.entries.length}
            >
              <Save />
              Convert to Template
            </button>
            <button onClick={onTemplates}>
              <FolderOpen />
              Templates
            </button>
          </div>
        )}
      </header>
      <div className="date-bar">
        <button
          className="icon-button"
          aria-label="Previous day"
          onClick={() => onMoveDate(subDays(selectedDate, 1))}
        >
          <ChevronLeft />
        </button>
        <div>
          <h1>{dateLabel(selectedDate)}</h1>
          <span>{format(selectedDate, "d MMMM yyyy")}</span>
        </div>
        <button
          className="icon-button"
          aria-label="Next day"
          onClick={() => onMoveDate(addDays(selectedDate, 1))}
        >
          <ChevronRight />
        </button>
      </div>
      {data.entries.length > 0 && (
        <NutritionSummary totals={totals} targets={settings.targets} />
      )}
      {data.entries.length === 0 ? (
        <section className="empty-day">
          <button className="empty-action" onClick={onPick}>
            <span className="empty-icon">
              <Plus />
            </span>
            <strong>Start New Day</strong>
            <small>
              Choose foods for {dateLabel(selectedDate).toLowerCase()}
            </small>
          </button>
          <button className="empty-action" onClick={onCopy}>
            <span className="empty-icon copy">
              <Apple />
            </span>
            <strong>Copy Previous Day</strong>
            <small>Quantities copied, consumption reset</small>
          </button>
          <button className="template-shortcut" onClick={onTemplates}>
            <FolderOpen />
            Apply a template
          </button>
        </section>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => {
            setSelectedId(String(active.id));
            navigator.vibrate?.(15);
          }}
          onDragEnd={dragEnd}
          onDragCancel={() => setSelectedId(undefined)}
        >
          <SortableContext
            items={data.entries.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <section className="card-list" aria-label="Food entries">
              {data.entries.map((entry) => (
                <SortableFoodCard
                  key={entry.id}
                  entry={entry}
                  category={categoryMap.get(entry.snapshot.categoryId)}
                  editing={editing}
                  selected={selectedId === entry.id}
                  onSelect={() => setSelectedId(entry.id)}
                  onEdit={() =>
                    editing ? setSelectedId(entry.id) : onEdit(entry)
                  }
                />
              ))}
              <button className="add-another" onClick={onPick}>
                <Plus /> Add food or recipe
              </button>
            </section>
          </SortableContext>
        </DndContext>
      )}
      {editing && (
        <div className="edit-toolbar" aria-label="Reorder selected food">
          <button onClick={() => setSelectedId(undefined)}>
            <Check />
            <span>Done</span>
          </button>
          <button
            onClick={() => void moveSelected(-1)}
            disabled={data.entries.findIndex((e) => e.id === selectedId) <= 0}
          >
            <ArrowUp />
            <span>Move up</span>
          </button>
          <button
            onClick={() => void moveSelected(1)}
            disabled={
              data.entries.findIndex((e) => e.id === selectedId) >=
              data.entries.length - 1
            }
          >
            <ArrowDown />
            <span>Move down</span>
          </button>
          <button
            onClick={() => {
              const entry = data.entries.find((e) => e.id === selectedId);
              if (entry) void remove(entry);
            }}
          >
            <Trash2 />
            <span>Delete</span>
          </button>
        </div>
      )}
      {convertOpen && (
        <div className="dialog-backdrop" role="presentation">
          <form className="dialog" onSubmit={convert}>
            <h2>Convert day to template</h2>
            <p>
              {nameConflict
                ? "A template with this name already exists. Replace it or save an independent copy."
                : "Save this ordered food list as a reusable full day."}
            </p>
            <label>
              Template name
              <input
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  setNameConflict(false);
                }}
                autoFocus
                placeholder="e.g. Cutting Day"
              />
            </label>
            <div>
              <button
                type="button"
                onClick={() => {
                  setConvertOpen(false);
                  setNameConflict(false);
                }}
              >
                Cancel
              </button>
              {nameConflict ? (
                <>
                  <button
                    type="button"
                    onClick={() => void saveTemplate("copy")}
                  >
                    Save copy
                  </button>
                  <button
                    className="primary"
                    type="button"
                    onClick={() => void saveTemplate("replace")}
                  >
                    Replace
                  </button>
                </>
              ) : (
                <button className="primary" type="submit">
                  Save
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
function SortableFoodCard({
  entry,
  category,
  editing,
  selected,
  onSelect,
  onEdit,
}: {
  entry: DayFoodEntry;
  category?: FoodCategory;
  editing: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });
  const cardActivation = editing ? {} : listeners;
  return (
    <article
      ref={setNodeRef}
      className={`food-card ${entry.consumed ? "consumed" : ""} ${selected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      style={
        {
          "--cat": category?.colour,
          transform: CSS.Transform.toString(transform),
          transition,
        } as React.CSSProperties
      }
      onClick={editing ? onSelect : undefined}
      {...cardActivation}
    >
      <button
        className="card-main"
        onClick={onEdit}
        aria-label={`${editing ? "Select" : "Edit"} ${entry.snapshot.name}`}
      >
        <span className="category-stripe" />
        <span className="card-content">
          <strong>{entry.snapshot.name}</strong>
          {entry.recipe ? (
            <small className="recipe-badge">
              Recipe · {entry.recipe.ingredients.length} ingredients
            </small>
          ) : (
            entry.snapshot.brand && <small>{entry.snapshot.brand}</small>
          )}
          <span className="card-metrics">
            <b>
              {entry.snapshot.quantity} <em>{entry.snapshot.unit}</em>
            </b>
            <b>
              {roundCalories(entry.snapshot.calories)} <em>kcal</em>
            </b>
          </span>
          <span className="macros">
            <span>P {roundMacro(entry.snapshot.protein)} g</span>
            <span>C {roundMacro(entry.snapshot.carbohydrates)} g</span>
            <span>F {roundMacro(entry.snapshot.fat)} g</span>
          </span>
        </span>
      </button>
      {editing ? (
        <button
          className="drag-handle"
          aria-label={`Reorder ${entry.snapshot.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </button>
      ) : (
        <button
          className="complete-button"
          aria-label={`${entry.consumed ? "Mark planned" : "Mark consumed"}: ${entry.snapshot.name}`}
          aria-pressed={entry.consumed}
          onClick={() =>
            db.entries.update(entry.id, {
              consumed: !entry.consumed,
              updatedAt: new Date().toISOString(),
            })
          }
        >
          {entry.consumed && <Check />}
        </button>
      )}
    </article>
  );
}
function NutritionSummary({
  totals,
  targets,
}: {
  totals: ReturnType<typeof sumEntries>;
  targets: AppSettings["targets"];
}) {
  const pct = totals.planned.calories
    ? Math.round((totals.consumed.calories / totals.planned.calories) * 100)
    : 0;
  return (
    <section className="summary" aria-label="Daily totals">
      <div
        className="summary-ring"
        style={
          {
            "--progress": `${Math.min(pct, 100) * 3.6}deg`,
          } as React.CSSProperties
        }
      >
        <span>{pct}%</span>
      </div>
      <div className="energy">
        <small>
          CONSUMED / PLANNED · TARGET {roundCalories(targets.calories)}
        </small>
        <strong>
          {roundCalories(totals.consumed.calories)}{" "}
          <em>/ {roundCalories(totals.planned.calories)} kcal</em>
        </strong>
      </div>
      <div className="summary-macros">
        <span>
          <small>PROTEIN · {targets.protein}g</small>
          <b>{roundMacro(totals.planned.protein)}g</b>
        </span>
        <span>
          <small>CARBS · {targets.carbohydrates}g</small>
          <b>{roundMacro(totals.planned.carbohydrates)}g</b>
        </span>
        <span>
          <small>FAT · {targets.fat}g</small>
          <b>{roundMacro(totals.planned.fat)}g</b>
        </span>
      </div>
    </section>
  );
}
function FoodPicker({
  date,
  categories,
  tab,
  onTab,
  replacing = false,
  onClose,
  onCustom,
  onImport,
  onEditFood,
  onSelected,
  onEditTemplate,
  onApplied,
}: {
  date: ISODate;
  categories: FoodCategory[];
  tab: PickerTab;
  onTab: (t: PickerTab) => void;
  replacing?: boolean;
  onClose: () => void;
  onCustom: () => void;
  onImport: () => void;
  onEditFood: (f: Food) => void;
  onSelected: (f: Food) => void;
  onEditTemplate: (t: DietTemplate) => void;
  onApplied: (m: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>();
  const [scheduledTemplate, setScheduledTemplate] = useState<DietTemplate>();
  const [editingSchedule, setEditingSchedule] = useState<TemplateSchedule>();
  const [showSchedules, setShowSchedules] = useState(false);
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const catalogFoods = useLiveQuery(() => db.catalogFoods.toArray(), []) ?? [];
  const templates =
    useLiveQuery(
      () => db.templates.orderBy("updatedAt").reverse().toArray(),
      [],
    ) ?? [];
  const schedules =
    useLiveQuery(
      () => db.schedules.orderBy("updatedAt").reverse().toArray(),
      [],
    ) ?? [];
  const visible = useMemo(
    () =>
      [
        ...foods,
        ...(query.trim().length >= 2
          ? catalogFoods.filter((catalog) => !foods.some((food) => food.source?.externalId === catalog.source.externalId))
          : []),
      ]
        .filter(
          (f) =>
            (!category || f.categoryId === category) &&
            `${f.name} ${f.brand ?? ""} ${f.notes ?? ""} ${categories.find((c) => c.id === f.categoryId)?.name ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (b.lastLoggedAt ?? "").localeCompare(a.lastLoggedAt ?? "") ||
            b.logCount - a.logCount ||
            a.name.localeCompare(b.name),
        ),
    [foods, catalogFoods, category, query, categories],
  );
  const usage = (food: Food) =>
    food.logCount
      ? `${food.logCount} log${food.logCount === 1 ? "" : "s"}${food.lastLoggedAt ? ` · ${format(new Date(food.lastLoggedAt), "d MMM")}` : ""}`
      : "Never logged";
  return (
    <main className="screen picker-screen">
      <header className="modal-header">
        <button
          className="icon-button close"
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </button>
        <h1>{replacing ? "Replace Food" : "Choose Food"}</h1>
        <button
          className="icon-button add"
          onClick={onCustom}
          aria-label="Add custom food"
        >
          <Plus />
        </button>
      </header>
      {!replacing && (
        <div className="segments recipe-segments">
          <button
            className={tab === "foods" ? "active" : ""}
            onClick={() => onTab("foods")}
          >
            Foods
          </button>
          <button
            className={tab === "recipes" ? "active" : ""}
            onClick={() => onTab("recipes")}
          >
            Recipes
          </button>
          <button
            className={tab === "templates" ? "active" : ""}
            onClick={() => onTab("templates")}
          >
            Templates
          </button>
        </div>
      )}
      {tab === "recipes" ? (
        <Suspense fallback={<div className="loading">Loading recipes…</div>}>
          <RecipePanel
            date={date}
            foods={foods}
            categories={categories}
            onLogged={onApplied}
          />
        </Suspense>
      ) : tab === "templates" ? (
        <>
          <label className="search">
            <Search />
            <span className="sr-only">Search templates</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Template name"
            />
          </label>
          <button
            className="schedule-manager-link"
            onClick={() => setShowSchedules(true)}
          >
            <CalendarRange />
            <span>
              <strong>Scheduled plans</strong>
              <small>
                {schedules.length} saved plan{schedules.length === 1 ? "" : "s"}
              </small>
            </span>
            <ChevronRight />
          </button>
          <section className="template-list">
            {templates
              .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
              .map((template) => {
                const calories = template.items.reduce(
                  (sum, item) => sum + item.snapshot.calories,
                  0,
                );
                return (
                  <div className="template-row" key={template.id}>
                    <button
                      className="template-details"
                      onClick={() => onEditTemplate(template)}
                    >
                      <FolderOpen />
                      <span>
                        <strong>{template.name}</strong>
                        <small>
                          {template.items.length} foods ·{" "}
                          {roundCalories(calories)} kcal
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                    <button
                      className="schedule-template"
                      onClick={() => setScheduledTemplate(template)}
                      aria-label={`Schedule ${template.name}`}
                    >
                      <CalendarRange />
                    </button>
                    <button
                      className="log-template"
                      onClick={async () => {
                        const count = await applyTemplate(template, date);
                        onApplied(
                          `Logged ${count} foods from “${template.name}”`,
                        );
                      }}
                    >
                      Log
                    </button>
                  </div>
                );
              })}
            {!templates.length && (
              <div className="template-empty">
                <Leaf />
                <h2>No templates yet</h2>
                <p>
                  Open a populated day’s menu and choose Convert to Template.
                </p>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <label className="search">
            <Search />
            <span className="sr-only">Search foods</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Food name, brand or category"
            />
          </label>
          <div className="chips" aria-label="Filter by category">
            <button
              className={!category ? "selected" : ""}
              onClick={() => setCategory(undefined)}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "selected" : ""}
                onClick={() =>
                  setCategory(category === c.id ? undefined : c.id)
                }
              >
                <i style={{ background: c.colour }} />
                {c.name}
              </button>
            ))}
          </div>
          {!replacing && <div className="food-import-actions" aria-label="Add food from another source">
            <button onClick={onImport}><ScanBarcode/><span><strong>Scan or search</strong><small>Barcode · branded food</small></span></button>
            <button onClick={onImport}><ImagePlus/><span><strong>Import label</strong><small>Photo · manual review</small></span></button>
          </div>}
          <div className="picker-meta">
            <span>{visible.length} foods</span>
            <span>{query.trim().length < 2 ? "Type 2+ letters to search FSANZ" : "Local · FSANZ · A–Z"}</span>
          </div>
          <section className="food-list">
            {visible.map((food) => {
              const cat = categories.find((c) => c.id === food.categoryId);
              return (
                <div className="food-row" key={food.id}>
                  <button
                    className="food-select"
                    onClick={() => onSelected(food)}
                  >
                    <i style={{ background: cat?.colour }} />
                    <span>
                      <strong>{food.name}</strong>
                      <small>
                        {food.brand && `${food.brand} · `}
                        {food.source?.kind === "fsanz"
                          ? `FSANZ ${food.source.datasetVersion} · ${food.source.derivation ?? "reference data"}`
                          : usage(food)}
                      </small>
                    </span>
                    <b>
                      {food.calculationMode === "per100"
                        ? "100 " + food.baseUnit
                        : (food.servingDescription ?? `1 ${food.baseUnit}`)}
                      <small>{roundCalories(food.calories)} kcal</small>
                    </b>
                  </button>
                  <button
                    className="info-button"
                    onClick={() => onEditFood(food)}
                    aria-label={`${food.source?.kind === "fsanz" ? "Review and copy" : "Edit"} ${food.name}`}
                  >
                    <Info />
                  </button>
                </div>
              );
            })}
            {!visible.length && (
              <p className="no-results">
                No foods match. Create a custom food instead.
              </p>
            )}
          </section>
          <button className="floating-add" onClick={onCustom}>
            <Plus /> Custom food
          </button>
        </>
      )}
      {scheduledTemplate && (
        <TemplateScheduleDialog
          template={scheduledTemplate}
          templates={templates}
          initialDate={date}
          onClose={() => setScheduledTemplate(undefined)}
          onApplied={onApplied}
        />
      )}
      {showSchedules && (
        <ScheduleManager
          schedules={schedules}
          templates={templates}
          onClose={() => setShowSchedules(false)}
          onEdit={(schedule) => {
            setEditingSchedule(schedule);
            setShowSchedules(false);
          }}
          onMessage={onApplied}
        />
      )}
      {editingSchedule &&
        (() => {
          const template = templates.find(
            (item) => item.id === editingSchedule.templateId,
          );
          return template ? (
            <TemplateScheduleDialog
              template={template}
              templates={templates}
              initialDate={editingSchedule.start}
              schedule={editingSchedule}
              onClose={() => setEditingSchedule(undefined)}
              onApplied={onApplied}
            />
          ) : null;
        })()}
    </main>
  );
}

function ScheduleManager({
  schedules,
  templates,
  onClose,
  onEdit,
  onMessage,
}: {
  schedules: TemplateSchedule[];
  templates: DietTemplate[];
  onClose: () => void;
  onEdit: (schedule: TemplateSchedule) => void;
  onMessage: (message: string) => void;
}) {
  const [cancelling, setCancelling] = useState<TemplateSchedule>();
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cancel = async (removeFuture: boolean) => {
    if (!cancelling) return;
    const removed = await cancelTemplateSchedule(cancelling.id, removeFuture);
    setCancelling(undefined);
    onClose();
    onMessage(
      removeFuture
        ? `Cancelled plan · removed ${removed} future days`
        : "Cancelled plan · generated days kept",
    );
  };
  return (
    <div className="dialog-backdrop">
      <section
        className="dialog schedule-manager"
        aria-labelledby="schedule-manager-title"
      >
        <h2 id="schedule-manager-title">Scheduled plans</h2>
        <p>Edit future dates without changing today or historical logs.</p>
        {schedules.length ? (
          <div className="scheduled-plan-list">
            {schedules.map((schedule) => {
              const templateExists = templates.some(
                (template) => template.id === schedule.templateId,
              );
              const dates = scheduledTemplateDates(
                schedule.start,
                schedule.weeks,
                schedule.weekdays,
              );
              const exceptionCount = schedule.exceptions?.length ?? 0;
              return (
                <article key={schedule.id}>
                  <span>
                    <strong>{schedule.templateName}</strong>
                    <small>
                      {schedule.weekdays
                        .map((day) => weekdayNames[day])
                        .join(" · ")}{" "}
                      · {schedule.weeks} weeks
                    </small>
                    <small>
                      {format(new Date(`${schedule.start}T12:00:00`), "d MMM")}{" "}
                      –{" "}
                      {format(
                        new Date(`${dates.at(-1)}T12:00:00`),
                        "d MMM yyyy",
                      )}{" "}
                      · {schedule.appliedDates.length} applied
                      {exceptionCount
                        ? ` · ${exceptionCount} exception${exceptionCount === 1 ? "" : "s"}`
                        : ""}
                    </small>
                  </span>
                  <button
                    onClick={() => onEdit(schedule)}
                    disabled={!templateExists}
                  >
                    Edit
                  </button>
                  <button
                    className="cancel-plan"
                    onClick={() => setCancelling(schedule)}
                  >
                    Cancel
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="schedule-empty">
            <CalendarRange />
            <strong>No scheduled plans</strong>
            <small>
              Use the calendar action beside a template to create one.
            </small>
          </div>
        )}
        {cancelling && (
          <div className="cancel-plan-confirm">
            <strong>Cancel {cancelling.templateName}?</strong>
            <small>Historical logs and today are always kept.</small>
            <button onClick={() => void cancel(false)}>
              Keep all generated days
            </button>
            <button className="danger-text" onClick={() => void cancel(true)}>
              Remove future generated days
            </button>
            <button onClick={() => setCancelling(undefined)}>Back</button>
          </div>
        )}
        <div className="dialog-actions">
          <button onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
}

function TemplateScheduleDialog({
  template,
  templates,
  initialDate,
  schedule,
  onClose,
  onApplied,
}: {
  template: DietTemplate;
  templates: DietTemplate[];
  initialDate: ISODate;
  schedule?: TemplateSchedule;
  onClose: () => void;
  onApplied: (message: string) => void;
}) {
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [start, setStart] = useState<ISODate>(schedule?.start ?? initialDate);
  const [weeks, setWeeks] = useState(schedule?.weeks ?? 6);
  const [weekdays, setWeekdays] = useState(
    schedule?.weekdays ?? [1, 2, 3, 4, 5],
  );
  const [replacePopulated, setReplacePopulated] = useState(
    schedule?.replacePopulated ?? false,
  );
  const [exceptions, setExceptions] = useState<ScheduleException[]>(
    schedule?.exceptions ?? [],
  );
  const [error, setError] = useState("");
  const dates = useMemo(() => {
    try {
      return scheduledTemplateDates(start, weeks, weekdays);
    } catch {
      return [];
    }
  }, [start, weeks, weekdays]);
  const conflicts = useLiveQuery(async () => {
    if (!dates.length) return { populated: 0, otherPlans: 0 };
    const omitted = new Set(
      exceptions
        .filter((item) => item.mode === "skip")
        .map((item) => item.date),
    );
    const wanted = new Set(dates.filter((date) => !omitted.has(date)));
    const days = (
      await db.days
        .where("date")
        .between(dates[0]!, dates.at(-1)!, true, true)
        .toArray()
    ).filter((day) => wanted.has(day.date) && day.scheduleId !== schedule?.id);
    const entries = days.length
      ? await db.entries
          .where("dayId")
          .anyOf(days.map((day) => day.id))
          .toArray()
      : [];
    const counts = new Map<string, number>();
    entries.forEach((entry) =>
      counts.set(entry.dayId, (counts.get(entry.dayId) ?? 0) + 1),
    );
    return {
      otherPlans: days.filter(
        (day) => day.scheduleId && (counts.get(day.id) ?? 0) > 0,
      ).length,
      populated: days.filter(
        (day) => !day.scheduleId && (counts.get(day.id) ?? 0) > 0,
      ).length,
    };
  }, [dates.join(","), exceptions, schedule?.id]);
  const availableExceptionDates = dates.filter(
    (date) => !schedule || date > isoDate(new Date()),
  );
  const addException = () => {
    const date = availableExceptionDates.find(
      (value) => !exceptions.some((item) => item.date === value),
    );
    if (date) {
      const exception: ScheduleException = { date, mode: "skip" };
      setExceptions((current) =>
        [...current, exception].sort((a, b) => a.date.localeCompare(b.date)),
      );
    }
  };
  const updateException = (index: number, next: ScheduleException) =>
    setExceptions((current) =>
      current
        .map((item, itemIndex) => (itemIndex === index ? next : item))
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  const toggleDay = (day: number) =>
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const validDates = new Set(dates);
      if (exceptions.some((item) => !validDates.has(item.date)))
        throw new Error("Every exception must fall on a selected schedule day");
      if (
        exceptions.some(
          (item) =>
            item.mode === "template" &&
            !templates.some((template) => template.id === item.templateId),
        )
      )
        throw new Error("Choose a valid substitute template");
      const result = schedule
        ? await updateTemplateSchedule(
            schedule,
            template,
            start,
            weeks,
            weekdays,
            replacePopulated,
            exceptions,
          )
        : await applyTemplateSchedule(
            template,
            start,
            weeks,
            weekdays,
            replacePopulated,
            exceptions,
          );
      onClose();
      onApplied(
        `${schedule ? "Updated" : "Scheduled"} “${template.name}” on ${result.applied} ${schedule ? "future " : ""}days${result.skipped ? ` · skipped ${result.skipped} populated` : ""}`,
      );
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Could not schedule template",
      );
    }
  };
  return (
    <div className="dialog-backdrop">
      <form className="dialog schedule-dialog" onSubmit={submit}>
        <h2>{schedule ? "Edit scheduled plan" : "Schedule template"}</h2>
        <p>
          Apply <strong>{template.name}</strong> across a repeating weekly plan.
          Each day receives an independent copy.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="schedule-fields">
          <label>
            Start date
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label>
            Duration (weeks)
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="52"
              value={weeks}
              onChange={(event) => setWeeks(Number(event.target.value))}
            />
          </label>
        </div>
        <fieldset>
          <legend>Days of week</legend>
          <div className="weekday-picker">
            {weekdayNames.map((name, day) => (
              <button
                key={name}
                type="button"
                className={weekdays.includes(day) ? "selected" : ""}
                aria-pressed={weekdays.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {name.slice(0, 1)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="schedule-preview">
          <CalendarRange />
          <span>
            <strong>
              {dates.length -
                exceptions.filter(
                  (item) => item.mode === "skip" && dates.includes(item.date),
                ).length}{" "}
              planned days
            </strong>
            <small>
              {dates.length
                ? `${format(new Date(`${dates[0]}T12:00:00`), "d MMM")} – ${format(new Date(`${dates.at(-1)}T12:00:00`), "d MMM yyyy")}`
                : "Choose at least one weekday"}
            </small>
          </span>
        </div>
        {conflicts && conflicts.populated + conflicts.otherPlans > 0 && (
          <div className="schedule-conflicts" role="status">
            <strong>
              {conflicts.populated + conflicts.otherPlans} conflicting dates
            </strong>
            {conflicts.populated} ordinary populated · {conflicts.otherPlans}{" "}
            owned by another plan.{" "}
            {replacePopulated
              ? "They will be replaced and reassigned to this plan."
              : "They will be skipped."}
          </div>
        )}
        <fieldset className="schedule-exceptions">
          <legend>Date exceptions</legend>
          <small className="exception-help">
            Skip holidays or use another template once without changing the
            weekly pattern.
          </small>
          {exceptions.map((exception, index) => (
            <div className="exception-row" key={`${exception.date}-${index}`}>
              <input
                aria-label={`Exception ${index + 1} date`}
                type="date"
                min={availableExceptionDates[0]}
                max={availableExceptionDates.at(-1)}
                value={exception.date}
                disabled={Boolean(
                  schedule && exception.date <= isoDate(new Date()),
                )}
                onChange={(event) =>
                  updateException(index, {
                    ...exception,
                    date: event.target.value,
                  })
                }
              />
              <select
                aria-label={`Exception ${index + 1} action`}
                value={
                  exception.mode === "skip"
                    ? "skip"
                    : `template:${exception.templateId}`
                }
                onChange={(event) => {
                  const value = event.target.value;
                  updateException(
                    index,
                    value === "skip"
                      ? { date: exception.date, mode: "skip" }
                      : {
                          date: exception.date,
                          mode: "template",
                          templateId: value.replace("template:", ""),
                          templateName: templates.find(
                            (item) =>
                              item.id === value.replace("template:", ""),
                          )?.name,
                        },
                  );
                }}
              >
                <option value="skip">Skip this day</option>
                {templates
                  .filter((item) => item.id !== template.id)
                  .map((item) => (
                    <option key={item.id} value={`template:${item.id}`}>
                      Use {item.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                aria-label={`Remove exception for ${exception.date}`}
                onClick={() =>
                  setExceptions((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <X />
              </button>
            </div>
          ))}
          <button
            className="add-exception"
            type="button"
            onClick={addException}
            disabled={exceptions.length >= availableExceptionDates.length}
          >
            <Plus />
            Add date exception
          </button>
        </fieldset>
        <label className="replace-days">
          <input
            type="checkbox"
            checked={replacePopulated}
            onChange={(event) => setReplacePopulated(event.target.checked)}
          />
          <span>
            <strong>Replace days that already contain food</strong>
            <small>
              Off by default. Existing populated days will otherwise be skipped.
            </small>
          </span>
        </label>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={!dates.length}>
            {schedule ? "Update future days" : `Schedule ${dates.length} days`}
          </button>
        </div>
      </form>
    </div>
  );
}
function TemplateEditor({
  template,
  onClose,
  onChanged,
  onDeleted,
}: {
  template: DietTemplate;
  onClose: () => void;
  onChanged: (t: DietTemplate) => void;
  onDeleted: () => void;
}) {
  const live =
    useLiveQuery(() => db.templates.get(template.id), [template.id]) ??
    template;
  const [name, setName] = useState(live.name);
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const dragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = live.items.findIndex((i) => i.id === active.id);
    const newIndex = live.items.findIndex((i) => i.id === over.id);
    const ids = arrayMove(live.items, oldIndex, newIndex).map((i) => i.id);
    await reorderTemplateItems(live, ids);
  };
  return (
    <main className="screen template-editor">
      <header className="modal-header">
        <button
          className="icon-button close"
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </button>
        <h1>Edit Template</h1>
        <button
          className="icon-button add"
          aria-label="Save template name"
          onClick={async () => {
            const updated = {
              ...live,
              name: name.trim() || live.name,
              updatedAt: new Date().toISOString(),
            };
            await db.templates.put(updated);
            onChanged(updated);
          }}
        >
          <Check />
        </button>
      </header>
      <div className="template-name">
        <label>
          Template name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <small>Long-press and drag foods to reorder</small>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
      >
        <SortableContext
          items={live.items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <section className="template-items">
            {live.items.map((item) => (
              <SortableTemplateItem
                key={item.id}
                item={item}
                onDelete={async () => {
                  const updated = {
                    ...live,
                    items: live.items
                      .filter((i) => i.id !== item.id)
                      .map((i, index) => ({ ...i, sortIndex: index })),
                    updatedAt: new Date().toISOString(),
                  };
                  await db.templates.put(updated);
                }}
              />
            ))}
          </section>
        </SortableContext>
      </DndContext>
      <button
        className="danger template-delete"
        onClick={async () => {
          await db.templates.delete(live.id);
          onDeleted();
        }}
      >
        <Trash2 />
        Delete template
      </button>
    </main>
  );
}
function SortableTemplateItem({
  item,
  onDelete,
}: {
  item: DietTemplate["items"][number];
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  return (
    <article
      ref={setNodeRef}
      className={`template-item ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="template-grip"
        aria-label={`Reorder ${item.snapshot.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical />
      </button>
      <span>
        <strong>{item.snapshot.name}</strong>
        <small>
          {item.snapshot.quantity} {item.snapshot.unit} ·{" "}
          {roundCalories(item.snapshot.calories)} kcal
        </small>
      </span>
      <button
        className="template-item-delete"
        aria-label={`Remove ${item.snapshot.name}`}
        onClick={onDelete}
      >
        <Trash2 />
      </button>
    </article>
  );
}
function FoodForm({
  food,
  categories,
  onClose,
  onSaved,
}: {
  food?: Food;
  categories: FoodCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(() => ({
    name: food?.name ?? "",
    brand: food?.brand ?? "",
    categoryId: food?.categoryId ?? categories[0]?.id ?? "other",
    calculationMode: food?.calculationMode ?? "per100",
    baseQuantity: String(food?.baseQuantity ?? 100),
    baseUnit: food?.baseUnit ?? "g",
    calories: String(food?.calories ?? ""),
    protein: String(food?.protein ?? ""),
    carbohydrates: String(food?.carbohydrates ?? ""),
    fat: String(food?.fat ?? ""),
    fibre: String(food?.fibre ?? ""),
    servingDescription: food?.servingDescription ?? "",
    notes: food?.notes ?? "",
  }));
  const [error, setError] = useState("");
  const set = (key: string, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!values.name.trim()) throw new Error("Food name is required");
      const nums = [
        values.baseQuantity,
        values.calories,
        values.protein,
        values.carbohydrates,
        values.fat,
      ].map(Number);
      nums.forEach((n, i) =>
        assertNonNegative(
          n,
          ["Base quantity", "Calories", "Protein", "Carbohydrates", "Fat"][i] ??
            "Value",
        ),
      );
      if (nums[0] === 0)
        throw new Error("Base quantity must be greater than zero");
      if (values.fibre !== "") assertNonNegative(Number(values.fibre), "Fibre");
      const now = new Date().toISOString();
      const officialCopy = food?.source?.kind === "fsanz";
      const next: Food = {
        id: officialCopy ? id() : (food?.id ?? id()),
        name: values.name.trim(),
        brand: values.brand.trim() || undefined,
        categoryId: values.categoryId,
        calculationMode: values.calculationMode as Food["calculationMode"],
        baseQuantity: nums[0]!,
        baseUnit: values.baseUnit as FoodUnit,
        calories: nums[1]!,
        protein: nums[2]!,
        carbohydrates: nums[3]!,
        fat: nums[4]!,
        fibre: values.fibre === "" ? undefined : Number(values.fibre),
        servingDescription: values.servingDescription.trim() || undefined,
        notes: values.notes.trim() || undefined,
        barcode: food?.barcode,
        measures: food?.measures,
        source: officialCopy
          ? {
              kind: "custom",
              provider: `User customised from ${food!.source!.provider}`,
              datasetVersion: food!.source!.datasetVersion,
              derivation: food!.source!.derivation,
              importedAt: now,
              sourceUrl: food!.source!.sourceUrl,
              reviewedAt: now,
            }
          : food?.source ? { ...food.source, reviewedAt: now } : undefined,
        logCount: food?.logCount ?? 0,
        lastLoggedAt: food?.lastLoggedAt,
        createdAt: food?.createdAt ?? now,
        updatedAt: now,
      };
      await db.foods.put(next);
      onSaved();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not save food");
    }
  };
  return (
    <FormFrame
      title={food ? "Edit Saved Food" : "New Custom Food"}
      onClose={onClose}
    >
      <form className="editor-form" onSubmit={save}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Field label="Food name">
          <input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Brand (optional)">
          <input
            value={values.brand}
            onChange={(e) => set("brand", e.target.value)}
          />
        </Field>
        <Field label="Category">
          <select
            value={values.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend>Nutrition basis</legend>
          <div className="radio-row">
            <label>
              <input
                type="radio"
                checked={values.calculationMode === "per100"}
                onChange={() =>
                  setValues((v) => ({
                    ...v,
                    calculationMode: "per100",
                    baseQuantity: "100",
                  }))
                }
              />{" "}
              Per 100 g / mL
            </label>
            <label>
              <input
                type="radio"
                checked={values.calculationMode === "perServing"}
                onChange={() =>
                  setValues((v) => ({
                    ...v,
                    calculationMode: "perServing",
                    baseQuantity: "1",
                  }))
                }
              />{" "}
              Per serving
            </label>
          </div>
        </fieldset>
        <div className="form-grid">
          <Field label="Base quantity">
            <NumberInput
              value={values.baseQuantity}
              onChange={(v) => set("baseQuantity", v)}
            />
          </Field>
          <Field label="Unit">
            <select
              value={values.baseUnit}
              onChange={(e) => set("baseUnit", e.target.value)}
            >
              {units.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Calories">
            <NumberInput
              value={values.calories}
              onChange={(v) => set("calories", v)}
            />
          </Field>
          <Field label="Protein (g)">
            <NumberInput
              value={values.protein}
              onChange={(v) => set("protein", v)}
            />
          </Field>
          <Field label="Carbs (g)">
            <NumberInput
              value={values.carbohydrates}
              onChange={(v) => set("carbohydrates", v)}
            />
          </Field>
          <Field label="Fat (g)">
            <NumberInput value={values.fat} onChange={(v) => set("fat", v)} />
          </Field>
        </div>
        <Field label="Fibre (g, optional)">
          <NumberInput value={values.fibre} onChange={(v) => set("fibre", v)} />
        </Field>
        {values.calculationMode === "perServing" && (
          <Field label="Serving description">
            <input
              value={values.servingDescription}
              onChange={(e) => set("servingDescription", e.target.value)}
              placeholder="e.g. 1 slice"
            />
          </Field>
        )}
        <Field label="Notes / aliases">
          <textarea
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
          />
        </Field>
        <button className="primary full" type="submit">
          Save food
        </button>
      </form>
    </FormFrame>
  );
}
function EntryForm({
  date,
  food,
  entry,
  categories,
  onReplace,
  onClose,
  onSaved,
  onDelete,
}: {
  date: ISODate;
  food?: Food;
  entry?: DayFoodEntry;
  categories: FoodCategory[];
  onReplace: () => void;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (e: DayFoodEntry) => void;
}) {
  const [quantity, setQuantity] = useState(
    String(food?.baseQuantity ?? entry?.snapshot.quantity ?? 1),
  );
  const [consumed, setConsumed] = useState(entry?.consumed ?? false);
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState("");
  const selected = food;
  const numericQuantity = Number(quantity);
  const preview =
    Number.isFinite(numericQuantity) && numericQuantity >= 0
      ? selected
        ? calculateNutrients(selected, numericQuantity)
        : entry
          ? resizeSnapshot(entry.snapshot, numericQuantity)
          : undefined
      : undefined;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const q = Number(quantity);
      assertNonNegative(q, "Quantity");
      if (q === 0) throw new Error("Quantity must be greater than zero");
      if (entry && selected) {
        await replaceFoodEntry(entry.id, selected, q);
        await db.entries.update(entry.id, {
          consumed,
          note: note.trim() || undefined,
        });
      } else if (entry) {
        await db.entries.update(entry.id, {
          snapshot: resizeSnapshot(entry.snapshot, q),
          consumed,
          note: note.trim() || undefined,
          updatedAt: new Date().toISOString(),
        });
      } else if (selected) {
        const added = await addFoodToDay(date, selected, q);
        if (consumed || note)
          await db.entries.update(added.id, {
            consumed,
            note: note.trim() || undefined,
          });
      }
      onSaved();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not save entry");
    }
  };
  const name = food?.name ?? entry?.snapshot.name ?? "Food";
  const unit = food?.baseUnit ?? entry?.snapshot.unit;
  const cat = categories.find(
    (c) => c.id === (food?.categoryId ?? entry?.snapshot.categoryId),
  );
  return (
    <FormFrame
      title={entry ? "Edit Food Entry" : "Add to Day"}
      onClose={onClose}
    >
      <form className="entry-editor" onSubmit={save}>
        <div className="selected-food">
          <i style={{ background: cat?.colour }} />
          <span>
            <small>{cat?.name}</small>
            <strong>{name}</strong>
          </span>
          {entry && (
            <button className="replace-food" type="button" onClick={onReplace}>
              <Replace />
              Replace
            </button>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {food?.measures?.length ? (
          <Field label="Common Australian measure">
            <select
              defaultValue=""
              onChange={(event) => {
                const measure = food.measures?.find((item) => item.id === event.target.value);
                if (measure) setQuantity(String(measure.grams));
              }}
            >
              <option value="">Choose a measure…</option>
              {food.measures.map((measure) => (
                <option key={measure.id} value={measure.id}>
                  {measure.label} · {Math.round(measure.grams * 10) / 10} g
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field
          label={
            food?.calculationMode === "perServing"
              ? "Servings / quantity"
              : `Quantity (${unit})`
          }
        >
          <div className="quantity-stepper">
            <button
              type="button"
              onClick={() =>
                setQuantity(String(Math.max(0, Number(quantity) - 1)))
              }
              aria-label="Decrease quantity"
            >
              −
            </button>
            <NumberInput value={quantity} onChange={setQuantity} />
            <button
              type="button"
              onClick={() => setQuantity(String(Number(quantity) + 1))}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </Field>
        {preview && (
          <div className="preview">
            <span>
              <small>ENERGY</small>
              <b>{roundCalories(preview.calories)} kcal</b>
            </span>
            <span>
              <small>PROTEIN</small>
              <b>{roundMacro(preview.protein)} g</b>
            </span>
            <span>
              <small>CARBS</small>
              <b>{roundMacro(preview.carbohydrates)} g</b>
            </span>
            <span>
              <small>FAT</small>
              <b>{roundMacro(preview.fat)} g</b>
            </span>
          </div>
        )}
        <label className="toggle-row">
          <span>
            <strong>Consumed</strong>
            <small>Include in consumed totals</small>
          </span>
          <input
            type="checkbox"
            checked={consumed}
            onChange={(e) => setConsumed(e.target.checked)}
          />
        </label>
        <Field label="Entry note (optional)">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <button className="primary full" type="submit">
          {entry ? "Save changes" : "Add food"}
        </button>
        {entry && (
          <button
            className="danger full"
            type="button"
            onClick={async () => {
              await db.entries.delete(entry.id);
              onDelete(entry);
              onSaved();
            }}
          >
            <Trash2 /> Delete entry
          </button>
        )}
      </form>
    </FormFrame>
  );
}
function FormFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="screen form-screen">
      <header className="modal-header">
        <button
          className="icon-button close"
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </button>
        <h1>{title}</h1>
        <span className="header-spacer" />
      </header>
      {children}
    </main>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function NumberInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
function EntryTransferAction({
  entry,
  sourceDate,
  onTransfer,
}: {
  entry: DayFoodEntry;
  sourceDate: ISODate;
  onTransfer: (targetDate: ISODate, mode: "move" | "copy") => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [targetDate, setTargetDate] = useState(
    isoDate(addDays(new Date(`${sourceDate}T12:00:00`), 1)),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const transfer = async (mode: "move" | "copy") => {
    try {
      if (!targetDate || targetDate === sourceDate)
        throw new Error("Choose a different date");
      setBusy(true);
      await onTransfer(targetDate, mode);
    } catch (ex) {
      setBusy(false);
      setError(ex instanceof Error ? ex.message : "Could not transfer food");
    }
  };
  return (
    <>
      <button
        className="entry-transfer-trigger icon-button"
        aria-label={`Move or copy ${entry.snapshot.name}`}
        onClick={() => setOpen(true)}
      >
        <CalendarDays />
      </button>
      {open && (
        <div className="dialog-backdrop">
          <div
            className="dialog transfer-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-title"
          >
            <h2 id="transfer-title">Move or copy food</h2>
            <p>
              Choose a destination for <strong>{entry.snapshot.name}</strong>. A
              copy starts as not consumed.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <label>
              Destination date
              <input
                type="date"
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  setError("");
                }}
                autoFocus
              />
            </label>
            <div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void transfer("copy")}
                disabled={busy}
              >
                <Copy />
                Copy
              </button>
              <button
                className="primary"
                type="button"
                onClick={() => void transfer("move")}
                disabled={busy}
              >
                <MoveRight />
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function CalendarScreen({
  selectedDate,
  categories,
  weekStartsOn,
  onSelectDate,
  onOpenDay,
}: {
  selectedDate: Date;
  categories: FoodCategory[];
  weekStartsOn: 0 | 1;
  onSelectDate: (d: Date) => void;
  onOpenDay: (d: Date) => void;
}) {
  const [month, setMonth] = useState(startOfMonth(selectedDate));
  const grid = monthGrid(month, weekStartsOn);
  const firstIso = isoDate(grid[0] ?? month);
  const lastIso = isoDate(grid.at(-1) ?? month);
  const history = useLiveQuery(async () => {
    const days = await db.days
      .where("date")
      .between(firstIso, lastIso, true, true)
      .toArray();
    const entries = days.length
      ? await db.entries
          .where("dayId")
          .anyOf(days.map((d) => d.id))
          .toArray()
      : [];
    const schedules = await db.schedules.orderBy("updatedAt").toArray();
    return { days, entries, schedules };
  }, [firstIso, lastIso]);
  const selectedIso = isoDate(selectedDate);
  const selectedDay = history?.days.find((d) => d.date === selectedIso);
  const scheduleMap = new Map(
    history?.schedules.map((item) => [item.id, item]) ?? [],
  );
  const scheduleProjections = new Map<string, { schedule:TemplateSchedule; exception?:ScheduleException; conflict:boolean }>();
  for (const schedule of history?.schedules ?? []) {
    for (const date of scheduledTemplateDates(schedule.start,schedule.weeks,schedule.weekdays)) {
      if(date<firstIso||date>lastIso)continue;
      const exception=schedule.exceptions?.find(item=>item.date===date);
      const conflict=schedule.skippedDates.includes(date)&&exception?.mode!=="skip";
      if(schedule.appliedDates.includes(date)||exception||conflict) scheduleProjections.set(date,{schedule,exception,conflict});
    }
  }
  const selectedProjection = selectedDay?.scheduleId
    ? { schedule:scheduleMap.get(selectedDay.scheduleId)!, exception:scheduleMap.get(selectedDay.scheduleId)?.exceptions?.find(item=>item.date===selectedIso), conflict:false }
    : scheduleProjections.get(selectedIso);
  const selectedEntries =
    (selectedDay
      ? history?.entries.filter((e) => e.dayId === selectedDay.id)
      : []) ?? [];
  const totals = sumEntries(selectedEntries);
  const dayByDate = new Map(history?.days.map((day) => [day.date, day]) ?? []);
  const entriesByDay = new Map<string, DayFoodEntry[]>();
  for (const entry of history?.entries ?? []) {
    const group = entriesByDay.get(entry.dayId) ?? [];
    group.push(entry);
    entriesByDay.set(entry.dayId, group);
  }
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const choose = (date: Date) => {
    onSelectDate(date);
    if (!isSameMonth(date, month)) setMonth(startOfMonth(date));
  };
  const weekdays =
    weekStartsOn === 1
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <main className="screen calendar-screen">
      <header className="brand-bar calendar-header">
        <span className="brand-mark">
          <CalendarDays />
          History
        </span>
        <button
          className="today-button"
          onClick={() => {
            const today = new Date();
            setMonth(startOfMonth(today));
            onSelectDate(today);
          }}
        >
          Today
        </button>
      </header>
      <section className="month-section">
        <div className="month-nav">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => setMonth(subMonths(month, 1))}
          >
            <ChevronLeft />
          </button>
          <label>
            <span className="sr-only">Choose month</span>
            <input
              type="month"
              value={format(month, "yyyy-MM")}
              onChange={(e) => {
                if (e.target.value) {
                  const [year, monthIndex] = e.target.value
                    .split("-")
                    .map(Number);
                  setMonth(new Date(year!, monthIndex! - 1, 1));
                }
              }}
            />
            <strong>{format(month, "MMMM yyyy")}</strong>
          </label>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight />
          </button>
        </div>
        <div className="weekdays" aria-hidden="true">
          {weekdays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="month-grid">
          {grid.map((day) => {
            const dayIso = isoDate(day);
            const log = dayByDate.get(dayIso);
            const dayEntries = log ? (entriesByDay.get(log.id) ?? []) : [];
            const dots = [
              ...new Set(dayEntries.map((e) => e.snapshot.categoryId)),
            ].slice(0, 3);
            const projection = log?.scheduleId
              ? {schedule:scheduleMap.get(log.scheduleId),exception:scheduleMap.get(log.scheduleId)?.exceptions?.find(item=>item.date===dayIso),conflict:false}
              : scheduleProjections.get(dayIso);
            const scheduled=projection?.schedule;
            const scheduleState=projection?.exception?.mode==="skip"?"schedule-skip":projection?.exception?.mode==="template"?"schedule-substitute":projection?.conflict?"schedule-conflict":"";
            return (
              <button
                key={dayIso}
                className={`${!isSameMonth(day, month) ? "outside" : ""} ${isSameDay(day, selectedDate) ? "selected" : ""} ${isSameDay(day, new Date()) ? "today" : ""} ${scheduled ? "scheduled" : ""} ${scheduleState}`}
                onClick={() => choose(day)}
                aria-label={`${format(day, "d MMMM yyyy")}${dayEntries.length ? `, ${dayEntries.length} foods` : ""}${scheduled ? `, ${projection?.exception?.mode==="skip"?"skipped from":projection?.exception?.mode==="template"?`substituted with ${projection.exception.templateName}, scheduled from`:projection?.conflict?"schedule conflict from":"scheduled from"} ${scheduled.templateName}` : ""}`}
              >
                <span>{format(day, "d")}</span>
                <i>
                  {dots.map((catId) => (
                    <b
                      key={catId}
                      style={{ background: categoryMap.get(catId)?.colour }}
                    />
                  ))}
                </i>
              </button>
            );
          })}
        </div>
      </section>
      <section className="history-preview">
        <div className="preview-date">
          <button
            className="icon-button"
            aria-label="Previous date"
            onClick={() => choose(subDays(selectedDate, 1))}
          >
            <ChevronLeft />
          </button>
          <div>
            <h2>{dateLabel(selectedDate)}</h2>
            <small>{format(selectedDate, "EEEE, d MMMM")}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Next date"
            onClick={() => choose(addDays(selectedDate, 1))}
          >
            <ChevronRight />
          </button>
        </div>
        {selectedProjection?.schedule && <div className={`scheduled-day-label ${selectedProjection.exception?.mode??(selectedProjection.conflict?"conflict":"")}`}><CalendarRange/><span><strong>{selectedProjection.exception?.mode==="skip"?"Skipped schedule date":selectedProjection.exception?.mode==="template"?"Template substitution":selectedProjection.conflict?"Schedule conflict":"Scheduled plan"}</strong><small>{selectedProjection.schedule.templateName}{selectedProjection.exception?.mode==="template"?` → ${selectedProjection.exception.templateName}`:""}</small></span></div>}
        {selectedEntries.length ? (
          <>
            <div className="history-total">
              <strong>{roundCalories(totals.planned.calories)} kcal</strong>
              <span>
                P {roundMacro(totals.planned.protein)} · C{" "}
                {roundMacro(totals.planned.carbohydrates)} · F{" "}
                {roundMacro(totals.planned.fat)}
              </span>
            </div>
            <div className="history-foods">
              {selectedEntries
                .sort((a, b) => a.sortIndex - b.sortIndex)
                .map((entry) => (
                  <div key={entry.id}>
                    <i
                      style={{
                        background: categoryMap.get(entry.snapshot.categoryId)
                          ?.colour,
                      }}
                    />
                    <span>
                      <strong>{entry.snapshot.name}</strong>
                      <small>
                        {entry.snapshot.quantity} {entry.snapshot.unit}
                      </small>
                    </span>
                    <b>
                      {roundCalories(entry.snapshot.calories)}
                      <small>kcal</small>
                    </b>
                    {entry.consumed && <Check aria-label="Consumed" />}
                  </div>
                ))}
            </div>
            <button
              className="open-day"
              onClick={() => onOpenDay(selectedDate)}
            >
              Open editable day <ChevronRight />
            </button>
          </>
        ) : (
          <div className="history-empty">
            <CalendarDays />
            <p>{selectedProjection?.exception?.mode==="skip"?"This date is intentionally skipped by the plan.":selectedProjection?.conflict?"The plan skipped this date because it already contained food.":"No foods logged for this day."}</p>
            <button onClick={() => onOpenDay(selectedDate)}>Open day</button>
          </div>
        )}
      </section>
    </main>
  );
}
function BodyScreen({
  unit,
  onToast,
}: {
  unit: WeightUnit;
  onToast: (toast: Toast) => void;
}) {
  const entries =
    useLiveQuery(() => db.weights.orderBy("date").toArray(), []) ?? [];
  const [editing, setEditing] = useState<WeightEntry | "new">();
  const points = withSevenDayAverage(entries);
  const latest = points.at(-1);
  const change = weightChange(entries);
  const shown = (kg: number) => displayWeight(kg, unit).toFixed(1);
  const remove = async (entry: WeightEntry) => {
    await db.weights.delete(entry.id);
    onToast({
      message: `Weight for ${format(new Date(`${entry.date}T12:00:00`), "d MMM")} deleted`,
      undo: async () => {
        await db.weights.put(entry);
      },
    });
  };
  return (
    <main className="screen body-screen">
      <header className="brand-bar">
        <span className="brand-mark">
          <Scale />
          Body
        </span>
        <button
          className="icon-button"
          aria-label="Add weight"
          onClick={() => setEditing("new")}
        >
          <Plus />
        </button>
      </header>
      {entries.length ? (
        <>
          <section className="body-summary">
            <div>
              <small>LATEST</small>
              <strong>
                {latest && shown(latest.weightKg)} <em>{unit}</em>
              </strong>
              <span>
                {latest &&
                  format(new Date(`${latest.date}T12:00:00`), "d MMMM")}
              </span>
            </div>
            <div>
              <small>7-DAY AVERAGE</small>
              <strong>
                {latest && shown(latest.rollingAverageKg)} <em>{unit}</em>
              </strong>
              <span
                className={
                  change !== undefined && change <= 0 ? "positive" : ""
                }
              >
                <TrendingDown />
                {change === undefined
                  ? "Add another entry"
                  : `${change > 0 ? "+" : ""}${shown(change)} ${unit} overall`}
              </span>
            </div>
          </section>
          <WeightTrend points={points} unit={unit} />
          <section className="weight-history">
            <header>
              <h2>Weight history</h2>
              <span>{entries.length} entries</span>
            </header>
            {[...entries].reverse().map((entry) => (
              <article key={entry.id}>
                <div className="weight-date">
                  <strong>
                    {format(new Date(`${entry.date}T12:00:00`), "d")}
                  </strong>
                  <span>
                    {format(new Date(`${entry.date}T12:00:00`), "MMM")}
                    <small>
                      {format(new Date(`${entry.date}T12:00:00`), "yyyy")}
                    </small>
                  </span>
                </div>
                <div className="weight-value">
                  <strong>
                    {shown(entry.weightKg)} <small>{unit}</small>
                  </strong>
                  {entry.note && <p>{entry.note}</p>}
                </div>
                <button
                  aria-label={`Edit weight for ${entry.date}`}
                  onClick={() => setEditing(entry)}
                >
                  <Pencil />
                </button>
                <button
                  aria-label={`Delete weight for ${entry.date}`}
                  onClick={() => void remove(entry)}
                >
                  <Trash2 />
                </button>
              </article>
            ))}
          </section>
        </>
      ) : (
        <section className="body-empty">
          <Scale />
          <h1>Track your weight</h1>
          <p>
            Add measurements over time to see your seven-day rolling average.
            Your data stays on this device.
          </p>
          <button className="primary" onClick={() => setEditing("new")}>
            <Plus />
            Add first weight
          </button>
        </section>
      )}
      {editing && (
        <WeightEditor
          entry={editing === "new" ? undefined : editing}
          unit={unit}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            onToast({ message: "Weight saved" });
          }}
        />
      )}
    </main>
  );
}
function WeightTrend({
  points,
  unit,
}: {
  points: ReturnType<typeof withSevenDayAverage>;
  unit: WeightUnit;
}) {
  const recent = points.slice(-30);
  if (!recent.length) return null;
  const values = recent.flatMap((point) => [
    point.weightKg,
    point.rollingAverageKg,
  ]);
  const min = Math.min(...values) - 0.5,
    max = Math.max(...values) + 0.5,
    range = Math.max(max - min, 1);
  const coords = (key: "weightKg" | "rollingAverageKg") =>
    recent
      .map(
        (point, index) =>
          `${18 + (index / Math.max(recent.length - 1, 1)) * 324},${116 - ((point[key] - min) / range) * 88}`,
      )
      .join(" ");
  return (
    <section
      className="weight-chart"
      aria-label="Weight trend for recent entries"
    >
      <header>
        <h2>Trend</h2>
        <span>
          <i />
          Weight <i />
          7-day average
        </span>
      </header>
      <svg
        viewBox="0 0 360 135"
        role="img"
        aria-label={`Weight from ${displayWeight(recent[0]?.weightKg ?? 0, unit).toFixed(1)} to ${displayWeight(recent.at(-1)?.weightKg ?? 0, unit).toFixed(1)} ${unit}`}
      >
        <line x1="18" y1="28" x2="342" y2="28" />
        <line x1="18" y1="72" x2="342" y2="72" />
        <line x1="18" y1="116" x2="342" y2="116" />
        <polyline
          className="average-line"
          points={coords("rollingAverageKg")}
        />
        <polyline className="weight-line" points={coords("weightKg")} />
        {recent.map((point, index) => (
          <circle
            key={point.id}
            cx={18 + (index / Math.max(recent.length - 1, 1)) * 324}
            cy={116 - ((point.weightKg - min) / range) * 88}
            r="3"
          />
        ))}
      </svg>
    </section>
  );
}
function WeightEditor({
  entry,
  unit,
  onClose,
  onSaved,
}: {
  entry?: WeightEntry;
  unit: WeightUnit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(entry?.date ?? isoDate(new Date()));
  const [weight, setWeight] = useState(
    entry ? displayWeight(entry.weightKg, unit).toFixed(1) : "",
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveWeight(date, weightInputToKg(Number(weight), unit), note);
      if (entry && entry.date !== date) await db.weights.delete(entry.id);
      onSaved();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not save weight");
    }
  };
  return (
    <div className="dialog-backdrop">
      <form className="dialog weight-dialog" onSubmit={submit}>
        <h2>{entry ? "Edit weight" : "Add weight"}</h2>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Date
          <input
            type="date"
            value={date}
            max="9999-12-31"
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Weight ({unit})
          <input
            type="number"
            inputMode="decimal"
            min="0.1"
            max={unit === "kg" ? 500 : 1102}
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Note (optional)
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How are you feeling?"
          />
        </label>
        <div>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
type ChartPeriod = "all" | "year" | "month" | "week" | "day" | "custom";
function ChartsScreen({ categories }: { categories: FoodCategory[] }) {
  const [tab, setTab] = useState<"breakdown" | "trends" | "foods">("breakdown");
  const [period, setPeriod] = useState<ChartPeriod>("all");
  const [customFrom, setCustomFrom] = useState(
    isoDate(subDays(new Date(), 30)),
  );
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const [breakdownMode, setBreakdownMode] = useState<"category" | "macros">(
    "category",
  );
  const [trend, setTrend] = useState<
    "calories" | "protein" | "carbohydrates" | "fat" | "weight"
  >("calories");
  const [selectedSegment, setSelectedSegment] = useState<string>();
  const analytics = useLiveQuery(async () => {
    const days = await db.days.toArray();
    const entries = await db.entries.toArray();
    const weights = await db.weights.toArray();
    const dateByDay = new Map(days.map((day) => [day.id, day.date]));
    return {
      items: entries.flatMap((entry) => {
        const date = dateByDay.get(entry.dayId);
        return date ? [{ date, entry }] : [];
      }) as DatedEntry[],
      weights,
    };
  }, []);
  const today = new Date();
  const starts: Record<Exclude<ChartPeriod, "all" | "custom">, string> = {
    year: isoDate(startOfYear(today)),
    month: isoDate(startOfMonth(today)),
    week: isoDate(startOfWeek(today, { weekStartsOn: 1 })),
    day: isoDate(today),
  };
  const inRange = (date: string) =>
    period === "all" || period === "custom"
      ? period === "all" || (date >= customFrom && date <= customTo)
      : date >= starts[period];
  const items = (analytics?.items ?? []).filter((item) => inRange(item.date));
  const weights = (analytics?.weights ?? []).filter((item) =>
    inRange(item.date),
  );
  const categoryLabels = new Map(categories.map((c) => [c.id, c.name]));
  const breakdown =
    breakdownMode === "category"
      ? categoryBreakdown(items, categoryLabels)
      : macroCalorieBreakdown(items);
  const palette = [
    "#b7f36b",
    "#46a8ff",
    "#ff6b75",
    "#9b8cff",
    "#ffb84d",
    "#4dd4a5",
    "#f27ac2",
    "#d5c7a1",
  ];
  const colourFor = (item: BreakdownItem, index: number) =>
    breakdownMode === "category"
      ? (categories.find((c) => c.id === item.id)?.colour ??
        palette[index % palette.length])
      : ({ protein: "#ff6b75", carbohydrates: "#9b8cff", fat: "#f6c453" }[
          item.id
        ] ?? palette[index % palette.length]);
  const total = breakdown.reduce((sum, item) => sum + item.value, 0);
  let cumulative = 0;
  const gradient = breakdown.length
    ? `conic-gradient(${breakdown
        .map((item, index) => {
          const start = cumulative;
          cumulative += total ? (item.value / total) * 100 : 0;
          return `${colourFor(item, index)} ${start}% ${cumulative}%`;
        })
        .join(",")})`
    : "conic-gradient(#252c31 0 100%)";
  const selected =
    breakdown.find((item) => item.id === selectedSegment) ?? breakdown[0];
  const days = dailyNutrition(items);
  const foodStats = foodStatistics(items);
  const weightPoints = withSevenDayAverage(weights);
  const trendItems =
    trend === "weight"
      ? weightPoints.map((point) => ({
          date: point.date,
          value: point.weightKg,
          average: point.rollingAverageKg,
        }))
      : days.map((day) => ({ date: day.date, value: day[trend] }));
  return (
    <main className="screen charts-screen">
      <header className="brand-bar">
        <span className="brand-mark">
          <BarChart3 />
          Charts
        </span>
      </header>
      <div className="chart-tabs">
        <button
          className={tab === "breakdown" ? "active" : ""}
          onClick={() => setTab("breakdown")}
        >
          <PieChart />
          Breakdown
        </button>
        <button
          className={tab === "trends" ? "active" : ""}
          onClick={() => setTab("trends")}
        >
          <BarChart3 />
          Trends
        </button>
        <button
          className={tab === "foods" ? "active" : ""}
          onClick={() => setTab("foods")}
        >
          <List />
          Foods
        </button>
      </div>
      <div className="period-tabs">
        {(
          ["all", "year", "month", "week", "day", "custom"] as ChartPeriod[]
        ).map((value) => (
          <button
            key={value}
            className={period === value ? "active" : ""}
            onClick={() => setPeriod(value)}
          >
            {value[0]?.toUpperCase()}
            {value.slice(1)}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="custom-range">
          <label>
            From
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <span>→</span>
          <label>
            To
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {tab === "breakdown" && (
        <section className="breakdown-screen">
          <div className="metric-toggle">
            <button
              className={breakdownMode === "category" ? "active" : ""}
              onClick={() => setBreakdownMode("category")}
            >
              Calories by category
            </button>
            <button
              className={breakdownMode === "macros" ? "active" : ""}
              onClick={() => setBreakdownMode("macros")}
            >
              Macro split
            </button>
          </div>
          {breakdown.length ? (
            <>
              <div className="donut-wrap">
                <div className="donut" style={{ background: gradient }}>
                  <div>
                    <strong>{selected?.label}</strong>
                    <b>
                      {roundCalories(selected?.value ?? 0)}
                      <small>kcal</small>
                    </b>
                    <span>
                      {total
                        ? (((selected?.value ?? 0) / total) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </div>
              <div className="breakdown-total">
                <span>Total</span>
                <strong>{roundCalories(total)} kcal</strong>
              </div>
              <div className="breakdown-list">
                {breakdown.map((item, index) => (
                  <button
                    key={item.id}
                    className={selected?.id === item.id ? "selected" : ""}
                    onClick={() => setSelectedSegment(item.id)}
                  >
                    <i style={{ background: colourFor(item, index) }} />
                    <span>{item.label}</span>
                    <b>
                      {roundCalories(item.value)}
                      <small>
                        {total ? ((item.value / total) * 100).toFixed(1) : 0}%
                      </small>
                    </b>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <AnalyticsEmpty />
          )}
        </section>
      )}
      {tab === "trends" && (
        <section className="trends-screen">
          <div className="trend-metrics">
            {(
              ["calories", "protein", "carbohydrates", "fat", "weight"] as const
            ).map((metric) => (
              <button
                key={metric}
                className={trend === metric ? "active" : ""}
                onClick={() => setTrend(metric)}
              >
                {metric === "carbohydrates"
                  ? "Carbs"
                  : metric[0]?.toUpperCase() + metric.slice(1)}
              </button>
            ))}
          </div>
          {trendItems.length ? (
            <>
              <div className="trend-heading">
                <span>
                  {trend === "weight" ? "Body weight" : `Daily ${trend}`}
                </span>
                <strong>
                  {trendItems
                    .at(-1)
                    ?.value.toFixed(trend === "calories" ? 0 : 1)}{" "}
                  {trend === "calories"
                    ? "kcal"
                    : trend === "weight"
                      ? "kg"
                      : "g"}
                </strong>
              </div>
              <SimpleLineChart
                items={trendItems}
                secondary={trend === "weight"}
              />
            </>
          ) : (
            <AnalyticsEmpty />
          )}
        </section>
      )}
      {tab === "foods" && (
        <section className="food-stats">
          <header>
            <span>Most frequently logged</span>
            <b>{foodStats.length} foods</b>
          </header>
          {foodStats.length ? (
            foodStats.map((food, index) => (
              <article key={food.id}>
                <span className="rank">{index + 1}</span>
                <Utensils />
                <div>
                  <strong>{food.name}</strong>
                  <small>
                    {food.logs} log{food.logs === 1 ? "" : "s"} · avg{" "}
                    {roundMacro(food.averageQuantity)} {food.unit} · last{" "}
                    {format(new Date(`${food.lastDate}T12:00:00`), "d MMM")}
                  </small>
                </div>
                <b>
                  {roundCalories(food.calories)}
                  <small>kcal</small>
                  <em>{roundMacro(food.protein)}g P</em>
                </b>
              </article>
            ))
          ) : (
            <AnalyticsEmpty />
          )}
        </section>
      )}
    </main>
  );
}
function SimpleLineChart({
  items,
  secondary,
}: {
  items: {
    date: string;
    value: number;
    average?: number;
  }[];
  secondary?: boolean;
}) {
  const values = items.flatMap((item) =>
    secondary && item.average !== undefined
      ? [item.value, item.average]
      : [item.value],
  );
  const min = Math.min(...values),
    max = Math.max(...values),
    range = Math.max(max - min, 1);
  const point = (value: number, index: number) =>
    `${18 + (index / Math.max(items.length - 1, 1)) * 324},${122 - ((value - min) / range) * 88}`;
  const line = items.map((item, index) => point(item.value, index)).join(" ");
  const average = secondary
    ? items
        .map((item, index) => point(item.average ?? item.value, index))
        .join(" ")
    : undefined;
  return (
    <div className="analytics-line">
      <svg
        viewBox="0 0 360 150"
        role="img"
        aria-label={`Trend with ${items.length} data points`}
      >
        <line x1="18" y1="34" x2="342" y2="34" />
        <line x1="18" y1="78" x2="342" y2="78" />
        <line x1="18" y1="122" x2="342" y2="122" />
        {average && <polyline className="secondary" points={average} />}
        <polyline points={line} />
        {items.map((item, index) => (
          <circle
            key={`${item.date}-${index}`}
            cx={18 + (index / Math.max(items.length - 1, 1)) * 324}
            cy={122 - ((item.value - min) / range) * 88}
            r="3"
          />
        ))}
      </svg>
      <div>
        <span>{format(new Date(`${items[0]?.date}T12:00:00`), "d MMM")}</span>
        <span>
          {format(new Date(`${items.at(-1)?.date}T12:00:00`), "d MMM")}
        </span>
      </div>
    </div>
  );
}
function AnalyticsEmpty() {
  return (
    <div className="analytics-empty">
      <BarChart3 />
      <h2>Not enough data yet</h2>
      <p>Log foods or body weight in this date range to see analytics.</p>
    </div>
  );
}
function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function backupFilename(prefix = "nutri-notes-backup") {
  return `${prefix}-${isoDate(new Date())}.json`;
}
function SettingsScreen({
  categories,
  settings,
  dropbox,
  googleDrive,
  onToast,
}: {
  categories: FoodCategory[];
  settings: AppSettings;
  dropbox: DropboxBackupController;
  googleDrive: GoogleDriveBackupController;
  onToast: (toast: Toast) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupData>();
  const [importName, setImportName] = useState("");
  const [editingCategory, setEditingCategory] = useState<
    FoodCategory | "new"
  >();
  const exportBackup = async (prefix?: string) => {
    const backup = await createFullBackup();
    const filename = backupFilename(prefix);
    const text = JSON.stringify(backup, null, 2);
    downloadText(
      filename,
      text,
      "application/json",
    );
    return backup;
  };
  const shareBackup = async () => {
    const backup = await createFullBackup();
    const filename = backupFilename();
    const text = JSON.stringify(backup, null, 2);
    const file = new File([text], filename, { type: "application/json" });
    const shareData = { files: [file], title: "Nutri Notes backup" };
    let fileSharingSupported = typeof navigator.share === "function";

    if (fileSharingSupported && typeof navigator.canShare === "function") {
      try {
        fileSharingSupported = navigator.canShare({ files: [file] });
      } catch {
        fileSharingSupported = false;
      }
    }

    if (fileSharingSupported) {
      try {
        await navigator.share(shareData);
        onToast({ message: "Backup shared" });
        return;
      } catch (ex) {
        if (ex instanceof DOMException && ex.name === "AbortError") return;
      }
    }

    downloadText(filename, text, "application/json");
    onToast({ message: "Sharing unavailable · backup downloaded" });
  };
  const csvExport = async (name: keyof ReturnType<typeof createCsvExports>) => {
    const backup = await createFullBackup();
    const files = createCsvExports(backup);
    downloadText(name, files[name], "text/csv;charset=utf-8");
    onToast({ message: `Exported ${name}` });
  };
  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      setPending(parsed);
      setImportName(file.name);
    } catch (ex) {
      onToast({
        message: ex instanceof Error ? ex.message : "Could not read backup",
      });
    }
  };
  const performImport = async (mode: "merge" | "replace") => {
    if (!pending) return;
    try {
      if (mode === "replace") await exportBackup("nutri-notes-before-replace");
      await importFullBackup(pending, mode);
      setPending(undefined);
      onToast({ message: `Imported ${importName} (${mode})` });
    } catch (ex) {
      onToast({ message: ex instanceof Error ? ex.message : "Import failed" });
    }
  };
  const restoreDropbox = async () => {
    try {
      const backup = await dropbox.restoreLatest();
      setPending(backup);
      setImportName("Dropbox · nutri-notes-latest.json");
    } catch (ex) {
      onToast({
        message: ex instanceof Error ? ex.message : "Dropbox restore failed",
      });
    }
  };
  const restoreGoogleDrive = async () => {
    try {
      const backup = await googleDrive.restoreLatest();
      setPending(backup);
      setImportName("Google Drive · nutri-notes-latest.json");
    } catch (ex) {
      onToast({
        message:
          ex instanceof Error ? ex.message : "Google Drive restore failed",
      });
    }
  };
  return (
    <main className="screen settings-screen">
      <header className="brand-bar">
        <span className="brand-mark">
          <Settings />
          Settings
        </span>
      </header>
      <PreferencesEditor
        settings={settings}
        onSaved={() => onToast({ message: "Preferences saved" })}
      />
      <section className="settings-group category-settings">
        <header>
          <Tags />
          <span>
            <strong>Food categories</strong>
            <small>
              Names and colours update pickers, cards and analytics.
            </small>
          </span>
          <button
            aria-label="Add category"
            onClick={() => setEditingCategory("new")}
          >
            <Plus />
          </button>
        </header>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setEditingCategory(category)}
          >
            <i style={{ background: category.colour }} />
            <span>
              <strong>{category.name}</strong>
              <small>{category.colour}</small>
            </span>
            <Pencil />
          </button>
        ))}
      </section>
      <section className="settings-intro">
        <ShieldCheck />
        <div>
          <strong>Private by design</strong>
          <p>
            No required account or analytics. Data stays local unless you
            optionally connect your own cloud storage for automatic backups.
          </p>
        </div>
      </section>
      <section className="settings-group cloud-backup-settings">
        <header>
          <Cloud />
          <span>
            <strong>Automatic Dropbox backup</strong>
            <small>
              {dropbox.connected
                ? `Connected${dropbox.accountName ? ` as ${dropbox.accountName}` : ""}.`
                : "Optional · stored in your private Nutri Notes App Folder."}
            </small>
          </span>
        </header>
        {dropbox.connected ? (
          <>
            <div className="cloud-backup-status" role="status">
              <span className={dropbox.lastError ? "error" : "ready"}>
                {dropbox.busy
                  ? "Backing up…"
                  : dropbox.lastError
                    ? "Backup needs attention"
                    : "Automatic backup is on"}
              </span>
              <small>
                {dropbox.lastError
                  ? dropbox.lastError
                  : dropbox.lastBackupAt
                    ? `Last backup ${format(new Date(dropbox.lastBackupAt), "d MMM, h:mm a")}`
                    : "The first backup will run automatically."}
              </small>
              {dropbox.accountEmail && <small>{dropbox.accountEmail}</small>}
            </div>
            <button
              disabled={dropbox.busy || !navigator.onLine}
              onClick={async () => {
                try {
                  await dropbox.backupNow();
                  onToast({ message: "Dropbox backup finished" });
                } catch (ex) {
                  onToast({
                    message:
                      ex instanceof Error ? ex.message : "Dropbox backup failed",
                  });
                }
              }}
            >
              <CloudUpload />
              <span>
                <strong>Back up now</strong>
                <small>Update today’s file and the latest backup.</small>
              </span>
              <ChevronRight />
            </button>
            <button
              disabled={dropbox.busy || !navigator.onLine}
              onClick={() => void restoreDropbox()}
            >
              <CloudDownload />
              <span>
                <strong>Restore from Dropbox</strong>
                <small>Review before merging or replacing local data.</small>
              </span>
              <ChevronRight />
            </button>
            <button
              className="dropbox-disconnect"
              disabled={dropbox.busy}
              onClick={async () => {
                await dropbox.disconnect();
                onToast({ message: "Dropbox disconnected · local data kept" });
              }}
            >
              <Unlink />
              <span>
                <strong>Disconnect Dropbox</strong>
                <small>Cloud files and local nutrition data are kept.</small>
              </span>
              <ChevronRight />
            </button>
          </>
        ) : (
          <button
            disabled={dropbox.busy || !navigator.onLine}
            onClick={async () => {
              try {
                await dropbox.connect();
              } catch (ex) {
                onToast({
                  message:
                    ex instanceof Error
                      ? ex.message
                      : "Dropbox connection could not start",
                });
              }
            }}
          >
            <CloudUpload />
            <span>
              <strong>Connect your Dropbox</strong>
              <small>Authorise Nutri Notes to use only its App Folder.</small>
            </span>
            <ChevronRight />
          </button>
        )}
      </section>
      <section className="settings-group cloud-backup-settings">
        <header>
          <Cloud />
          <span>
            <strong>Automatic Google Drive backup</strong>
            <small>
              {googleDrive.connected
                ? googleDrive.needsReconnect
                  ? "Reconnect to resume queued backups."
                  : `Connected${googleDrive.accountName ? ` as ${googleDrive.accountName}` : ""}.`
                : "Optional · stored in your private Drive App Data Folder."}
            </small>
          </span>
        </header>
        {googleDrive.connected ? (
          <>
            <div className="cloud-backup-status" role="status">
              <span
                className={
                  googleDrive.lastError || googleDrive.needsReconnect
                    ? "error"
                    : "ready"
                }
              >
                {googleDrive.busy
                  ? "Backing up…"
                  : googleDrive.needsReconnect
                    ? "Reconnect required"
                    : googleDrive.lastError
                      ? "Backup needs attention"
                      : "Automatic backup is on"}
              </span>
              <small>
                {googleDrive.lastError
                  ? googleDrive.lastError
                  : googleDrive.lastBackupAt
                    ? `Last backup ${format(new Date(googleDrive.lastBackupAt), "d MMM, h:mm a")}`
                    : "The first backup will run after connecting."}
              </small>
              {googleDrive.accountEmail && (
                <small>{googleDrive.accountEmail}</small>
              )}
            </div>
            {googleDrive.needsReconnect ? (
              <button
                disabled={
                  googleDrive.busy ||
                  !googleDrive.ready ||
                  !navigator.onLine
                }
                onClick={async () => {
                  try {
                    await googleDrive.connect();
                    onToast({ message: "Google Drive reconnected" });
                  } catch (ex) {
                    onToast({
                      message:
                        ex instanceof Error
                          ? ex.message
                          : "Google Drive reconnection failed",
                    });
                  }
                }}
              >
                <CloudUpload />
                <span>
                  <strong>Reconnect Google Drive</strong>
                  <small>Resume queued automatic backups.</small>
                </span>
                <ChevronRight />
              </button>
            ) : (
              <button
                disabled={googleDrive.busy || !navigator.onLine}
                onClick={async () => {
                  try {
                    await googleDrive.backupNow();
                    onToast({ message: "Google Drive backup finished" });
                  } catch (ex) {
                    onToast({
                      message:
                        ex instanceof Error
                          ? ex.message
                          : "Google Drive backup failed",
                    });
                  }
                }}
              >
                <CloudUpload />
                <span>
                  <strong>Back up now</strong>
                  <small>Update today’s file and the latest backup.</small>
                </span>
                <ChevronRight />
              </button>
            )}
            <button
              disabled={
                googleDrive.busy ||
                googleDrive.needsReconnect ||
                !navigator.onLine
              }
              onClick={() => void restoreGoogleDrive()}
            >
              <CloudDownload />
              <span>
                <strong>Restore from Google Drive</strong>
                <small>Review before merging or replacing local data.</small>
              </span>
              <ChevronRight />
            </button>
            <button
              className="cloud-disconnect"
              disabled={googleDrive.busy}
              onClick={async () => {
                await googleDrive.disconnect();
                onToast({
                  message: "Google Drive disconnected · local data kept",
                });
              }}
            >
              <Unlink />
              <span>
                <strong>Disconnect Google Drive</strong>
                <small>Cloud files and local nutrition data are kept.</small>
              </span>
              <ChevronRight />
            </button>
          </>
        ) : (
          <button
            disabled={
              googleDrive.busy || !googleDrive.ready || !navigator.onLine
            }
            onClick={async () => {
              try {
                await googleDrive.connect();
                onToast({ message: "Google Drive connected" });
              } catch (ex) {
                onToast({
                  message:
                    ex instanceof Error
                      ? ex.message
                      : "Google Drive connection could not start",
                });
              }
            }}
          >
            <CloudUpload />
            <span>
              <strong>
                {googleDrive.ready
                  ? "Connect your Google Drive"
                  : "Loading Google connection…"}
              </strong>
              <small>
                Authorise only the hidden Nutri Notes app-data folder.
              </small>
            </span>
            <ChevronRight />
          </button>
        )}
      </section>
      <section className="settings-group">
        <header>
          <Database />
          <span>
            <strong>Full backup</strong>
            <small>
              Versioned JSON containing foods, categories, templates, logs and
              weight.
            </small>
          </span>
        </header>
        <button
          onClick={() => void shareBackup()}
        >
          <Share2 />
          <span>
            <strong>Share or save backup</strong>
            <small>Choose Files, iCloud Drive, Google Drive or Dropbox.</small>
          </span>
          <ChevronRight />
        </button>
        <button
          onClick={async () => {
            await exportBackup();
            onToast({ message: "Full backup downloaded" });
          }}
        >
          <FileJson />
          <span>
            <strong>Download JSON backup</strong>
            <small>Save directly through the browser.</small>
          </span>
          <Download />
        </button>
        <button onClick={() => fileInput.current?.click()}>
          <Upload />
          <span>
            <strong>Import JSON backup</strong>
            <small>Validate, merge, or replace local data.</small>
          </span>
          <ChevronRight />
        </button>
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          aria-label="Choose JSON backup to import"
          onChange={chooseFile}
        />
      </section>
      <section className="settings-group">
        <header>
          <FileSpreadsheet />
          <span>
            <strong>CSV exports</strong>
            <small>
              Spreadsheet-compatible UTF-8 files with typed numeric columns.
            </small>
          </span>
        </header>
        {(["day_totals.csv", "food_entries.csv", "weight.csv"] as const).map(
          (name) => (
            <button key={name} onClick={() => void csvExport(name)}>
              <FileSpreadsheet />
              <span>
                <strong>{name}</strong>
                <small>
                  {name === "day_totals.csv"
                    ? "One row per logged date."
                    : name === "food_entries.csv"
                      ? "Every ordered food snapshot."
                      : "Dated body-weight history."}
                </small>
              </span>
              <Download />
            </button>
          ),
        )}
      </section>
      <section className="settings-about">
        <h2>About Nutri Notes</h2>
        <p>
          Local-first nutrition logging. Seed nutrition values are editable
          placeholders, not authoritative nutritional advice.
        </p>
      </section>
      {editingCategory && (
        <CategoryEditor
          category={editingCategory === "new" ? undefined : editingCategory}
          categories={categories}
          onClose={() => setEditingCategory(undefined)}
          onSaved={() => {
            setEditingCategory(undefined);
            onToast({ message: "Category saved" });
          }}
        />
      )}
      {pending && (
        <div className="dialog-backdrop">
          <div className="dialog import-dialog">
            <h2>Import backup?</h2>
            <p>
              <strong>{importName}</strong> contains {pending.days.length} days,{" "}
              {pending.entries.length} food entries, {pending.foods.length}{" "}
              foods and {pending.weights.length} weight entries.
            </p>
            <div className="import-warning">
              <ShieldCheck />
              <span>
                Replace automatically downloads your current data first. Merge
                keeps existing records and updates matching IDs.
              </span>
            </div>
            <div>
              <button onClick={() => setPending(undefined)}>Cancel</button>
              <button onClick={() => void performImport("merge")}>Merge</button>
              <button
                className="primary"
                onClick={() => void performImport("replace")}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function PreferencesEditor({
  settings,
  onSaved,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(settings);
  useEffect(() => setValue(settings), [settings]);
  const target = (key: keyof AppSettings["targets"], next: string) =>
    setValue((current) => ({
      ...current,
      targets: { ...current.targets, [key]: Number(next) },
    }));
  const save = async () => {
    await saveAppSettings(value);
    onSaved();
  };
  return (
    <section className="preferences">
      <header>
        <Paintbrush />
        <span>
          <strong>Preferences</strong>
          <small>Appearance, units, calendar, copying and daily targets.</small>
        </span>
      </header>
      <label>
        <span>Appearance</span>
        <select
          value={value.appearance}
          onChange={(e) =>
            setValue({
              ...value,
              appearance: e.target.value as AppSettings["appearance"],
            })
          }
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </label>
      <label>
        <span>Accent colour</span>
        <input
          type="color"
          value={value.accentColour}
          onChange={(e) => setValue({ ...value, accentColour: e.target.value })}
        />
      </label>
      <label>
        <span>Body weight</span>
        <select
          value={value.weightUnit}
          onChange={(e) =>
            setValue({ ...value, weightUnit: e.target.value as WeightUnit })
          }
        >
          <option value="kg">Kilograms (kg)</option>
          <option value="lb">Pounds (lb)</option>
        </select>
      </label>
      <label>
        <span>Week starts</span>
        <select
          value={value.weekStartsOn}
          onChange={(e) =>
            setValue({
              ...value,
              weekStartsOn: Number(e.target.value) as 0 | 1,
            })
          }
        >
          <option value={1}>Monday</option>
          <option value={0}>Sunday</option>
        </select>
      </label>
      <label>
        <span>Copy consumed foods</span>
        <select
          value={value.copyConsumedState}
          onChange={(e) =>
            setValue({
              ...value,
              copyConsumedState: e.target
                .value as AppSettings["copyConsumedState"],
            })
          }
        >
          <option value="reset">Reset to planned</option>
          <option value="preserve">Preserve consumed state</option>
        </select>
      </label>
      <fieldset>
        <legend>
          <Target />
          Daily targets
        </legend>
        <div>
          {(["calories", "protein", "carbohydrates", "fat"] as const).map(
            (key) => (
              <label key={key}>
                <span>{key === "carbohydrates" ? "Carbs" : key}</span>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={value.targets[key]}
                  onChange={(e) => target(key, e.target.value)}
                />
                <small>{key === "calories" ? "kcal" : "g"}</small>
              </label>
            ),
          )}
        </div>
      </fieldset>
      <button className="primary" onClick={() => void save()}>
        Save preferences
      </button>
    </section>
  );
}
function CategoryEditor({
  category,
  categories,
  onClose,
  onSaved,
}: {
  category?: FoodCategory;
  categories: FoodCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const alternatives = categories.filter((item) => item.id !== category?.id);
  const [name, setName] = useState(category?.name ?? "");
  const [colour, setColour] = useState(category?.colour ?? "#46a8ff");
  const [replacement, setReplacement] = useState(alternatives[0]?.id ?? "");
  const [error, setError] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Category name is required");
      return;
    }
    if (
      categories.some(
        (item) =>
          item.id !== category?.id &&
          item.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setError("Category name already exists");
      return;
    }
    await db.categories.put({
      id: category?.id ?? id(),
      name: trimmed,
      colour,
      sortIndex: category?.sortIndex ?? categories.length,
    });
    onSaved();
  };
  const move = async (offset: -1 | 1) => {
    if (!category) return;
    await reorderCategory(category.id, offset);
    onSaved();
  };
  const remove = async () => {
    try {
      if (!category || !replacement)
        throw new Error("Choose a replacement category");
      await deleteCategory(category.id, replacement);
      onSaved();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not delete category");
    }
  };
  const index = category
    ? categories.findIndex((item) => item.id === category.id)
    : -1;
  return (
    <div className="dialog-backdrop">
      <form className="dialog category-dialog" onSubmit={save}>
        <h2>{category ? "Edit category" : "New category"}</h2>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Colour
          <input
            type="color"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
          />
        </label>
        {category && (
          <section className="category-management">
            <div>
              <button
                type="button"
                onClick={() => void move(-1)}
                disabled={index <= 0}
              >
                <ArrowUp />
                Move up
              </button>
              <button
                type="button"
                onClick={() => void move(1)}
                disabled={index >= categories.length - 1}
              >
                <ArrowDown />
                Move down
              </button>
            </div>
            <label>
              Reassign foods when deleting
              <select
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              >
                {alternatives.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="category-delete"
              type="button"
              onClick={() => void remove()}
              disabled={!replacement}
            >
              <Trash2 />
              Delete and reassign
            </button>
          </section>
        )}
        <div>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
function BottomNav({
  active,
  onNav,
}: {
  active: Route;
  onNav: (r: Route) => void;
}) {
  const items: [Route, typeof UserRound, string][] = [
    ["body", UserRound, "Body"],
    ["calendar", CalendarDays, "Calendar"],
    ["day", Plus, "Food"],
    ["charts", BarChart3, "Charts"],
    ["settings", Settings, "Settings"],
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map(([route, Icon, label]) => (
        <button
          key={route}
          className={`${active === route ? "active" : ""} ${route === "day" ? "central" : ""}`}
          onClick={() => onNav(route)}
          aria-current={active === route ? "page" : undefined}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
