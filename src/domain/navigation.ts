import type { ISODate } from "./types";

export const primaryRoutes = ["day", "body", "calendar", "charts", "settings"] as const;
export type PrimaryRoute = (typeof primaryRoutes)[number];

export interface RestoredNavigation {
  route: PrimaryRoute;
  date: ISODate;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): value is ISODate {
  if (!isoDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseNavigationHash(hash: string, fallbackDate: ISODate): RestoredNavigation {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const requestedRoute = params.get("screen");
  const requestedDate = params.get("date");
  return {
    route: primaryRoutes.includes(requestedRoute as PrimaryRoute) ? requestedRoute as PrimaryRoute : "day",
    date: requestedDate && isISODate(requestedDate) ? requestedDate : fallbackDate,
  };
}

export function navigationHash(route: PrimaryRoute, date: ISODate): string {
  return `#screen=${route}&date=${date}`;
}

export function isPrimaryRoute(route: string): route is PrimaryRoute {
  return primaryRoutes.includes(route as PrimaryRoute);
}
