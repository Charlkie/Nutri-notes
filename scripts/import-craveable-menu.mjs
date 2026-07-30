#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const configs = {
  oporto: {
    brand: "Oporto",
    sourcePage: "https://www.oporto.com.au/locations/west-ipswich/menu/",
    exportName: "oportoMenu",
    typeName: "OportoMenuDatum",
    minimumRows: 140,
  },
  "red-rooster": {
    brand: "Red Rooster",
    sourcePage: "https://www.redrooster.com.au/locations/mindarie/menu/",
    exportName: "redRoosterMenu",
    typeName: "RedRoosterMenuDatum",
    minimumRows: 175,
  },
};

const requestedBrand = process.argv[2];
const config = configs[requestedBrand];
if (!config) throw new Error("Usage: node scripts/import-craveable-menu.mjs <oporto|red-rooster>");

const downloadText = (url) => execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", "--compressed", url], {
  encoding: "utf8",
  maxBuffer: 100 * 1024 * 1024,
});

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function sourceMenuUrl(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`Could not find ${config.brand}'s embedded store data`);
  const page = JSON.parse(match[1]);
  const result = page?.props?.pageProps?.data?.pageDataContent?.data?.result;
  const storeName = clean(result?.metadata?.store?.attributes?.storeName);
  const menus = result?.metadata?.menu?.result;
  const pickup = Array.isArray(menus) ? menus.find((menu) => menu.menuType === 2 || menu.channelLinkName === "Pickup") : undefined;
  if (!pickup?.menuUrls) throw new Error(`Could not find ${config.brand}'s pickup-menu feed`);
  return { storeName, menuUrl: pickup.menuUrls };
}

function extractRows(menu) {
  const rowsByName = new Map();
  const visit = (item, category, depth) => {
    if (!item || typeof item !== "object") return;
    if (
      item.productType === 1 &&
      Number.isFinite(item.kJ) &&
      item.kJ >= 0 &&
      Number.isFinite(item.calories) &&
      item.calories >= 0 &&
      item.snoozed !== true
    ) {
      const name = clean(item.name);
      const key = name.toLocaleLowerCase();
      const existing = rowsByName.get(key);
      if (name && (!existing || depth < existing.depth)) {
        rowsByName.set(key, {
          name,
          kilojoules: item.kJ,
          calories: item.calories,
          category,
          depth,
        });
      }
    }
    for (const child of item.subItems ?? []) visit(child, category, depth + 1);
  };

  for (const category of menu.categories ?? []) {
    const categoryName = clean(category.name);
    if (!categoryName || /^hidden$/i.test(categoryName)) continue;
    for (const product of category.products ?? []) visit(product, categoryName, 0);
  }

  return [...rowsByName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

const html = downloadText(config.sourcePage);
const { storeName, menuUrl } = sourceMenuUrl(html);
const menu = JSON.parse(downloadText(menuUrl));
const rows = extractRows(menu);
if (rows.length < config.minimumRows) {
  throw new Error(`Only ${rows.length} ${config.brand} rows were parsed; refusing to replace the catalogue`);
}

const output = [
  `// Generated from ${config.brand}'s official Australian pickup-menu feed by scripts/import-craveable-menu.mjs.`,
  "// The feed publishes energy per configured menu item; protein, carbohydrates, fat and fibre are not included.",
  `export type ${config.typeName} = readonly [name: string, kilojoules: number, calories: number, category: string];`,
  "",
  `export const ${config.exportName}Source = ${JSON.stringify({ sourcePage: config.sourcePage, menuUrl, menuUpdatedAt: menu.updatedDateTime, storeName })} as const;`,
  "",
  `export const ${config.exportName}: readonly ${config.typeName}[] = [`,
  ...rows.map((row) => `  ${JSON.stringify([row.name, row.kilojoules, row.calories, row.category])},`),
  "] as const;",
  "",
];

process.stdout.write(output.join("\n"));
