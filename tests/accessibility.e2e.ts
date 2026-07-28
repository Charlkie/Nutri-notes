import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect(violations, violations.map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`).join("\n")).toEqual([]);
}

test("primary screens have no serious automated accessibility violations", async ({ page }) => {
  for (const screen of ["day", "body", "calendar", "charts", "settings"] as const) {
    await page.goto(`/#screen=${screen}&date=2026-07-27`);
    await page.locator("main").waitFor();
    await expectNoSeriousViolations(page);
  }
});

test("food and recipe picker has labelled, accessible controls", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose Food" })).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.getByRole("button", { name: "Log", exact: true }).first().waitFor();
  await expectNoSeriousViolations(page);
});
