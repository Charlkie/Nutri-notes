#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE_URL = "https://www.guzmanygomez.com.au/wp-content/uploads/2026/07/260617_NUTRITION_ALLERGEN_GUIDE_420X297MM.pdf";
const NUMBER = "-?\\d[\\d,]*(?:\\.\\d+)?";
const ROW = new RegExp(`(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s*$`);

const clean = (value) => value.replace(/\s+/g, " ").trim();
const numeric = (value) => Number(value.replaceAll(",", ""));
const download = (url) => execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", url], { maxBuffer: 100 * 1024 * 1024 });
const titleCase = (value) => value.toLocaleLowerCase().replace(/(^|[\s&/(-])\p{L}/gu, (letter) => letter.toLocaleUpperCase());

function sectionName(line, current) {
  if (line.includes("SERVE SIZE")) {
    const prefix = clean(line.slice(0, line.indexOf("SERVE SIZE"))).replace(/\s*\(CONT\.\)$/i, "");
    if (prefix) return titleCase(prefix);
  }
  if (/^[A-Z0-9$’'& /,().-]+\s{4,}\(g\)\s*$/u.test(line)) {
    const prefix = clean(line.split(/\s{4,}/)[0] ?? "").replace(/\s*\(CONT\.\)$/i, "");
    if (prefix) return titleCase(prefix);
  }
  return current;
}

function parse(text) {
  const nutrition = text.slice(text.indexOf("NUTRITIONAL INFORMATION"));
  const lines = nutrition.split(/\r?\n/);
  const rows = [];
  let section = "";
  let candidateName = "";

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = clean(rawLine).replaceAll("less than 0.1", "0.05");
    section = sectionName(rawLine, section);
    if (line.includes("SERVE SIZE") || line.includes("ENERGY (kJ)") || line.includes("Information is based") || line.includes("NUTRITIONAL INFORMATION")) continue;

    const match = line.match(ROW);
    if (match) {
      const prefix = clean(line.slice(0, match.index));
      let name = prefix || candidateName;
      const continuation = clean(lines[index + 1] ?? "");
      if (!prefix && continuation && continuation.length < 45 && (/^[a-z]/.test(continuation) || /(?:with|&)$/i.test(name) || /^(?:sauce|mayo|guac)$/i.test(continuation))) name = `${name} ${continuation}`;
      const [servingGrams, , calories, protein, fat, , carbohydrates] = match.slice(1).map(numeric);
      if (!name || !section || servingGrams <= 0 || /^(?:For |Swap |Add |Extra )/i.test(name)) continue;
      if (![servingGrams, calories, protein, fat, carbohydrates].every(Number.isFinite)) continue;
      rows.push({name:`${name} (${section})`,servingGrams,calories,protein,carbohydrates,fat});
      continue;
    }

    if (line && line.length < 120 && !line.startsWith("At Guzman") && !line.startsWith("With traditional") && !line.startsWith("when it comes") && !line.startsWith("and cooked") && !line.startsWith("Information may") && !line.startsWith("July 2")) candidateName = line;
  }
  return rows;
}

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "nutri-notes-gyg-"));
  try {
    const pdfPath = join(directory, "gyg.pdf");
    writeFileSync(pdfPath, download(SOURCE_URL));
    const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    const byName = new Map(parse(text).map((item) => [item.name.toLocaleLowerCase(), item]));
    const menu = [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
    if (menu.length < 150) throw new Error(`Only ${menu.length} GYG rows were parsed; refusing to replace the catalogue`);
    const output = [
      "// Generated from Guzman y Gomez Australia's official July 2026 nutrition guide by scripts/import-gyg.mjs.",
      "// Published '<0.1 g' values are represented as 0.05 g for arithmetic.",
      "export type GygMenuDatum = readonly [name: string, servingGrams: number, calories: number, protein: number, carbohydrates: number, fat: number];",
      "",
      "export const gygMenu: readonly GygMenuDatum[] = [",
      ...menu.map((item) => `  ${JSON.stringify([item.name,item.servingGrams,item.calories,item.protein,item.carbohydrates,item.fat])},`),
      "] as const;",
      "",
    ];
    process.stdout.write(output.join("\n"));
  } finally {
    rmSync(directory,{recursive:true,force:true});
  }
}

await main();
