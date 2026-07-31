import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
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
  ChevronDown,
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
  importWeightMeasurements,
  ensureFoodCatalog,
  importFullBackup,
  isoDate,
  reorderCategory,
  reorderDayEntries,
  reorderTemplateItems,
  refreshFoodEntriesForDay,
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
  roundMacro,
  sumEntries,
} from "./domain/nutrition";
import { monthGrid } from "./domain/calendar";
import {
  aggregateWeightsByDay,
  displayWeight,
  weightChange,
  weightInputToKg,
  withSevenDayAverage,
} from "./domain/body";
import {
  inspectWeightCsv,
  parseWeightCsv,
  type DateOrder,
  type WeightCsvInspection,
} from "./domain/weightImport";
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
import { energyValue } from "./domain/energy";
import { per100Units, servingUnits, unitForMode } from "./domain/foodUnits";
import { foodUnitLabel, formatFoodQuantity } from "./domain/foodQuantity";
import { foodSearchScore, matchesFoodSearch } from "./domain/foodSearch";
import { EnergyDisplayProvider, EnergyText, useEnergyDisplay } from "./energyDisplay";
import { EnergyInput } from "./energyInput";
import { NumericInput } from "./NumericInput";
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
function DayCarouselPanel({
  dayDate,
  dayValue,
  active,
  categories,
  settings,
  onMoveDate,
  onPick,
  onTemplates,
  onCopy,
  onEdit,
  onToast,
}: {
  dayDate: ISODate;
  dayValue: Date;
  active: boolean;
  categories: FoodCategory[];
  settings: AppSettings;
  onMoveDate: (date: Date) => void;
  onPick: () => void;
  onTemplates: () => void;
  onCopy: (date: ISODate) => Promise<void>;
  onEdit: (entry: DayFoodEntry) => void;
  onToast: (toast: Toast) => void;
}) {
  const dayData = useDay(dayDate);
  return (
    <div
      className="day-carousel-panel"
      aria-hidden={active ? undefined : "true"}
      ref={element => { if (element) element.inert = !active; }}
    >
      <DayScreen
        date={dayDate}
        selectedDate={dayValue}
        data={dayData}
        active={active}
        categories={categories}
        settings={settings}
        onMoveDate={onMoveDate}
        onPick={onPick}
        onTemplates={onTemplates}
        onCopy={() => onCopy(dayDate)}
        onEdit={onEdit}
        onToast={onToast}
      />
    </div>
  );
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
  const appShellRef = useRef<HTMLDivElement>(null);
  const dayTrackRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef(route);
  const dayTransitioning = useRef(false);
  const suppressSwipeClickUntil = useRef(0);
  const suppressSwipeClickTarget = useRef<Element>();
  const dropbox = useDropboxBackup();
  const googleDrive = useGoogleDriveBackup(route === "settings");
  const date = isoDate(selectedDate);
  const previousDate = isoDate(subDays(selectedDate, 1));
  const nextDate = isoDate(addDays(selectedDate, 1));
  routeRef.current = route;
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
    document.documentElement.classList.toggle("tracking-scroll-locked", route === "day");
    return () => document.documentElement.classList.remove("tracking-scroll-locked");
  }, [route]);
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
  useEffect(() => {
    const shell = appShellRef.current;
    if (!shell) return;
    let swipe: { x:number; y:number; startedAt:number; onCard:boolean; target:Element } | undefined;
    const excluded = "input, textarea, select, [role='slider'], [data-no-screen-swipe], .chips, .period-tabs, .trend-metrics, .drag-handle, .ingredient-grip, .template-grip";
    const start = (event:TouchEvent) => {
      if (routeRef.current !== "day" || event.touches.length !== 1 || dayTransitioning.current) return;
      const target = event.target as Element;
      if (target.closest(excluded)) return;
      const touch = event.touches[0]!;
      swipe = { x:touch.clientX, y:touch.clientY, startedAt:performance.now(), onCard:Boolean(target.closest(".food-card")), target };
    };
    const move = (event:TouchEvent) => {
      if (!swipe || event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const dx = touch.clientX - swipe.x;
      const dy = touch.clientY - swipe.y;
      const heldCard = swipe.onCard && performance.now() - swipe.startedAt > 300;
      if (!heldCard && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        event.preventDefault();
        const width = shell.clientWidth;
        const resisted = Math.sign(dx) * Math.min(Math.abs(dx), width);
        dayTrackRef.current?.style.setProperty("--day-drag", `${resisted}px`);
      }
    };
    const end = (event:TouchEvent) => {
      const started = swipe;
      swipe = undefined;
      const touch = event.changedTouches[0];
      const track = dayTrackRef.current;
      if (!started || !touch || routeRef.current !== "day" || !track) return;
      const dx = touch.clientX - started.x;
      const dy = touch.clientY - started.y;
      const duration = performance.now() - started.startedAt;
      const width = shell.clientWidth;
      const horizontal = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15;
      const heldCard = started.onCard && duration > 300;
      const velocity = Math.abs(dx) / Math.max(duration, 1);
      const changeDay = horizontal && !heldCard && (Math.abs(dx) > width * .28 || velocity > .5);
      const destination = changeDay ? Math.sign(dx) * width : 0;
      if (horizontal && !heldCard) {
        event.preventDefault();
        suppressSwipeClickUntil.current = performance.now() + 450;
        suppressSwipeClickTarget.current = started.target;
      }
      track.style.transition = "transform 260ms cubic-bezier(.22,.8,.24,1)";
      track.style.setProperty("--day-drag", `${destination}px`);
      if (!changeDay) {
        window.setTimeout(() => { track.style.transition = ""; }, 270);
        return;
      }
      dayTransitioning.current = true;
      window.setTimeout(() => {
        track.style.transition = "none";
        flushSync(() => {
          setSelectedDate(current => addDays(current, dx < 0 ? 1 : -1));
        });
        track.style.setProperty("--day-drag", "0px");
        requestAnimationFrame(() => requestAnimationFrame(() => {
          track.style.transition = "";
          dayTransitioning.current = false;
        }));
      }, 260);
    };
    const cancel = () => {
      swipe = undefined;
      const track = dayTrackRef.current;
      if (track) {
        track.style.transition = "transform 220ms ease-out";
        track.style.setProperty("--day-drag", "0px");
        window.setTimeout(() => { track.style.transition = ""; }, 230);
      }
    };
    shell.addEventListener("touchstart", start, { passive:true });
    shell.addEventListener("touchmove", move, { passive:false });
    shell.addEventListener("touchend", end, { passive:false });
    shell.addEventListener("touchcancel", cancel);
    return () => {
      shell.removeEventListener("touchstart", start);
      shell.removeEventListener("touchmove", move);
      shell.removeEventListener("touchend", end);
      shell.removeEventListener("touchcancel", cancel);
    };
  }, []);
  const clearZeroForEditing=(event:React.KeyboardEvent<HTMLDivElement>)=>{
    const input=event.target;
    if(event.key!=="Backspace"||!(input instanceof HTMLInputElement)||input.type!=="number"||input.value!=="0")return;
    event.preventDefault();
    input.value="";
  };
  const clearZeroBeforeInput=(event:React.FormEvent<HTMLDivElement>)=>{
    const native=event.nativeEvent as InputEvent;
    const input=event.target;
    if(native.inputType!=="deleteContentBackward"||!(input instanceof HTMLInputElement)||input.type!=="number"||input.value!=="0")return;
    event.preventDefault();
    input.value="";
  };
  const openPicker = (tab: PickerTab) => { setPickerTab(tab); setRoute("picker"); };
  const copyDay = async (dayDate: ISODate) => {
    const count = await copyPreviousDay(dayDate, appSettings.copyConsumedState === "preserve");
    setToast({ message:count ? `Copied ${count} foods` : "No previous day to copy" });
  };
  const editDayEntry = (entry: DayFoodEntry) => {
    setEditingFood(undefined);
    setEditingEntry(entry);
    setRoute(entry.recipe ? "recipeEntry" : "entryForm");
  };
  const dayPanels = [
    { dayDate: previousDate, dayValue: subDays(selectedDate, 1), active:false },
    { dayDate: date, dayValue:selectedDate, active:true },
    { dayDate: nextDate, dayValue: addDays(selectedDate, 1), active:false },
  ];
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
    <EnergyDisplayProvider
      unit={appSettings.energyUnit ?? "kcal"}
      toggle={() => {
        const energyUnit = (appSettings.energyUnit ?? "kcal") === "kcal" ? "kJ" : "kcal";
        void saveAppSettings({ ...appSettings, energyUnit });
      }}
    >
    <div ref={appShellRef} className={`app-shell ${route === "day" ? "tracking-active" : ""}`} onKeyDownCapture={clearZeroForEditing} onBeforeInputCapture={clearZeroBeforeInput} onClickCapture={event=>{const target=event.target as Node;const swiped=suppressSwipeClickTarget.current;if(performance.now()<suppressSwipeClickUntil.current&&swiped&&(swiped===target||swiped.contains(target))){event.preventDefault();event.stopPropagation();suppressSwipeClickTarget.current=undefined}}}>
      {isPrimaryRoute(route) && (
        <div className="tracking-layer" aria-hidden={route!=="day"||undefined} ref={element=>{if(element)element.inert=route!=="day"}}>
          <div className="day-carousel">
            <div ref={dayTrackRef} className="day-carousel-track">
              {dayPanels.map(panel => (
                <DayCarouselPanel
                  key={panel.dayDate}
                  {...panel}
                  categories={categories}
                  settings={appSettings}
                  onMoveDate={setSelectedDate}
                  onPick={() => openPicker("foods")}
                  onTemplates={() => openPicker("templates")}
                  onCopy={copyDay}
                  onEdit={editDayEntry}
                  onToast={setToast}
                />
              ))}
            </div>
          </div>
        </div>
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
          date={date}
          categories={categories}
          onClose={() => setRoute("picker")}
          onSaved={() => setRoute("picker")}
          onDeleted={(name) => {
            setEditingFood(undefined);
            setToast({ message: `${name} deleted from saved foods` });
            setRoute("picker");
          }}
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
      {route === "calendar" && <AuxiliaryOverlay label="Calendar" onMinimise={goDay}>
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
      </AuxiliaryOverlay>}
      {route === "body" && <AuxiliaryOverlay label="Body" onMinimise={goDay}>
        <BodyScreen unit={appSettings.weightUnit} onToast={setToast} />
      </AuxiliaryOverlay>}
      {route === "charts" && <AuxiliaryOverlay label="Charts" onMinimise={goDay}><ChartsScreen categories={categories} weightUnit={appSettings.weightUnit} /></AuxiliaryOverlay>}
      {route === "settings" && <AuxiliaryOverlay label="Settings" onMinimise={goDay}>
        <SettingsScreen
          categories={categories}
          settings={appSettings}
          dropbox={dropbox}
          googleDrive={googleDrive}
          onToast={setToast}
        />
      </AuxiliaryOverlay>}
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
    </EnergyDisplayProvider>
  );
}
function DayScreen({
  date,
  selectedDate,
  data,
  active = true,
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
  active?: boolean;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(()=>new Set());
  useEffect(() => { if(!active)setSelectedIds(new Set()); }, [active,date]);
  useEffect(() => {
    document.documentElement.classList.toggle("day-edit-mode", active && selectedIds.size > 0);
    return () => document.documentElement.classList.remove("day-edit-mode");
  }, [active, selectedIds.size]);
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
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
  const editing = selectedIds.size>0;
  const selectedId = selectedIds.size===1?[...selectedIds][0]:undefined;
  const removeSelected = async () => {
    const entries=data.entries.filter(entry=>selectedIds.has(entry.id));
    if(!entries.length)return;
    await db.entries.bulkDelete(entries.map(entry=>entry.id));
    setSelectedIds(new Set());
    onToast({
      message: entries.length===1?`${entries[0]!.snapshot.name} deleted`:`${entries.length} entries deleted`,
      undo: async () => {
        await db.entries.bulkPut(entries);
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
    setSelectedIds(new Set([String(active.id)]));
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
        <NutritionSummary totals={totals} targets={settings.targets} hasIncompleteMacros={data.entries.some(entry=>entry.snapshot.unavailableNutrients?.some(key=>key!=="fibre"))} />
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
            setSelectedIds(new Set([String(active.id)]));
            navigator.vibrate?.(15);
          }}
          onDragEnd={dragEnd}
          onDragCancel={() => setSelectedIds(new Set())}
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
                  selected={selectedIds.has(entry.id)}
                  canReorder={selectedIds.size===1}
                  onLongPress={()=>{setSelectedIds(new Set([entry.id]));navigator.vibrate?.(15)}}
                  onEdit={()=>editing?setSelectedIds(current=>{const next=new Set(current);if(next.has(entry.id))next.delete(entry.id);else next.add(entry.id);return next}):onEdit(entry)}
                />
              ))}
              <button className="add-another" onClick={onPick}>
                <Plus /> Add food or recipe
              </button>
            </section>
          </SortableContext>
        </DndContext>
      )}
      {editing && createPortal(
        <div className="edit-toolbar" role="toolbar" aria-label={`Edit ${selectedIds.size} selected ${selectedIds.size===1?"entry":"entries"}`}>
          <button onClick={() => setSelectedIds(new Set())}>
            <Check />
            <span>Done</span>
          </button>
          <button
            onClick={() => void moveSelected(-1)}
            disabled={selectedIds.size!==1||data.entries.findIndex((e) => e.id === selectedId) <= 0}
          >
            <ArrowUp />
            <span>Move up</span>
          </button>
          <button
            onClick={() => void moveSelected(1)}
            disabled={
              selectedIds.size!==1||data.entries.findIndex((e) => e.id === selectedId) >=
              data.entries.length - 1
            }
          >
            <ArrowDown />
            <span>Move down</span>
          </button>
          <button
            onClick={() => void removeSelected()}
          >
            <Trash2 />
            <span>Delete{selectedIds.size>1?` ${selectedIds.size}`:""}</span>
          </button>
        </div>,
        document.body,
      )}
      {convertOpen && (
        <div className="dialog-backdrop" role="presentation">
          <form className="dialog template-convert-dialog" onSubmit={convert}>
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
  canReorder,
  onLongPress,
  onEdit,
}: {
  entry: DayFoodEntry;
  category?: FoodCategory;
  editing: boolean;
  selected: boolean;
  canReorder: boolean;
  onLongPress: () => void;
  onEdit: () => void;
}) {
  const longPressTimer=useRef<number>();
  const longPressOrigin=useRef<{x:number;y:number}>();
  const longPressed=useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled:editing&&!canReorder });
  const cancelLongPress=()=>{if(longPressTimer.current!==undefined)window.clearTimeout(longPressTimer.current);longPressTimer.current=undefined};
  const startLongPress=(event:React.TouchEvent<HTMLElement>)=>{
    if(editing||event.touches.length!==1)return;
    const touch=event.touches[0]!;
    longPressOrigin.current={x:touch.clientX,y:touch.clientY};
    longPressed.current=false;
    cancelLongPress();
    longPressTimer.current=window.setTimeout(()=>{longPressTimer.current=undefined;longPressed.current=true;onLongPress()},420);
  };
  const moveLongPress=(event:React.TouchEvent<HTMLElement>)=>{
    const origin=longPressOrigin.current;
    const touch=event.touches[0];
    if(!origin||!touch)return;
    if(Math.hypot(touch.clientX-origin.x,touch.clientY-origin.y)>8)cancelLongPress();
  };
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
      onTouchStart={startLongPress}
      onTouchMove={moveLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
    >
      <button
        className="card-main"
        onClick={()=>{if(longPressed.current){longPressed.current=false;return}onEdit()}}
        aria-label={`${editing ? selected?"Deselect":"Select" : "Edit"} ${entry.snapshot.name}`}
        aria-pressed={editing?selected:undefined}
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
              {entry.snapshot.quantity}{" "}<em>{foodUnitLabel(entry.snapshot.quantity, entry.snapshot.unit)}</em>
            </b>
            <b>
              <EnergyText calories={entry.snapshot.calories} />
            </b>
          </span>
          <span className="macros">
            <span>P {entry.snapshot.unavailableNutrients?.includes("protein")?"—":`${roundMacro(entry.snapshot.protein)} g`}</span>
            <span>C {entry.snapshot.unavailableNutrients?.includes("carbohydrates")?"—":`${roundMacro(entry.snapshot.carbohydrates)} g`}</span>
            <span>F {entry.snapshot.unavailableNutrients?.includes("fat")?"—":`${roundMacro(entry.snapshot.fat)} g`}</span>
          </span>
        </span>
      </button>
      {editing ? (
        <button
          className="drag-handle"
          aria-label={`Reorder ${entry.snapshot.name}`}
          disabled={!canReorder}
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
  hasIncompleteMacros,
}: {
  totals: ReturnType<typeof sumEntries>;
  targets: AppSettings["targets"];
  hasIncompleteMacros?: boolean;
}) {
  const { unit, toggle } = useEnergyDisplay();
  const [flashing, setFlashing] = useState(false);
  const pct = totals.planned.calories
    ? Math.round((totals.consumed.calories / totals.planned.calories) * 100)
    : 0;
  return (
    <section className={`summary ${flashing ? "energy-flash" : ""}`} aria-label="Daily totals">
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
          CONSUMED / PLANNED · TARGET <EnergyText calories={targets.calories} />
        </small>
        <strong>
          <EnergyText calories={totals.consumed.calories} />{" "}
          <em>/ <EnergyText calories={totals.planned.calories} /></em>
        </strong>
      </div>
      <button
        className="energy-unit-toggle"
        type="button"
        onClick={() => {
          toggle();
          navigator.vibrate?.(15);
          setFlashing(false);
          requestAnimationFrame(() => setFlashing(true));
          window.setTimeout(() => setFlashing(false), 520);
        }}
        aria-label={`Energy shown in ${unit === "kcal" ? "kilocalories" : "kilojoules"}. Switch to ${unit === "kcal" ? "kilojoules" : "kilocalories"}`}
      >
        <b>{unit}</b>
        <small>tap</small>
      </button>
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
      {hasIncompleteMacros&&<small className="partial-macro-note">Macro totals exclude foods whose source only publishes energy.</small>}
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
            matchesFoodSearch(`${f.name} ${f.brand ?? ""} ${f.notes ?? ""} ${categories.find((c) => c.id === f.categoryId)?.name ?? ""}`,query),
        )
        .sort(
          (a, b) => {
            if(query.trim()){
              const secondaryA=`${a.brand??""} ${a.notes??""} ${categories.find(category=>category.id===a.categoryId)?.name??""}`;
              const secondaryB=`${b.brand??""} ${b.notes??""} ${categories.find(category=>category.id===b.categoryId)?.name??""}`;
              const relevance=foodSearchScore(b.name,query,secondaryB)-foodSearchScore(a.name,query,secondaryA);
              if(relevance)return relevance;
            }
            return (b.lastLoggedAt ?? "").localeCompare(a.lastLoggedAt ?? "") || b.logCount - a.logCount || a.name.localeCompare(b.name);
          },
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
                          <EnergyText calories={calories} />
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
          <div className="chips" role="group" aria-label="Filter by category">
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
            <button onClick={onImport}><ScanBarcode/><span><strong>Scan or search</strong><small>Barcode · branded · fast food</small></span></button>
            <button onClick={onImport}><ImagePlus/><span><strong>Import label</strong><small>Photo · manual review</small></span></button>
          </div>}
          <div className="picker-meta">
            <span>{visible.length} foods</span>
            <span>{query.trim().length < 2 ? "Search saved + Australian generic foods" : "Saved · FSANZ generic · A–Z"}</span>
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
                        ? `${food.baseQuantity} ${food.baseUnit}`
                        : (food.servingDescription ?? `1 ${food.baseUnit}`)}
                      <small><EnergyText calories={food.calories} /></small>
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
            <NumericInput
              inputMode="numeric"
              min="1"
              max="52"
              value={weeks}
              onValueChange={setWeeks}
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
          {formatFoodQuantity(item.snapshot.quantity, item.snapshot.unit)} ·{" "}
          <EnergyText calories={item.snapshot.calories} />
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
  date,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: {
  food?: Food;
  date: ISODate;
  categories: FoodCategory[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (name: string) => void;
}) {
  const [values, setValues] = useState(() => ({
    name: food?.name ?? "",
    brand: food?.brand ?? "",
    categoryId: food?.categoryId ?? categories[0]?.id ?? "other",
    calculationMode: food?.calculationMode ?? "per100",
    baseQuantity: String(food?.baseQuantity ?? 100),
    baseUnit: food ? unitForMode(food.calculationMode, food.baseUnit) : "g",
    calories: String(food?.calories ?? ""),
    protein: String(food?.protein ?? ""),
    carbohydrates: String(food?.carbohydrates ?? ""),
    fat: String(food?.fat ?? ""),
    fibre: String(food?.fibre ?? ""),
    servingDescription: food?.servingDescription ?? "",
    notes: food?.notes ?? "",
  }));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
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
          ["Base quantity", "Energy", "Protein", "Carbohydrates", "Fat"][i] ??
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
      if(food&&!officialCopy)await refreshFoodEntriesForDay(date,next);
      onSaved();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not save food");
    }
  };
  const remove = async () => {
    if (!food) return;
    try {
      const recipe = await db.recipes.filter((item) => item.ingredients.some((ingredient) => ingredient.foodId === food.id)).first();
      if (recipe) throw new Error(`Remove this food from ${recipe.name} before deleting it`);
      await db.foods.delete(food.id);
      onDeleted(food.name);
    } catch (ex) {
      setConfirmDelete(false);
      setError(ex instanceof Error ? ex.message : "Could not delete food");
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
                    baseUnit: unitForMode("per100", v.baseUnit as FoodUnit),
                  }))
                }
              />{" "}
              By weight / volume
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
                    baseUnit: unitForMode("perServing", v.baseUnit as FoodUnit),
                  }))
                }
              />{" "}
              Per serving
            </label>
          </div>
        </fieldset>
        {values.calculationMode === "per100" && <div className="basis-presets" role="group" aria-label="Nutrition basis presets">
          {([{label:"Per 100 g",quantity:"100",unit:"g"},{label:"Per 100 mL",quantity:"100",unit:"ml"},{label:"Per 1 mL",quantity:"1",unit:"ml"}] as const).map(preset=><button key={preset.label} type="button" aria-pressed={values.baseQuantity===preset.quantity&&values.baseUnit===preset.unit} onClick={()=>setValues(current=>({...current,baseQuantity:preset.quantity,baseUnit:preset.unit}))}>{preset.label}</button>)}
        </div>}
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
              {(values.calculationMode === "perServing" ? servingUnits : per100Units).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Energy">
            <EnergyInput
              calories={values.calories === "" ? undefined : Number(values.calories)}
              onCaloriesChange={(value) => set("calories", value === undefined ? "" : String(value))}
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
        {food && <button className="danger full saved-food-delete" type="button" onClick={() => setConfirmDelete(true)}><Trash2 />Delete saved food</button>}
      </form>
      {confirmDelete && food && <div className="dialog-backdrop"><section className="dialog food-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-food-title"><h2 id="delete-food-title">Delete {food.name}?</h2><p>It will disappear from saved foods. Existing day logs and template snapshots will stay unchanged.</p><div><button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="confirm-food-delete" type="button" onClick={() => void remove()}><Trash2 />Delete food</button></div></section></div>}
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
  const unavailableNutrients = food?.unavailableNutrients ?? entry?.snapshot.unavailableNutrients;
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
            <NumberInput
              value={quantity}
              onChange={setQuantity}
              ariaLabel={food?.calculationMode === "perServing" ? "Servings / quantity" : `Quantity (${unit})`}
            />
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
              <b><EnergyText calories={preview.calories} /></b>
            </span>
            <span>
              <small>PROTEIN</small>
              <b>{unavailableNutrients?.includes("protein")?"—":`${roundMacro(preview.protein)} g`}</b>
            </span>
            <span>
              <small>CARBS</small>
              <b>{unavailableNutrients?.includes("carbohydrates")?"—":`${roundMacro(preview.carbohydrates)} g`}</b>
            </span>
            <span>
              <small>FAT</small>
              <b>{unavailableNutrients?.includes("fat")?"—":`${roundMacro(preview.fat)} g`}</b>
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
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      aria-label={ariaLabel}
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
  const months=useMemo(()=>Array.from({length:13},(_,index)=>addMonths(month,index-6)),[month]);
  const firstGrid=monthGrid(months[0]!,weekStartsOn);
  const lastGrid=monthGrid(months.at(-1)!,weekStartsOn);
  const firstIso = isoDate(firstGrid[0] ?? months[0]!);
  const lastIso = isoDate(lastGrid.at(-1) ?? months.at(-1)!);
  const currentMonthRef=useRef<HTMLElement>(null);
  useEffect(()=>{currentMonthRef.current?.scrollIntoView({block:"start"})},[month]);
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
  const choose = (date: Date) => onSelectDate(date);
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
      <section className="month-browser">
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
        <div className="calendar-month-scroll">
        {months.map(shownMonth=><section className="scroll-month" key={format(shownMonth,"yyyy-MM")} ref={isSameMonth(shownMonth,month)?currentMonthRef:undefined}>
        <h2>{format(shownMonth,"MMMM yyyy")}</h2>
        <div className="month-grid">
          {monthGrid(shownMonth,weekStartsOn).map((day) => {
            const dayIso = isoDate(day);
            if(!isSameMonth(day,shownMonth))return <span className="empty-calendar-day" key={dayIso}/>;
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
                className={`${isSameDay(day, selectedDate) ? "selected" : ""} ${isSameDay(day, new Date()) ? "today" : ""} ${scheduled ? "scheduled" : ""} ${scheduleState}`}
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
        </section>)}
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
              <strong><EnergyText calories={totals.planned.calories} /></strong>
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
                        {formatFoodQuantity(entry.snapshot.quantity, entry.snapshot.unit)}
                      </small>
                    </span>
                    <b><EnergyText calories={entry.snapshot.calories} /></b>
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
  const entries = useLiveQuery(() => db.weights.toArray(), []) ?? [];
  const orderedEntries = useMemo(
    () =>
      [...entries].sort((a, b) =>
        (a.recordedAt ?? `${a.date}T12:00:00`).localeCompare(
          b.recordedAt ?? `${b.date}T12:00:00`,
        ),
      ),
    [entries],
  );
  const importInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    inspection: WeightCsvInspection;
  }>();
  const [editing, setEditing] = useState<WeightEntry | "new">();
  const points = withSevenDayAverage(entries);
  const latest = orderedEntries.at(-1);
  const latestAverage = points.at(-1);
  const change = weightChange(entries);
  const shown = (kg: number) => displayWeight(kg, unit).toFixed(1);
  const loadCsv = async (file?: File) => {
    if (!file) return;
    try {
      setPendingImport({ fileName: file.name, inspection: inspectWeightCsv(await file.text()) });
    } catch (error) {
      onToast({ message: error instanceof Error ? error.message : "Could not read that CSV" });
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };
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
        <div className="body-actions">
          <input
            ref={importInput}
            className="visually-hidden"
            type="file"
            aria-label="Weight CSV file"
            accept=".csv,text/csv,text/plain"
            onChange={(event) => void loadCsv(event.target.files?.[0])}
          />
          <button
            className="icon-button"
            aria-label="Import weight CSV"
            onClick={() => importInput.current?.click()}
          >
            <Upload />
          </button>
          <button
            className="icon-button"
            aria-label="Add weight"
            onClick={() => setEditing("new")}
          >
            <Plus />
          </button>
        </div>
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
                {latestAverage && shown(latestAverage.rollingAverageKg)} <em>{unit}</em>
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
            {[...orderedEntries].reverse().map((entry) => (
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
                  <p>
                    {entry.recordedAt
                      ? format(new Date(entry.recordedAt), "h:mm a")
                      : "Time not recorded"}
                    {entry.note ? ` · ${entry.note}` : entry.source === "csv" ? " · CSV import" : ""}
                  </p>
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
      {pendingImport && (
        <WeightImportDialog
          fileName={pendingImport.fileName}
          inspection={pendingImport.inspection}
          unit={unit}
          onClose={() => setPendingImport(undefined)}
          onImport={async (measurements, ignoredRows) => {
            const result = await importWeightMeasurements(measurements);
            setPendingImport(undefined);
            const ignored = ignoredRows + result.duplicates;
            onToast({
              message: `Imported ${result.added} weight measurement${result.added === 1 ? "" : "s"}${ignored ? ` · skipped ${ignored}` : ""}`,
            });
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
  const [selectedId, setSelectedId] = useState<string>();
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
          `${18 + (index / Math.max(recent.length - 1, 1)) * 324},${360 - ((point[key] - min) / range) * 300}`,
      )
      .join(" ");
  const selected = recent.find((point) => point.id === selectedId);
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
        viewBox="0 0 360 390"
        role="img"
        aria-label={`Weight from ${displayWeight(recent[0]?.weightKg ?? 0, unit).toFixed(1)} to ${displayWeight(recent.at(-1)?.weightKg ?? 0, unit).toFixed(1)} ${unit}`}
      >
        <line x1="18" y1="40" x2="342" y2="40" />
        <line x1="18" y1="200" x2="342" y2="200" />
        <line x1="18" y1="360" x2="342" y2="360" />
        <polyline
          className="average-line"
          points={coords("rollingAverageKg")}
        />
        <polyline className="weight-line" points={coords("weightKg")} />
        {recent.map((point, index) => (
          <circle
            key={point.id}
            cx={18 + (index / Math.max(recent.length - 1, 1)) * 324}
            cy={360 - ((point.weightKg - min) / range) * 300}
            r={selected?.id === point.id ? "6" : "4"}
            className={selected?.id === point.id ? "selected" : undefined}
            role="button"
            tabIndex={0}
            aria-label={`${format(new Date(`${point.date}T12:00:00`), "d MMMM yyyy")}: ${displayWeight(point.weightKg, unit).toFixed(1)} ${unit}; 7-day average ${displayWeight(point.rollingAverageKg, unit).toFixed(1)} ${unit}`}
            onClick={() => setSelectedId(point.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedId(point.id);
              }
            }}
          />
        ))}
      </svg>
      {selected && (
        <div className="body-chart-readout" role="status" aria-live="polite">
          <strong>{format(new Date(`${selected.date}T12:00:00`), "EEE, d MMM yyyy")}</strong>
          <span>{displayWeight(selected.weightKg, unit).toFixed(1)} {unit} · 7-day average {displayWeight(selected.rollingAverageKg, unit).toFixed(1)} {unit}</span>
        </div>
      )}
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
      await saveWeight(
        date,
        weightInputToKg(Number(weight), unit),
        note,
        entry?.id,
      );
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
function WeightImportDialog({
  fileName,
  inspection,
  unit,
  onClose,
  onImport,
}: {
  fileName: string;
  inspection: WeightCsvInspection;
  unit: WeightUnit;
  onClose: () => void;
  onImport: (
    measurements: ReturnType<typeof parseWeightCsv>["measurements"],
    ignoredRows: number,
  ) => Promise<void>;
}) {
  const [dateColumn, setDateColumn] = useState(inspection.suggestedDateColumn);
  const [weightColumn, setWeightColumn] = useState(inspection.suggestedWeightColumn);
  const [sourceUnit, setSourceUnit] = useState<WeightUnit>(inspection.suggestedUnit);
  const [dateOrder, setDateOrder] = useState<DateOrder>("dmy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const parsed = useMemo(() => {
    if (dateColumn < 0 || weightColumn < 0) return undefined;
    return parseWeightCsv(inspection, { dateColumn, weightColumn, unit: sourceUnit, dateOrder });
  }, [dateColumn, dateOrder, inspection, sourceUnit, weightColumn]);
  const dates = parsed?.measurements.map((item) => item.date) ?? [];
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed?.measurements.length) {
      setError("No valid measurements were found with this mapping");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onImport(
        parsed.measurements,
        parsed.skippedRows + parsed.duplicateRows,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not import these measurements");
      setBusy(false);
    }
  };
  return (
    <div className="dialog-backdrop">
      <form className="dialog weight-import-dialog" onSubmit={submit}>
        <h2>Import weight data</h2>
        <p className="import-file-name">{fileName}</p>
        <div className="weight-import-mapping">
          <label>
            Date / time column
            <select value={dateColumn} onChange={(event) => setDateColumn(Number(event.target.value))}>
              <option value={-1}>Choose column</option>
              {inspection.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}
            </select>
          </label>
          <label>
            Weight column
            <select value={weightColumn} onChange={(event) => setWeightColumn(Number(event.target.value))}>
              <option value={-1}>Choose column</option>
              {inspection.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}
            </select>
          </label>
          <label>
            Source unit
            <select value={sourceUnit} onChange={(event) => setSourceUnit(event.target.value as WeightUnit)}>
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </select>
          </label>
          <label>
            Numeric date order
            <select value={dateOrder} onChange={(event) => setDateOrder(event.target.value as DateOrder)}>
              <option value="dmy">Day / month / year</option>
              <option value="mdy">Month / day / year</option>
            </select>
          </label>
        </div>
        {parsed?.measurements.length ? (
          <section className="weight-import-summary" aria-live="polite">
            <strong>{parsed.measurements.length} measurements</strong>
            <span>
              {format(new Date(`${dates[0]}T12:00:00`), "d MMM yyyy")} – {format(new Date(`${dates.at(-1)}T12:00:00`), "d MMM yyyy")}
            </span>
            <small>
              Preview: {parsed.measurements.slice(0, 3).map((item) => `${format(new Date(item.recordedAt), "d MMM, h:mm a")} · ${displayWeight(item.weightKg, unit).toFixed(1)} ${unit}`).join("; ")}
            </small>
            {(parsed.skippedRows > 0 || parsed.duplicateRows > 0) && (
              <em>{parsed.skippedRows + parsed.duplicateRows} invalid or repeated rows will be skipped</em>
            )}
          </section>
        ) : (
          <p className="form-error">Choose matching columns to preview the import.</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" type="submit" disabled={busy || !parsed?.measurements.length}>
            {busy ? "Importing…" : "Import measurements"}
          </button>
        </div>
      </form>
    </div>
  );
}
type ChartPeriod = "all" | "year" | "month" | "week" | "day" | "custom";
type NutritionTrend = "calories" | "protein" | "carbohydrates" | "fat";
type TrendDuration = 7 | 14 | 30 | 90 | "all" | "custom";
function ChartsScreen({
  categories,
  weightUnit,
}: {
  categories: FoodCategory[];
  weightUnit: WeightUnit;
}) {
  const { unit } = useEnergyDisplay();
  const [tab, setTab] = useState<"breakdown" | "trends" | "foods">("breakdown");
  const [period, setPeriod] = useState<ChartPeriod>("all");
  const [trendDuration, setTrendDuration] = useState<TrendDuration>(30);
  const [customFrom, setCustomFrom] = useState(
    isoDate(subDays(new Date(), 30)),
  );
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const [breakdownMode, setBreakdownMode] = useState<"category" | "macros">(
    "category",
  );
  const [trend, setTrend] = useState<NutritionTrend | null>("calories");
  const [showWeight, setShowWeight] = useState(false);
  const [weightAggregation, setWeightAggregation] = useState<"average" | "range">("average");
  const [trendScope, setTrendScope] = useState<"consumed" | "planned">("consumed");
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
  const allDates = [
    ...(analytics?.items ?? []).map((item) => item.date),
    ...(analytics?.weights ?? []).map((item) => item.date),
  ].sort();
  const trendTo = trendDuration === "custom"
    ? customTo
    : trendDuration === "all"
      ? (allDates.at(-1) ?? isoDate(today))
      : isoDate(today);
  const trendFrom = trendDuration === "custom"
    ? customFrom
    : trendDuration === "all"
      ? (allDates[0] ?? trendTo)
      : isoDate(subDays(new Date(`${trendTo}T12:00:00`), trendDuration - 1));
  const periodInRange = (date: string) =>
    period === "all" || period === "custom"
      ? period === "all" || (date >= customFrom && date <= customTo)
      : date >= starts[period];
  const inRange = (date: string) =>
    tab === "trends"
      ? date >= trendFrom && date <= trendTo
      : periodInRange(date);
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
  const days = dailyNutrition(
    trendScope === "consumed"
      ? items.filter(({ entry }) => entry.consumed)
      : items,
  );
  const foodStats = foodStatistics(items);
  const dailyWeights = aggregateWeightsByDay(weights);
  const trendItems = trend
    ? days.map((day) => ({
        date: day.date,
        value: trend === "calories" ? energyValue(day[trend], unit) : day[trend],
      }))
    : [];
  const latestNutrition = trendItems.at(-1);
  const latestWeight = dailyWeights.at(-1);
  const nutritionTrendLabel = trend === "calories"
    ? "Calories"
    : trend === "protein"
      ? "Protein"
      : trend === "carbohydrates"
        ? "Carbs"
        : trend === "fat"
          ? "Fat"
          : "Nutrition";
  const nutritionTrendUnit = trend === "calories" ? unit : trend ? "g" : "";
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
      {tab === "trends" ? (
        <div className="trend-duration-tabs" role="group" aria-label="Chart duration">
          {([7, 14, 30, 90, "all", "custom"] as TrendDuration[]).map((value) => (
            <button
              key={value}
              className={trendDuration === value ? "active" : ""}
              aria-pressed={trendDuration === value}
              onClick={() => setTrendDuration(value)}
            >
              {typeof value === "number" ? `${value}D` : value === "all" ? "All" : "Custom"}
            </button>
          ))}
        </div>
      ) : (
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
      )}
      {((tab === "trends" && trendDuration === "custom") ||
        (tab !== "trends" && period === "custom")) && (
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
                    <b><EnergyText calories={selected?.value ?? 0} /></b>
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
                <strong><EnergyText calories={total} /></strong>
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
                      <EnergyText calories={item.value} />
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
              ["calories", "protein", "carbohydrates", "fat"] as const
            ).map((metric) => (
              <button
                key={metric}
                className={trend === metric ? "active" : ""}
                aria-pressed={trend === metric}
                onClick={() => setTrend((current) => current === metric ? null : metric)}
              >
                {metric === "carbohydrates"
                  ? "Carbs"
                  : metric[0]?.toUpperCase() + metric.slice(1)}
              </button>
            ))}
            <button
              className={showWeight ? "active weight-active" : ""}
              aria-pressed={showWeight}
              onClick={() => setShowWeight((current) => !current)}
            >
              <Scale />
              Weight
            </button>
          </div>
          <div className="trend-options">
            {trend && (
              <div className="compact-toggle" aria-label="Nutrition totals">
                <button className={trendScope === "consumed" ? "active" : ""} onClick={() => setTrendScope("consumed")}>Consumed</button>
                <button className={trendScope === "planned" ? "active" : ""} onClick={() => setTrendScope("planned")}>Planned</button>
              </div>
            )}
            {showWeight && (
              <div className="compact-toggle" aria-label="Daily weight calculation">
                <button className={weightAggregation === "average" ? "active" : ""} onClick={() => setWeightAggregation("average")}>Average</button>
                <button className={weightAggregation === "range" ? "active" : ""} onClick={() => setWeightAggregation("range")}>Min–max</button>
              </div>
            )}
          </div>
          {!trend && !showWeight ? (
            <div className="analytics-empty chart-series-empty">
              <BarChart3 />
              <h2>Choose a chart series</h2>
              <p>Select a nutrition metric or Weight above.</p>
            </div>
          ) : trendItems.length || (showWeight && dailyWeights.length) ? (
            <>
              <div className="trend-heading combined-heading">
                {trend && (
                  <div>
                    <span>{trendScope === "consumed" ? "Consumed" : "Planned"} {trend === "carbohydrates" ? "carbs" : trend} · {trendDuration === "custom" ? "custom range" : trendDuration === "all" ? "all data" : `${trendDuration} days`}</span>
                    <strong>{latestNutrition ? `${latestNutrition.value.toFixed(trend === "calories" ? 0 : 1)} ${trend === "calories" ? unit : "g"}` : "No data"}</strong>
                  </div>
                )}
                {showWeight && (
                  <div className="weight-heading">
                    <span>Daily weight {weightAggregation === "range" ? "range" : "average"}</span>
                    <strong>
                      {latestWeight
                        ? weightAggregation === "range"
                          ? `${displayWeight(latestWeight.minKg, weightUnit).toFixed(1)}–${displayWeight(latestWeight.maxKg, weightUnit).toFixed(1)} ${weightUnit}`
                          : `${displayWeight(latestWeight.averageKg, weightUnit).toFixed(1)} ${weightUnit}`
                        : "No data"}
                    </strong>
                  </div>
                )}
              </div>
              <CombinedTrendChart
                nutrition={trendItems}
                nutritionLabel={nutritionTrendLabel}
                nutritionUnit={nutritionTrendUnit}
                weights={showWeight ? dailyWeights : []}
                weightUnit={weightUnit}
                weightAggregation={weightAggregation}
                rangeFrom={trendFrom}
                rangeTo={trendTo}
                duration={trendDuration}
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
                  <EnergyText calories={food.calories} />
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
function CombinedTrendChart({
  nutrition,
  nutritionLabel,
  nutritionUnit,
  weights,
  weightUnit,
  weightAggregation,
  rangeFrom,
  rangeTo,
  duration,
}: {
  nutrition: { date: string; value: number }[];
  nutritionLabel: string;
  nutritionUnit: string;
  weights: ReturnType<typeof aggregateWeightsByDay>;
  weightUnit: WeightUnit;
  weightAggregation: "average" | "range";
  rangeFrom: string;
  rangeTo: string;
  duration: TrendDuration;
}) {
  const [selectedPoint, setSelectedPoint] = useState<{
    date: string;
    series: "nutrition" | "weight";
  }>();
  useEffect(() => {
    setSelectedPoint(undefined);
  }, [duration, nutritionLabel, nutritionUnit, rangeFrom, rangeTo, weightAggregation, weightUnit]);
  const plotLeft = 42;
  const plotRight = 318;
  const plotTop = 28;
  const plotBottom = 452;
  const chartHeight = 500;
  const rangeDays = Math.max(
    differenceInCalendarDays(
      new Date(`${rangeTo}T12:00:00`),
      new Date(`${rangeFrom}T12:00:00`),
    ),
    0,
  );
  const x = (date: string) => {
    if (!rangeDays) return (plotLeft + plotRight) / 2;
    const offset = differenceInCalendarDays(
      new Date(`${date}T12:00:00`),
      new Date(`${rangeFrom}T12:00:00`),
    );
    return plotLeft + (Math.max(0, Math.min(offset, rangeDays)) / rangeDays) * (plotRight - plotLeft);
  };
  const niceStep = (span: number, intervals = 4) => {
    const rough = Math.max(span / intervals, Number.EPSILON);
    const power = 10 ** Math.floor(Math.log10(rough));
    const fraction = rough / power;
    const factor = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
    return factor * power;
  };
  const nutritionPeak = Math.max(...nutrition.map((item) => item.value), 1);
  const nutritionStep = niceStep(nutritionPeak);
  const nutritionMax = Math.ceil(nutritionPeak / nutritionStep) * nutritionStep;
  const nutritionY = (value: number) => plotBottom - (value / nutritionMax) * (plotBottom - plotTop);
  const displayedWeightValues = weights.flatMap((item) => [
    displayWeight(item.minKg, weightUnit),
    displayWeight(item.maxKg, weightUnit),
  ]);
  const weightMin = displayedWeightValues.length ? Math.min(...displayedWeightValues) : 0;
  const weightMax = displayedWeightValues.length ? Math.max(...displayedWeightValues) : 1;
  const weightPadding = Math.max((weightMax - weightMin) * 0.12, weightUnit === "kg" ? 0.3 : 0.7);
  const weightStep = niceStep(Math.max(weightMax - weightMin + weightPadding * 2, 1));
  const weightFloor = Math.floor((weightMin - weightPadding) / weightStep) * weightStep;
  const weightCeiling = Math.ceil((weightMax + weightPadding) / weightStep) * weightStep;
  const weightRange = Math.max(weightCeiling - weightFloor, 1);
  const weightY = (valueKg: number) =>
    plotBottom - ((displayWeight(valueKg, weightUnit) - weightFloor) / weightRange) * (plotBottom - plotTop);
  const nutritionLine = nutrition.map((item) => `${x(item.date)},${nutritionY(item.value)}`).join(" ");
  const weightLine = weights.map((item) => `${x(item.date)},${weightY(item.averageKg)}`).join(" ");
  const tickDates = [...new Set([0, 1, 2, 3].map((index) =>
    isoDate(addDays(new Date(`${rangeFrom}T12:00:00`), Math.round((rangeDays * index) / 3))),
  ))];
  const availableDates = [...new Set([
    ...nutrition.map((item) => item.date),
    ...weights.map((item) => item.date),
  ])].sort();
  const selectedNutrition = selectedPoint
    ? nutrition.find((item) => item.date === selectedPoint.date)
    : undefined;
  const selectedWeight = selectedPoint
    ? weights.find((item) => item.date === selectedPoint.date)
    : undefined;
  const activePoint = selectedPoint && (selectedNutrition || selectedWeight)
    ? selectedPoint
    : undefined;
  const selectPoint = (date: string, series: "nutrition" | "weight") => {
    setSelectedPoint((current) => current?.date === date && current.series === series
      ? undefined
      : { date, series });
  };
  const selectDate = (date: string) => {
    setSelectedPoint({
      date,
      series: nutrition.some((item) => item.date === date) ? "nutrition" : "weight",
    });
  };
  const scrubbing = useRef(false);
  const scrubToPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!availableDates.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * 360;
    const nearest = availableDates.reduce((closest, date) =>
      Math.abs(x(date) - pointerX) < Math.abs(x(closest) - pointerX) ? date : closest,
    );
    selectDate(nearest);
  };
  const startScrubbing = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    scrubbing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubToPointer(event);
  };
  const moveScrubber = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return;
    event.preventDefault();
    scrubToPointer(event);
  };
  const stopScrubbing = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return;
    event.preventDefault();
    scrubToPointer(event);
    scrubbing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const pointKeyDown = (
    event: KeyboardEvent<SVGGElement>,
    date: string,
    series: "nutrition" | "weight",
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectPoint(date, series);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const current = Math.max(0, availableDates.indexOf(activePoint?.date ?? date));
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
          ? availableDates.length - 1
          : Math.max(0, Math.min(availableDates.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1)));
      const nextDate = availableDates[next];
      if (nextDate) selectDate(nextDate);
    }
  };
  return (
    <div
      className="analytics-line analytics-line-large"
      data-duration={String(duration)}
      data-range-from={rangeFrom}
      data-range-to={rangeTo}
    >
      <div className="chart-canvas">
        <div
          className="chart-gesture-surface"
          onPointerDown={startScrubbing}
          onPointerMove={moveScrubber}
          onPointerUp={stopScrubbing}
          onPointerCancel={() => { scrubbing.current = false; }}
        >
          <svg
            viewBox={`0 0 360 ${chartHeight}`}
            role="group"
            aria-label={`Combined trend from ${rangeFrom} to ${rangeTo} with ${nutrition.length} nutrition days and ${weights.length} weight days. Drag horizontally to inspect the nearest day.`}
          >
          {[0, 1, 2, 3, 4].map((index) => {
            const y = plotTop + ((plotBottom - plotTop) * index) / 4;
            return <line key={`grid-${index}`} x1={plotLeft} y1={y} x2={plotRight} y2={y} />;
          })}
          {nutrition.length > 1 && <polyline className="nutrition-series" points={nutritionLine} />}
          {nutrition.map((item) => {
            const pointLabel = `${nutritionLabel} on ${format(new Date(`${item.date}T12:00:00`), "d MMMM yyyy")}: ${item.value.toFixed(nutritionUnit === "g" ? 1 : 0)} ${nutritionUnit}`;
            const selected = activePoint?.date === item.date;
            return (
              <g
                className={`chart-point-target${selected ? " selected" : ""}`}
                key={`nutrition-${item.date}`}
                role="button"
                tabIndex={0}
                aria-label={pointLabel}
                aria-pressed={selected}
                onClick={() => selectPoint(item.date, "nutrition")}
                onKeyDown={(event) => pointKeyDown(event, item.date, "nutrition")}
              >
                <circle className="chart-point-hit" cx={x(item.date)} cy={nutritionY(item.value)} r="21" />
                <circle className="nutrition-dot" cx={x(item.date)} cy={nutritionY(item.value)} r={selected ? "5" : "3"} />
              </g>
            );
          })}
          {weights.length > 1 && <polyline className="weight-series" points={weightLine} />}
          {weightAggregation === "range" && weights.map((item) => (
            <g className="weight-range" key={`range-${item.date}`}>
              <line x1={x(item.date)} x2={x(item.date)} y1={weightY(item.maxKg)} y2={weightY(item.minKg)} />
              <line x1={x(item.date) - 4} x2={x(item.date) + 4} y1={weightY(item.maxKg)} y2={weightY(item.maxKg)} />
              <line x1={x(item.date) - 4} x2={x(item.date) + 4} y1={weightY(item.minKg)} y2={weightY(item.minKg)} />
            </g>
          ))}
          {weights.map((item) => {
            const average = displayWeight(item.averageKg, weightUnit).toFixed(1);
            const minimum = displayWeight(item.minKg, weightUnit).toFixed(1);
            const maximum = displayWeight(item.maxKg, weightUnit).toFixed(1);
            const pointLabel = `Weight on ${format(new Date(`${item.date}T12:00:00`), "d MMMM yyyy")}: average ${average} ${weightUnit}, minimum ${minimum}, maximum ${maximum}, ${item.count} ${item.count === 1 ? "reading" : "readings"}`;
            const selected = activePoint?.date === item.date;
            return (
              <g
                className={`chart-point-target${selected ? " selected" : ""}`}
                key={`weight-${item.date}`}
                role="button"
                tabIndex={0}
                aria-label={pointLabel}
                aria-pressed={selected}
                onClick={() => selectPoint(item.date, "weight")}
                onKeyDown={(event) => pointKeyDown(event, item.date, "weight")}
              >
                <circle className="chart-point-hit" cx={x(item.date)} cy={weightY(item.averageKg)} r="21" />
                <circle className="weight-dot" cx={x(item.date)} cy={weightY(item.averageKg)} r={selected ? "5" : "3"} />
              </g>
            );
          })}
        {nutrition.length > 0 && (
          <>
            <text className="nutrition-axis" x="38" y={plotTop + 4} textAnchor="end">{nutritionMax.toFixed(nutritionUnit === "g" ? 1 : 0)}</text>
            <text className="nutrition-axis" x="38" y={(plotTop + plotBottom) / 2 + 4} textAnchor="end">{(nutritionMax / 2).toFixed(nutritionUnit === "g" ? 1 : 0)}</text>
            <text className="nutrition-axis" x="38" y={plotBottom + 4} textAnchor="end">0</text>
          </>
        )}
        {weights.length > 0 && (
          <>
            <text className="weight-axis" x="322" y={plotTop + 4}>{weightCeiling.toFixed(1)}</text>
            <text className="weight-axis" x="322" y={(plotTop + plotBottom) / 2 + 4}>{((weightCeiling + weightFloor) / 2).toFixed(1)}</text>
            <text className="weight-axis" x="322" y={plotBottom + 4}>{weightFloor.toFixed(1)}</text>
          </>
        )}
          {tickDates.map((date, index) => (
            <text
              className="date-axis"
              key={date}
              x={x(date)}
              y="480"
              textAnchor={index === 0 ? "start" : index === tickDates.length - 1 ? "end" : "middle"}
            >
              {format(new Date(`${date}T12:00:00`), rangeDays <= 14 ? "d MMM" : "MMM d")}
            </text>
          ))}
          {activePoint && (
            <line
              className="chart-scrubber"
              x1={x(activePoint.date)}
              x2={x(activePoint.date)}
              y1={plotTop}
              y2={plotBottom}
            />
          )}
            <rect
              className="chart-scrub-hit-area"
              x={plotLeft}
              y={plotTop}
              width={plotRight - plotLeft}
              height={plotBottom - plotTop}
              aria-hidden="true"
            />
          </svg>
        </div>
        {activePoint && (
          <div
            className={`chart-point-tooltip ${activePoint.series}`}
            role="status"
            aria-live="polite"
          >
            <span>{format(new Date(`${activePoint.date}T12:00:00`), "EEE, d MMM yyyy")}</span>
            {selectedNutrition && (
              <strong>
                {nutritionLabel} {selectedNutrition.value.toFixed(nutritionUnit === "g" ? 1 : 0)} {nutritionUnit}
              </strong>
            )}
            {selectedWeight && (
              <>
                <strong>Weight {displayWeight(selectedWeight.averageKg, weightUnit).toFixed(1)} {weightUnit} average</strong>
                {weightAggregation === "range" && (
                  <small>
                    {displayWeight(selectedWeight.minKg, weightUnit).toFixed(1)}–{displayWeight(selectedWeight.maxKg, weightUnit).toFixed(1)} {weightUnit} · {selectedWeight.count} {selectedWeight.count === 1 ? "reading" : "readings"}
                  </small>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <p className="chart-scrub-hint">Drag across the graph to inspect the nearest day</p>
      <p className="chart-legend">
        {nutrition.length > 0 && <span><i className="nutrition-key" />Nutrition ({nutritionUnit})</span>}
        {weights.length > 0 && <span><i className="weight-key" />Weight ({weightUnit}){weightAggregation === "range" ? " · whiskers show min–max" : ""}</span>}
      </p>
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
                <NumericInput
                  min="0"
                  inputMode="decimal"
                  value={value.targets[key]}
                  onValueChange={(next) => target(key, String(next))}
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
function AuxiliaryOverlay({label,onMinimise,children}:{label:string;onMinimise:()=>void;children:React.ReactNode}){
  return <section className="auxiliary-overlay" aria-label={label}><button className="auxiliary-minimise" onClick={onMinimise} aria-label={`Minimise ${label}`}><ChevronDown/></button>{children}</section>;
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
  return createPortal(
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
    </nav>,
    document.body,
  );
}
