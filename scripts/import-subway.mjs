#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NUTRITION_PAGE = "https://www.subway.com/en-au/menunutrition/nutrition";
const NUMBER = "-?\\d[\\d,]*(?:\\.\\d+)?";
const ROW = new RegExp(`(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s*$`);

const clean = (value) => value.replace(/\s+/g, " ").trim();
const numeric = (value) => Number(value.replaceAll(",", ""));
const download = (url) => execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", String(url)], { maxBuffer: 100 * 1024 * 1024 });

const sections = [
  ["Subway 6-Inch® Subs", "6-inch sub"],
  ["Wraps (on regular flour wrap)", "regular wrap"],
  ["Wraps (on large flour wrap)", "large wrap"],
  ["Salads (regular", "regular salad"],
  ["Salads (large", "large salad"],
  ["Breakfast Wraps", "breakfast wrap"],
  ["Breakfast", "breakfast"],
  ["Sides & Snacks", "side or snack"],
  ["Cookies", "cookie"],
  ["Breads", "bread"],
  ["Meat, Poultry, Egg, Seafood & Vegetarian Items", "protein or filling"],
  ["Sauces & Dressings", "sauce or dressing"],
  ["Cheeses", "cheese"],
  ["Vegetables", "vegetable"],
  ["Seasonings", "seasoning"],
];

const ignoredLine = (line) =>
  !line ||
  line.startsWith("(") ||
  line.startsWith("AVG QTY") ||
  line.startsWith("Double values") ||
  line.startsWith("values") ||
  line.includes("Serving Size") ||
  line.includes("Energy (kJ)") ||
  line.includes("Dietary Fiber") ||
  line.includes("Sodium (mg)") ||
  line.includes("Amount on Subway") ||
  line.includes("Seafood Origin") ||
  line.includes("Nutrition information compiled") ||
  line.length > 110;

function displayName(name, section) {
  if (!section) return name;
  if (["6-inch sub", "regular wrap", "large wrap", "regular salad", "large salad", "breakfast wrap"].includes(section)) return `${name} (${section})`;
  return name;
}

function parse(text, sourceUrl) {
  const servingSection = text.split("AVG QTY Per 100g")[0] ?? text;
  const lines = servingSection.split(/\r?\n/);
  const rows = [];
  let section = "";
  let candidateName = "";

  for (const rawLine of lines) {
    const line = clean(rawLine);
    const nextSection = sections.find(([heading]) => line.startsWith(heading));
    if (nextSection) {
      section = nextSection[1];
      candidateName = "";
      continue;
    }

    const match = line.match(ROW);
    if (match) {
      const prefix = clean(line.slice(0, match.index));
      const name = prefix && !prefix.startsWith("(") ? prefix : candidateName;
      if (!name || !section) continue;
      const [servingGrams, energyKj, calories, protein, fat, , carbohydrates] = match.slice(1).map(numeric);
      if (![servingGrams, energyKj, calories, protein, fat, carbohydrates].every(Number.isFinite) || servingGrams <= 0) continue;
      rows.push({ name: displayName(name, section), servingGrams, calories, protein, carbohydrates, fat, sourceUrl });
      continue;
    }

    if (!ignoredLine(line) && !sections.some(([heading]) => line.startsWith(heading))) candidateName = line;
  }
  return rows;
}

async function main() {
  const page = download(NUTRITION_PAGE).toString("utf8");
  const sourceUrl = [...page.matchAll(/href="([^"]+\.pdf)/gi)].map((match) => match[1]).find((url) => /AUS_Nutritional_Web_Guide_May_2026/i.test(url));
  if (!sourceUrl) throw new Error("The current Subway Australia nutrition PDF was not found");

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "nutri-notes-subway-"));
  try {
    const pdfPath = join(temporaryDirectory, "subway.pdf");
    writeFileSync(pdfPath, download(sourceUrl));
    const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    const byName = new Map(parse(text, sourceUrl).map((item) => [item.name.toLocaleLowerCase(), item]));
    const menu = [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
    if (menu.length < 100) throw new Error(`Only ${menu.length} Subway rows were parsed; refusing to replace the catalogue`);

    const output = [
      "// Generated from Subway Australia's official May 2026 nutrition PDF by scripts/import-subway.mjs.",
      "// Values are per published serving. Re-run the importer when the official source document changes.",
      "export type SubwayMenuDatum = readonly [name: string, servingGrams: number, calories: number, protein: number, carbohydrates: number, fat: number];",
      "",
      "export const subwayMenu: readonly SubwayMenuDatum[] = [",
      ...menu.map((item) => `  ${JSON.stringify([item.name, item.servingGrams, item.calories, item.protein, item.carbohydrates, item.fat])},`),
      "] as const;",
      "",
    ];
    process.stdout.write(output.join("\n"));
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

await main();
