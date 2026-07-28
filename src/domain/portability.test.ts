import { describe, expect, it } from "vitest";
import {
  BACKUP_VERSION,
  createCsvExports,
  csvCell,
  parseBackup,
  type BackupData,
} from "./portability";
const backup: BackupData = {
  schemaVersion: BACKUP_VERSION,
  exportedAt: "2026-07-27",
  app: "Nutri Notes",
  foods: [],
  categories: [],
  recipes: [],
  templates: [],
  schedules: [],
  days: [],
  entries: [],
  weights: [],
  settings: {},
};
describe("data portability", () => {
  it("validates versioned backups", () => {
    expect(parseBackup(backup).schemaVersion).toBe(1);
    expect(() => parseBackup({ ...backup, schemaVersion: 99 })).toThrow(
      /Invalid backup/,
    );
  });
  it("accepts older backups with empty recipe and schedule collections", () => {
    const { recipes: _, schedules: __, ...legacy } = backup;
    expect(parseBackup(legacy)).toMatchObject({ recipes: [], schedules: [] });
  });
  it("validates and preserves scheduled plan metadata", () => {
    const schedule = {
      id: "schedule",
      templateId: "template",
      templateName: "Weekdays",
      start: "2026-07-27",
      weeks: 6,
      weekdays: [1, 2, 3, 4, 5],
      replacePopulated: false,
      appliedDates: ["2026-07-27"],
      skippedDates: [],
      exceptions: [{ date: "2026-07-28", mode: "skip" as const }],
      createdAt: "now",
      updatedAt: "now",
    };
    expect(
      parseBackup({ ...backup, schedules: [schedule] }).schedules[0],
    ).toEqual(schedule);
  });
  it("quotes CSV and guards spreadsheet formulas", () => {
    expect(csvCell('Oats, "quick"')).toBe('"Oats, ""quick"""');
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell(-2)).toBe("-2");
  });
  it("generates all CSV files with stable headers", () => {
    const files = createCsvExports(backup);
    expect(Object.keys(files)).toEqual([
      "day_totals.csv",
      "food_entries.csv",
      "weight.csv",
    ]);
    expect(files["weight.csv"]).toBe("Date,Weight kg,Note\r\n");
  });
});
