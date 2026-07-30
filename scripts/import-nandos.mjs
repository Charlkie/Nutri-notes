#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const INDEX_URL = "https://www.nandos.com.au/menu-item";
const ORIGIN = "https://www.nandos.com.au/";
const MINIMUM_ROWS = 18;

const download = (url) => execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", "--compressed", String(url)], {
  encoding: "utf8",
  maxBuffer: 100 * 1024 * 1024,
});

const clean = (value) => String(value ?? "")
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replaceAll("&amp;", "&")
  .replaceAll("&#039;", "'")
  .replaceAll("&nbsp;", " ")
  .replace(/\s+/g, " ")
  .trim();

function pageProps(html, url) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`Could not find Nando's embedded page data at ${url}`);
  return JSON.parse(match[1]).props.pageProps;
}

function listingPages(props) {
  const pages = [];
  for (const block of props.contentMatrix ?? []) {
    if (!Array.isArray(block.pages)) continue;
    for (const page of block.pages) {
      if (!page.uri?.startsWith("menu-item/")) continue;
      pages.push({ title: clean(page.title), category: clean(block.heading), path: page.uri });
    }
  }
  const unique = new Map();
  for (const page of pages) unique.set(page.path, page);
  return [...unique.values()];
}

function numberWithUnit(value, unit) {
  const match = clean(value).match(new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${unit}`, "i"));
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function nutritionRows(page, props) {
  const rows = [];
  for (const block of props.contentMatrix ?? []) {
    if (!/Nutritional Information/i.test(block.blockTitle ?? "") || !/<table/i.test(block.body ?? "")) continue;
    const body = block.body;
    const tables = [...body.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
    tables.forEach((table, index) => {
      const before = body.slice(0, table.index);
      const priorParagraphs = [...before.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((match) => clean(match[1]))
        .filter(Boolean);
      const variant = tables.length > 1 ? priorParagraphs.at(-1) : "";
      const values = {};
      for (const pair of table[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) {
        const label = clean(pair[1]);
        const value = clean(pair[2]);
        if (label === "Energy" && /kcal/i.test(value)) values.calories = numberWithUnit(value, "kcal");
        else if (label === "Energy" && /kJ/i.test(value)) values.kilojoules = numberWithUnit(value, "kJ");
        else if (label === "Total Fat") values.fat = numberWithUnit(value, "g");
        else if (label === "Total Carb") values.carbohydrates = numberWithUnit(value, "g");
        else if (label === "Protein") values.protein = numberWithUnit(value, "g");
        else if (label === "Weight") values.servingGrams = numberWithUnit(value, "g");
      }
      if (![values.calories, values.kilojoules, values.fat, values.carbohydrates, values.protein, values.servingGrams].every(Number.isFinite)) return;
      rows.push({
        name: variant && !page.title.toLocaleLowerCase().includes(variant.toLocaleLowerCase()) ? `${page.title} — ${variant}` : variant || page.title,
        category: page.category,
        path: page.path,
        ...values,
      });
    });
  }
  return rows;
}

const indexProps = pageProps(download(INDEX_URL), INDEX_URL);
const pages = listingPages(indexProps);
const rows = [];
for (const page of pages) {
  const url = new URL(page.path, ORIGIN);
  rows.push(...nutritionRows(page, pageProps(download(url), url)));
}

const unique = new Map();
for (const row of rows) unique.set(row.name.toLocaleLowerCase(), row);
const menu = [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
if (menu.length < MINIMUM_ROWS) {
  throw new Error(`Only ${menu.length} Nando's rows were parsed; refusing to replace the catalogue`);
}

const output = [
  "// Generated from Nando's Australia official nutritional-information pages by scripts/import-nandos.mjs.",
  "// Values are per published serving. Each row retains its item-specific official source path.",
  "export type NandosMenuDatum = readonly [name: string, category: string, servingGrams: number, kilojoules: number, calories: number, protein: number, carbohydrates: number, fat: number, sourcePath: string];",
  "",
  `export const nandosMenuIndexUrl = ${JSON.stringify(INDEX_URL)};`,
  "",
  "export const nandosMenu: readonly NandosMenuDatum[] = [",
  ...menu.map((row) => `  ${JSON.stringify([row.name, row.category, row.servingGrams, row.kilojoules, row.calories, row.protein, row.carbohydrates, row.fat, row.path])},`),
  "] as const;",
  "",
];

process.stdout.write(output.join("\n"));
