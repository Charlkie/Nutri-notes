#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const CONFIGURATION_URL = "https://discover.prod.pizzahutaustralia.com.au/api/v1/Configuration";
const MINIMUM_ROWS = 80;

const downloadJson = (url) => JSON.parse(execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", "--compressed", String(url)], {
  encoding: "utf8",
  maxBuffer: 100 * 1024 * 1024,
}));

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const withQuery = (base, path, parameters) => {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));
  return url;
};

const configuration = downloadJson(CONFIGURATION_URL);
const storeApi = configuration?.uris?.API_STORE;
const productApi = configuration?.uris?.API_PRODUCT;
if (!storeApi || !productApi) throw new Error("Pizza Hut configuration did not expose its Australian store and product APIs");

const stores = downloadJson(withQuery(storeApi, "/api/v1/store", { includeComingSoon: false, includeTradingDays: true }));
const store = stores.find((candidate) => candidate.canPickup && candidate.tradingDays?.length > 1);
if (!store) throw new Error("No currently trading Pizza Hut Australia pickup store was available");

const tradingDay = store.tradingDays[1] ?? store.tradingDays[0];
const fulfilmentDateTime = `${tradingDay.storeTime.slice(0, 10)}T18:00`;
const common = { storeCode: store.code, fulfilmentDateTime, fulfilmentType: "Pickup" };
const categoryResponse = downloadJson(withQuery(productApi, "/api/v1/product/categories", common));
const categories = (categoryResponse.productCategories ?? []).filter((category) =>
  !category.isHidden &&
  !/^(?:Deals|Testing Ground|catering)$/i.test(clean(category.name)),
);

const rows = [];
for (const category of categories) {
  const response = downloadJson(withQuery(productApi, "/api/v1/product/products", {
    ...common,
    primaryCategory: category.code,
    includeIngredientDetails: false,
  }));
  for (const product of response.products ?? []) {
    if (product.isOutOfStock || /Half\s*&\s*Half/i.test(product.name ?? "")) continue;
    for (const size of product.sizes ?? []) {
      const kilojoules = Number(size.energy);
      if (!Number.isFinite(kilojoules) || kilojoules <= 0) continue;
      const productName = clean(product.name);
      const sizeName = clean(size.name) || "Standard";
      const productType = clean(product.productType) || clean(category.name);
      rows.push({
        name: `${productName} — ${sizeName}${productType === "Pizzas" ? " Original Pan" : ""}`,
        category: clean(category.name),
        sizeName,
        productType,
        kilojoules,
      });
    }
  }
}

const unique = new Map();
for (const row of rows) unique.set(`${row.name}|${row.kilojoules}`.toLocaleLowerCase(), row);
const menu = [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
if (menu.length < MINIMUM_ROWS) {
  throw new Error(`Only ${menu.length} Pizza Hut rows were parsed; refusing to replace the catalogue`);
}

const output = [
  "// Generated from Pizza Hut Australia's official store and product APIs by scripts/import-pizza-hut.mjs.",
  "// The feed publishes item energy. Pizza kJ values are explicitly based on the Original Pan base; macros are not included.",
  "export type PizzaHutMenuDatum = readonly [name: string, category: string, sizeName: string, productType: string, kilojoules: number];",
  "",
  `export const pizzaHutMenuSource = ${JSON.stringify({ configurationUrl: CONFIGURATION_URL, productApi, storeCode: store.code, storeName: clean(store.name) })} as const;`,
  "",
  "export const pizzaHutMenu: readonly PizzaHutMenuDatum[] = [",
  ...menu.map((row) => `  ${JSON.stringify([row.name, row.category, row.sizeName, row.productType, row.kilojoules])},`),
  "] as const;",
  "",
];

process.stdout.write(output.join("\n"));
