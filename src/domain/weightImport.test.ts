import { describe, expect, it } from "vitest";
import { inspectWeightCsv, parseWeightCsv } from "./weightImport";

describe("generic weight CSV import", () => {
  it("detects the timestamp and weight columns in the supplied export shape", () => {
    const csv = "\uFEFFTime,Family Members,WEIGHT (kg),BMI\r\n2026-07-31 07:56:16,Charl,68.4,21.1\r\n2026-07-31 18:02:00,Charl,69.2,21.3\r\n";
    const inspection = inspectWeightCsv(csv);
    expect(inspection.suggestedDateColumn).toBe(0);
    expect(inspection.suggestedWeightColumn).toBe(2);
    expect(inspection.suggestedUnit).toBe("kg");
    const result = parseWeightCsv(inspection, {
      dateColumn: 0,
      weightColumn: 2,
      unit: "kg",
      dateOrder: "dmy",
    });
    expect(result.measurements).toEqual([
      { date: "2026-07-31", recordedAt: "2026-07-31T07:56:16", weightKg: 68.4 },
      { date: "2026-07-31", recordedAt: "2026-07-31T18:02:00", weightKg: 69.2 },
    ]);
  });

  it("supports column mapping, pounds, semicolons, and Australian numeric dates", () => {
    const inspection = inspectWeightCsv("When;Mass;Comment\n31/07/2026 08:05;150;morning\n");
    const result = parseWeightCsv(inspection, {
      dateColumn: 0,
      weightColumn: 1,
      unit: "lb",
      dateOrder: "dmy",
    });
    expect(result.measurements[0]).toEqual(
      expect.objectContaining({ date: "2026-07-31", recordedAt: "2026-07-31T08:05:00" }),
    );
    expect(result.measurements[0]?.weightKg).toBeCloseTo(68.0389, 3);
  });

  it("skips invalid and exact duplicate rows", () => {
    const inspection = inspectWeightCsv("Date,Weight\n2026-07-30,70\n2026-07-30,70\nnot a date,-2\n");
    const result = parseWeightCsv(inspection, {
      dateColumn: 0,
      weightColumn: 1,
      unit: "kg",
      dateOrder: "dmy",
    });
    expect(result.measurements).toHaveLength(1);
    expect(result.duplicateRows).toBe(1);
    expect(result.skippedRows).toBe(1);
  });
});
