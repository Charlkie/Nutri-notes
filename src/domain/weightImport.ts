import type { ISODate, WeightUnit } from "./types";

export type DateOrder = "dmy" | "mdy";

export interface WeightCsvInspection {
  headers: string[];
  rows: string[][];
  delimiter: "," | ";" | "\t";
  suggestedDateColumn: number;
  suggestedWeightColumn: number;
  suggestedUnit: WeightUnit;
}

export interface WeightImportOptions {
  dateColumn: number;
  weightColumn: number;
  unit: WeightUnit;
  dateOrder: DateOrder;
}

export interface ParsedWeightMeasurement {
  date: ISODate;
  recordedAt: string;
  weightKg: number;
}

export interface WeightImportResult {
  measurements: ParsedWeightMeasurement[];
  skippedRows: number;
  duplicateRows: number;
}

const normaliseHeader = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function parseRows(text: string, delimiter: WeightCsvInspection["delimiter"]): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) {
      row.push(value.trim());
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function delimiterFor(text: string): WeightCsvInspection["delimiter"] {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts = ([",", ";", "\t"] as const).map((delimiter) => ({
    delimiter,
    count: parseRows(firstLine, delimiter)[0]?.length ?? 0,
  }));
  return counts.sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function dateScore(header: string): number {
  const value = normaliseHeader(header);
  if (["time", "date time", "datetime", "timestamp", "recorded at"].includes(value)) return 100;
  if (value === "date" || value === "day") return 90;
  if (value.includes("date") || value.includes("time")) return 50;
  return 0;
}

function weightScore(header: string): number {
  const value = normaliseHeader(header);
  if (/muscle|fat|bone|lean|water|bmi/.test(value)) return 0;
  if (["weight kg", "body weight kg", "weight lbs", "weight lb"].includes(value)) return 110;
  if (["weight", "body weight", "mass", "body mass"].includes(value)) return 100;
  return value.includes("weight") ? 60 : 0;
}

const bestColumn = (headers: string[], score: (header: string) => number) => {
  const ranked = headers.map((header, index) => ({ index, score: score(header) }));
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.score ? ranked[0].index : -1;
};

export function inspectWeightCsv(text: string): WeightCsvInspection {
  const delimiter = delimiterFor(text);
  const rows = parseRows(text.replace(/^\uFEFF/, ""), delimiter);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  if (headers.length < 2 || !rows.length) throw new Error("This CSV does not contain a header and data rows");
  const suggestedDateColumn = bestColumn(headers, dateScore);
  const suggestedWeightColumn = bestColumn(headers, weightScore);
  const weightHeader = normaliseHeader(headers[suggestedWeightColumn] ?? "");
  const suggestedUnit: WeightUnit = /\b(lb|lbs|pound|pounds)\b/.test(weightHeader) ? "lb" : "kg";
  return {
    headers,
    rows,
    delimiter,
    suggestedDateColumn,
    suggestedWeightColumn,
    suggestedUnit,
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normaliseDateTime(value: string, order: DateOrder): { date: ISODate; recordedAt: string } | undefined {
  const trimmed = value.trim();
  let year: number;
  let month: number;
  let day: number;
  let hour = 12;
  let minute = 0;
  let second = 0;
  const ymd = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  const local = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
    hour = Number(ymd[4] ?? hour);
    minute = Number(ymd[5] ?? minute);
    second = Number(ymd[6] ?? second);
  } else if (local) {
    const first = Number(local[1]);
    const secondPart = Number(local[2]);
    year = Number(local[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    day = order === "dmy" ? first : secondPart;
    month = order === "dmy" ? secondPart : first;
    hour = Number(local[4] ?? hour);
    minute = Number(local[5] ?? minute);
    second = Number(local[6] ?? second);
  } else {
    const parsed = new Date(trimmed);
    if (!Number.isFinite(parsed.getTime())) return undefined;
    year = parsed.getFullYear();
    month = parsed.getMonth() + 1;
    day = parsed.getDate();
    hour = parsed.getHours();
    minute = parsed.getMinutes();
    second = parsed.getSeconds();
  }
  if (!validDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return undefined;
  const date = `${year}-${pad(month)}-${pad(day)}` as ISODate;
  return { date, recordedAt: `${date}T${pad(hour)}:${pad(minute)}:${pad(second)}` };
}

function numericWeight(value: string): number {
  const cleaned = value.trim().replace(/\s/g, "").replace(/(kg|lbs?|pounds?)$/i, "");
  const normalised = /^\d+,\d+$/.test(cleaned) ? cleaned.replace(",", ".") : cleaned.replaceAll(",", "");
  return Number(normalised);
}

export function parseWeightCsv(
  inspection: WeightCsvInspection,
  options: WeightImportOptions,
): WeightImportResult {
  if (options.dateColumn < 0 || options.weightColumn < 0) {
    throw new Error("Choose the date/time and weight columns");
  }
  const measurements: ParsedWeightMeasurement[] = [];
  const seen = new Set<string>();
  let skippedRows = 0;
  let duplicateRows = 0;
  for (const row of inspection.rows) {
    const time = normaliseDateTime(row[options.dateColumn] ?? "", options.dateOrder);
    const inputWeight = numericWeight(row[options.weightColumn] ?? "");
    const weightKg = options.unit === "lb" ? inputWeight / 2.2046226218 : inputWeight;
    if (!time || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
      skippedRows += 1;
      continue;
    }
    const key = `${time.recordedAt}|${weightKg.toFixed(4)}`;
    if (seen.has(key)) {
      duplicateRows += 1;
      continue;
    }
    seen.add(key);
    measurements.push({ ...time, weightKg });
  }
  measurements.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return { measurements, skippedRows, duplicateRows };
}
