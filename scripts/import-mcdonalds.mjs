#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE_URL = "https://www.mcdonalds.com/content/dam/sites/au/nfl/nutrition/PDFs/Aus%20Core%20Food%20Menu_January%202026.pdf";
const download = (url) => execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", url], { maxBuffer: 100 * 1024 * 1024 });
const clean = (value) => value.replace(/\s+/g, " ").trim();
const valuesAfter = (line, label) => {
  const index = line.indexOf(label);
  if (index < 0) return [];
  return [...line.slice(index + label.length).matchAll(/-?\d[\d]*(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(",", ".")));
};

const nutrientOrDocumentText = /(?:Avg Qty|Energy \(|Protein \(|Fat, total|Saturated|Carbohydrate \(|Sugars \(|Sodium \(|Issue:|Revision:|File:|Information correct|Developed and authorised|Contains:|May be present:)/i;
const invalidHeader = (value) =>
  !value ||
  !/[A-Za-z]/.test(value) ||
  nutrientOrDocumentText.test(value) ||
  /^(?:OR:|or:)/.test(value) ||
  value.length > 100;

const genericSizeName = /^(?:small|medium|large|\d+\s*(?:pc|pcs|piece|pieces))$/i;

function parse(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let productNames = [];
  let productGroup = "";

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const firstTextColumn = rawLine.search(/\S/);
    const rawColumns = rawLine.trim().split(/\s{15,}/).filter(Boolean);
    const columns = rawColumns.map(clean);
    const canBeProductHeader =
      columns.length >= 2 &&
      !rawLine.includes(":") &&
      !nutrientOrDocumentText.test(rawLine) &&
      !/^[A-Z\s&]+$/.test(clean(rawLine));
    if (canBeProductHeader) {
      const isContinuationHeader = firstTextColumn > 40;
      const rawNames = (isContinuationHeader ? rawColumns : rawColumns.slice(1))
        .flatMap((value) => value.split(/\s{6,}/))
        .map(clean)
        .filter((value) => !invalidHeader(value));
      if (rawNames.length && rawNames.every((value) => !value.includes(":"))) {
        if (!isContinuationHeader) productGroup = columns[0];
        const names = rawNames.length === 1 && !isContinuationHeader ? [columns[0]] : rawNames;
        productNames = names.map((value) => genericSizeName.test(value) && productGroup ? `${productGroup} ${value}` : value);
      }
    }

    const standaloneHeader = columns[0] ?? "";
    if (
      columns.length === 1 &&
      firstTextColumn === 0 &&
      !invalidHeader(standaloneHeader) &&
      !standaloneHeader.includes(":") &&
      !/[.,()[\]{}]/.test(standaloneHeader) &&
      !/^[A-Z\s&]+$/.test(standaloneHeader)
    ) {
      productGroup = standaloneHeader;
      productNames = [standaloneHeader];
    }

    if (!rawLine.includes("Energy (Cal)")) continue;
    const calories = valuesAfter(rawLine, "Energy (Cal)");
    if (!calories.length || calories.length % 2 !== 0) continue;
    const count = calories.length / 2;
    if (productNames.length !== count) continue;

    const metrics = {};
    for (let offset = 1; offset <= 12 && index + offset < lines.length; offset += 1) {
      const candidate = lines[index + offset] ?? "";
      for (const [label, key] of [["Protein (g)","protein"],["Fat, total (g)","fat"],["Carbohydrate (g)","carbohydrates"]]) {
        if (candidate.includes(label)) metrics[key] = valuesAfter(candidate, label);
      }
    }
    if (![metrics.protein, metrics.fat, metrics.carbohydrates].every((values) => values?.length === calories.length)) continue;

    for (let product = 0; product < count; product += 1) {
      const serveCalories = calories[product * 2];
      const per100Calories = calories[product * 2 + 1];
      // Revision 113 publishes internally consistent per-serve macros for the Triple
      // Cheeseburger but an anomalous per-100-g column, so no weight is inferred for it.
      const servingGrams = productNames[product] === "Triple Cheeseburger"
        ? undefined
        : per100Calories > 0 ? Math.round(serveCalories / per100Calories * 100) : undefined;
      rows.push({
        name: productNames[product],
        servingGrams,
        calories: serveCalories,
        protein: metrics.protein[product * 2],
        fat: metrics.fat[product * 2],
        carbohydrates: metrics.carbohydrates[product * 2],
      });
    }
  }
  return rows;
}

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "nutri-notes-mcd-"));
  try {
    const pdfPath = join(directory, "mcdonalds.pdf");
    writeFileSync(pdfPath, download(SOURCE_URL));
    const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    const byName = new Map(parse(text).map((item) => [item.name.toLocaleLowerCase(), item]));
    const menu = [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
    if (menu.length < 50) throw new Error(`Only ${menu.length} McDonald's rows were parsed; refusing to replace the catalogue`);
    const output = [
      "// Generated from McDonald's Australia's official January 2026 core-food nutrition guide by scripts/import-mcdonalds.mjs.",
      "// Serving grams are derived from the published per-serve and per-100-g energy columns where those columns are internally consistent.",
      "export type McDonaldsMenuDatum = readonly [name: string, servingGrams: number | undefined, calories: number, protein: number, carbohydrates: number, fat: number];",
      "",
      "export const mcdonaldsMenu: readonly McDonaldsMenuDatum[] = [",
      ...menu.map((item) => `  [${[JSON.stringify(item.name),item.servingGrams ?? "undefined",item.calories,item.protein,item.carbohydrates,item.fat].join(",")}],`),
      "] as const;",
      "",
    ];
    process.stdout.write(output.join("\n"));
  } finally {
    rmSync(directory,{recursive:true,force:true});
  }
}

await main();
