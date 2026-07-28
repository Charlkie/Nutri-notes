import { expect, test } from "@playwright/test";

test("installed production app reloads and opens lazy features offline", async ({ context, page }) => {
  await page.goto("/#screen=calendar&date=2026-07-28");

  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.getRegistrations().then(items => items.length))).toBeGreaterThan(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Calendar", exact: true })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: /Start New Day/i }).click();
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log", exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(390);
});
