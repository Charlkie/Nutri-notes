#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const PAGE_URL = "https://www.hungryjacks.com.au/nutrition-info";
const ORIGIN = "https://www.hungryjacks.com.au";
const NUMBER = /^-?\d[\d,]*(?:\.\d+)?$/;

const numeric = (value) => Number(value.replaceAll(",", ""));
const clean = (value) => value.replace(/\s+/g, " ").trim();

async function download(url) {
  return execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", String(url)], { maxBuffer: 100 * 1024 * 1024 });
}

function titleFromFilename(filename) {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/^Nutritional-Guide-/, "")
    .replace(/-Nutritionals(?:_\d+)?$/i, "")
    .replace(/NutritionalGuideReport_Nutritional-Values-Report-/i, "")
    .replaceAll("-", " ");
}

function findFullName(lines, rowIndex, rowName) {
  for (let index = rowIndex - 1; index >= Math.max(0, rowIndex - 60); index -= 1) {
    const candidate = clean(lines[index] ?? "");
    if (!candidate || candidate.length > 150 || candidate.includes("Ingredients:") || candidate.includes("Description status")) continue;
    if (/(?:None|Permanent|LTO|Deleted|Temporary)\s+(?:None|Permanent|LTO|Deleted|Temporary|Yes|No)/i.test(candidate)) continue;
    if (candidate === rowName || (candidate.startsWith(rowName) && candidate.length > rowName.length)) return candidate;
  }
  return rowName;
}

function parsePdf(text, relativeUrl) {
  const lines = text.split(/\r?\n/);
  const rows = [];

  lines.forEach((rawLine, rowIndex) => {
    const tokens = clean(rawLine).split(" ");
    if (tokens.length < 20) return;
    const values = tokens.slice(-15);
    if (!values.every((value) => NUMBER.test(value))) return;

    const prefix = tokens.slice(0, -15);
    if (prefix.length < 5) return;
    const metadata = prefix.slice(-4);
    if (!metadata.every((value) => /^(?:None|Permanent|LTO|Deleted|Temporary|Yes|No)$/i.test(value))) return;

    const rowName = clean(prefix.slice(0, -4).join(" "));
    if (!rowName) return;
    const [servingGrams, , energyKj, , protein, , fat, , , , carbohydrates] = values.map(numeric);
    if (![servingGrams, energyKj, protein, fat, carbohydrates].every(Number.isFinite) || servingGrams <= 0 || energyKj < 0) return;

    rows.push({
      name: findFullName(lines, rowIndex, rowName),
      servingGrams,
      calories: Math.round(energyKj / 4.184),
      protein,
      carbohydrates,
      fat,
      relativeUrl,
    });
  });

  return rows;
}

async function main() {
  const page = (await download(PAGE_URL)).toString("utf8");
  const urls = [...new Set([...page.matchAll(/href="([^"]+\.pdf)/gi)].map((match) => match[1]))]
    .filter((url) => /nutrition/i.test(url) && !/allergen|ingredient/i.test(url));
  if (!urls.length) throw new Error("No Hungry Jack's nutrition PDFs were found");

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "nutri-notes-hj-"));
  try {
    const imported = [];
    for (const relativeUrl of urls) {
      const pdfPath = join(temporaryDirectory, basename(relativeUrl));
      writeFileSync(pdfPath, await download(new URL(relativeUrl, ORIGIN)));
      const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
      imported.push(...parsePdf(text, relativeUrl));
    }

    const byName = new Map();
    for (const item of imported) {
      byName.set(item.name.toLocaleLowerCase(), item);
    }
    const menu = [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
    if (menu.length < 150) throw new Error(`Only ${menu.length} menu rows were parsed; refusing to replace the catalogue`);

    const lines = [
      "// Generated from Hungry Jack's Australia official nutrition PDFs by scripts/import-hungry-jacks.mjs.",
      "// Values are per published serving. Re-run the importer when the official source documents change.",
      "export type HungryJacksMenuDatum = readonly [name: string, servingGrams: number, calories: number, protein: number, carbohydrates: number, fat: number, sourcePath: string, sourceVersion: string];",
      "",
      "export const hungryJacksMenu: readonly HungryJacksMenuDatum[] = [",
      ...menu.map((item) => `  ${JSON.stringify([item.name, item.servingGrams, item.calories, item.protein, item.carbohydrates, item.fat, item.relativeUrl, titleFromFilename(basename(item.relativeUrl))])},`),
      "] as const;",
      "",
    ];
    process.stdout.write(lines.join("\n"));
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

await main();
