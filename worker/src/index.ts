interface Env {
  FATSECRET_CLIENT_ID: string;
  FATSECRET_CLIENT_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

interface FatSecretFoodSummary {
  food_id: string | number;
  food_name: string;
  brand_name?: string;
  food_description?: string;
}

interface FatSecretServing {
  serving_id?: string | number;
  serving_description?: string;
  metric_serving_amount?: string | number;
  metric_serving_unit?: string;
  calories?: string | number;
  carbohydrate?: string | number;
  protein?: string | number;
  fat?: string | number;
  fiber?: string | number;
  is_default?: string | number;
}

const restaurants = [
  "McDonald's", "KFC", "Hungry Jack's", "Subway", "Domino's", "Pizza Hut", "Red Rooster", "Oporto", "Nando's", "Guzman y Gomez",
  "Grill'd", "Zambrero", "Mad Mex", "Taco Bell", "Carl's Jr.", "Starbucks", "Gloria Jean's", "The Coffee Club", "Boost Juice", "Donut King",
  "Krispy Kreme", "Bakers Delight", "Muffin Break", "Sushi Hub", "Roll'd", "Schnitz", "Betty's Burgers", "Burger Urge", "Lord of the Fries", "Soul Origin",
  "SumoSalad", "Fishbowl", "El Jannah", "Ribs & Burgers", "Crust Pizza", "Pizza Capers", "Gelatissimo", "San Churro", "Max Brenner", "Chatime",
  "Gong Cha", "Sharetea", "Oliver's Real Food", "Jamaica Blue", "Hudsons Coffee", "Zarraffa's Coffee", "Pie Face", "Chicken Treat", "Rashays", "The Cheesecake Shop",
] as const;

const aliases: Record<string, string[]> = {
  "McDonald's": ["McDonald's", "McDonalds", "Macca's"],
  "Hungry Jack's": ["Hungry Jack's", "Hungry Jacks"],
  "Guzman y Gomez": ["Guzman y Gomez", "GYG"],
  "Carl's Jr.": ["Carl's Jr.", "Carls Jr"],
  "Domino's": ["Domino's", "Dominos"],
  "Nando's": ["Nando's", "Nandos"],
  "Grill'd": ["Grill'd", "Grilld"],
  "Betty's Burgers": ["Betty's Burgers", "Bettys Burgers"],
};

let tokenCache: { value: string; expiresAt: number } | undefined;

const asArray = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const number = (value: string | number | undefined) => Number(value ?? 0);
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");

async function accessToken(env: Env): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  if (!env.FATSECRET_CLIENT_ID || !env.FATSECRET_CLIENT_SECRET) throw new Error("Restaurant provider credentials are not configured");
  const credentials = btoa(`${env.FATSECRET_CLIENT_ID}:${env.FATSECRET_CLIENT_SECRET}`);
  const response = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "basic localization" }),
  });
  const data = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "FatSecret authentication failed");
  tokenCache = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function fatSecret<T>(env: Env, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://platform.fatsecret.com/rest/${path}`);
  for (const [key, value] of Object.entries({ ...params, format: "json", region: "AU", language: "en" })) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(env)}` } });
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok || data.error) throw new Error(data.error?.message || `FatSecret request failed (${response.status})`);
  return data;
}

function cors(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS || "https://charlkie.github.io,http://localhost:5173,http://127.0.0.1:5173").split(",").map(value => value.trim());
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0]!,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function json(request: Request, env: Env, value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: cors(request, env) });
}

async function search(request: Request, env: Env, url: URL): Promise<Response> {
  const restaurant = url.searchParams.get("restaurant")?.trim() ?? "";
  if (!restaurants.includes(restaurant as typeof restaurants[number])) return json(request, env, { error: "Choose a supported Australian restaurant" }, 400);
  const page = Math.max(0, Number.parseInt(url.searchParams.get("page") || "0", 10) || 0);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const names = aliases[restaurant] ?? [restaurant];
  const data = await fatSecret<{ foods?: { food?: FatSecretFoodSummary | FatSecretFoodSummary[]; total_results?: string | number; max_results?: string | number } }>(env, "foods/search/v3", {
    search_expression: `${names[0]} ${query}`.trim(), page_number: String(page), max_results: "50",
  });
  const accepted = names.map(normalize);
  const items = asArray(data.foods?.food).filter(food => {
    const brand = normalize(food.brand_name || "");
    return Boolean(brand) && accepted.some(name => brand.includes(name) || name.includes(brand));
  }).map(food => ({ id: String(food.food_id), name: food.food_name, restaurant, description: food.food_description }));
  const total = number(data.foods?.total_results);
  const perPage = number(data.foods?.max_results) || 50;
  return json(request, env, { items, page, hasMore: (page + 1) * perPage < total });
}

async function food(request: Request, env: Env, id: string): Promise<Response> {
  if (!/^\d+$/.test(id)) return json(request, env, { error: "Invalid food identifier" }, 400);
  const data = await fatSecret<{ food?: { food_id?: string | number; food_name?: string; brand_name?: string; servings?: { serving?: FatSecretServing | FatSecretServing[] } } }>(env, "food/v4", { food_id: id, flag_default_serving: "true" });
  const item = data.food;
  const servings = asArray(item?.servings?.serving);
  const serving = servings.find(candidate => number(candidate.is_default) === 1) ?? servings[0];
  if (!item?.food_name || !serving) return json(request, env, { error: "This menu item has no usable Australian serving" }, 404);
  const metric = number(serving.metric_serving_amount);
  const importedAt = new Date().toISOString();
  return json(request, env, { food: {
    name: item.food_name,
    brand: item.brand_name,
    categoryId: "other",
    calculationMode: "perServing",
    baseQuantity: 1,
    baseUnit: "serving",
    servingDescription: serving.serving_description || (metric ? `1 serve (${metric} ${serving.metric_serving_unit || "g"})` : "1 serve"),
    calories: number(serving.calories),
    protein: number(serving.protein),
    carbohydrates: number(serving.carbohydrate),
    fat: number(serving.fat),
    fibre: serving.fiber === undefined ? undefined : number(serving.fiber),
    notes: "Retrieved from the FatSecret Australian database. Restaurant recipes and portions can change; verify before saving.",
    source: { kind: "restaurant", provider: "fatsecret Platform API", externalId: String(item.food_id || id), datasetVersion: "Live Australian result", importedAt, sourceUrl: "https://platform.fatsecret.com" },
  } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request, env) });
    if (request.method !== "GET") return json(request, env, { error: "Method not allowed" }, 405);
    const url = new URL(request.url);
    try {
      if (url.pathname === "/restaurants") return json(request, env, { restaurants });
      if (url.pathname === "/search") return await search(request, env, url);
      const match = url.pathname.match(/^\/food\/(\d+)$/);
      if (match) return await food(request, env, match[1]!);
      return json(request, env, { error: "Not found" }, 404);
    } catch (error) {
      return json(request, env, { error: error instanceof Error ? error.message : "Restaurant provider failed" }, 502);
    }
  },
};
