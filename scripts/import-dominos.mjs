#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const SOURCE_URL = "https://www.dominos.com.au/menu/nutritional-information";
const MINIMUM_ROWS = 240;

const parameterNames = {
  "Serving Size": "servingGrams",
  "Energy (Calories)": "calories",
  "Energy (kilojoules)": "kilojoules",
  Protein: "protein",
  "Fat - Total": "fat",
  Carbohydrate: "carbohydrates",
};

const download = (url) => execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", "--compressed", url], {
  encoding: "utf8",
  maxBuffer: 100 * 1024 * 1024,
});

const decode = (value) => String(value ?? "")
  .replaceAll("&quot;", '"')
  .replaceAll("&#x27;", "'")
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replace(/\s+/g, " ")
  .trim();

const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

function parameterIds(html) {
  const ids = new Map();
  const pattern = /serving-parameter-([a-f\d-]+)" class="serving-info-name">([^<]+)</gi;
  for (const match of html.matchAll(pattern)) {
    const key = parameterNames[decode(match[2])];
    if (key) ids.set(match[1], key);
  }
  for (const required of Object.values(parameterNames)) {
    if (![...ids.values()].includes(required)) throw new Error(`Domino's page did not expose ${required}`);
  }
  return ids;
}

function cardRows(html) {
  const ids = parameterIds(html);
  const starts = [...html.matchAll(/<div class="card" id="[^"]+" data-productservinginfo="([^"]*)">/g)];
  const rows = [];

  starts.forEach((match, index) => {
    const end = starts[index + 1]?.index ?? html.length;
    const segment = html.slice(match.index, end);
    const productName = decode(segment.match(/class="product-card-heading">([\s\S]*?)<\/div>/i)?.[1]);
    if (!productName) return;

    const lastRangeStart = html.lastIndexOf('class="nutritional-product-range">', match.index);
    const category = lastRangeStart >= 0
      ? decode(html.slice(lastRangeStart).match(/^class="nutritional-product-range">([\s\S]*?)<\/div>/i)?.[1])
      : "Menu";
    const servingsPerItem = Number(segment.match(/origServ="([\d.]+)"/i)?.[1] ?? "1");

    const servingNames = new Map();
    for (const servingMatch of segment.matchAll(/data-servinginfo='([^']+)'/g)) {
      const serving = JSON.parse(decode(servingMatch[1]));
      servingNames.set(serving.Id, decode(serving.Name));
    }

    const values = JSON.parse(decode(match[1]));
    const byServing = new Map();
    for (const value of values) {
      const key = ids.get(value.ServingParameterId);
      if (!key) continue;
      const row = byServing.get(value.ServingId) ?? {};
      row[key] = numeric(value.Value);
      byServing.set(value.ServingId, row);
    }

    for (const [servingId, value] of byServing) {
      const variant = servingNames.get(servingId);
      if (
        !variant ||
        ![value.servingGrams, value.calories, value.kilojoules, value.protein, value.carbohydrates, value.fat].every(Number.isFinite) ||
        value.servingGrams <= 0
      ) continue;
      rows.push({
        name: `${productName} — ${variant}`,
        category,
        variant,
        servingsPerItem: Number.isFinite(servingsPerItem) && servingsPerItem > 0 ? servingsPerItem : 1,
        ...value,
      });
    }
  });

  const unique = new Map();
  for (const row of rows) unique.set(row.name.toLocaleLowerCase(), row);
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
}

const rows = cardRows(download(SOURCE_URL));
if (rows.length < MINIMUM_ROWS) {
  throw new Error(`Only ${rows.length} Domino's rows were parsed; refusing to replace the catalogue`);
}

const output = [
  "// Generated from Domino's Australia official online nutrition catalogue by scripts/import-dominos.mjs.",
  "// Pizza values are per published slice; servingsPerItem records the published number of slices per pizza.",
  "export type DominosMenuDatum = readonly [name: string, category: string, variant: string, servingGrams: number, servingsPerItem: number, kilojoules: number, calories: number, protein: number, carbohydrates: number, fat: number];",
  "",
  `export const dominosMenuSourceUrl = ${JSON.stringify(SOURCE_URL)};`,
  "",
  "export const dominosMenu: readonly DominosMenuDatum[] = [",
  ...rows.map((row) => `  ${JSON.stringify([row.name, row.category, row.variant, row.servingGrams, row.servingsPerItem, row.kilojoules, row.calories, row.protein, row.carbohydrates, row.fat])},`),
  "] as const;",
  "",
];

process.stdout.write(output.join("\n"));
