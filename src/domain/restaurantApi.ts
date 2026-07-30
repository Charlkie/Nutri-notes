import type { FoodDraft } from "./foodImport";

export interface RestaurantProviderItem {
  id: string;
  name: string;
  restaurant: string;
  description?: string;
}

export interface RestaurantSearchPage {
  items: RestaurantProviderItem[];
  page: number;
  hasMore: boolean;
}

const configuredBaseUrl = (import.meta.env.VITE_RESTAURANT_API_URL as string | undefined)?.replace(/\/$/, "");

export function restaurantApiConfigured(): boolean {
  return Boolean(configuredBaseUrl);
}

async function providerRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!configuredBaseUrl) throw new Error("Online restaurant search is not configured yet");
  let response: Response;
  try {
    response = await fetch(`${configuredBaseUrl}${path}`, { signal });
  } catch {
    throw new Error("The Australian restaurant service could not be reached. Offline menu items are still available.");
  }
  const data = await response.json().catch(() => undefined) as { error?: string } | undefined;
  if (!response.ok) throw new Error(data?.error || `Restaurant search failed (${response.status})`);
  return data as T;
}

export function fetchRestaurantNames(signal?: AbortSignal): Promise<string[]> {
  return providerRequest<{ restaurants: string[] }>("/restaurants", signal).then(result => result.restaurants);
}

export function fetchRestaurantMenu(restaurant: string, query: string, page: number, signal?: AbortSignal): Promise<RestaurantSearchPage> {
  const params = new URLSearchParams({ restaurant, q: query.trim(), page: String(page) });
  return providerRequest<RestaurantSearchPage>(`/search?${params}`, signal);
}

export function fetchRestaurantFood(id: string, signal?: AbortSignal): Promise<FoodDraft> {
  return providerRequest<{ food: FoodDraft }>(`/food/${encodeURIComponent(id)}`, signal).then(result => result.food);
}
