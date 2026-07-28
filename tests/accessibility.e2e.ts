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
    if (screen === "settings")
      await Promise.all([
        expect(
          page.getByRole("button", { name: /Connect your Dropbox/i }),
        ).toBeVisible(),
        expect(page.getByText("Automatic Google Drive backup")).toBeVisible(),
      ]);
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

test("FSANZ search and label imports require review before saving", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByPlaceholder("Food name, brand or category").fill("barramundi");
  await expect(page.getByText(/FSANZ AUSNUT 2023/i).first()).toBeVisible();

  await page.getByRole("button", { name: /Import label/i }).click();
  await page.getByRole("button", { name: /Import a nutrition label/i }).click();
  await page.getByLabel("Detected or pasted label text").fill("Energy 640 kJ\nProtein 5.2 g\nFat 3.1 g\nCarbohydrate 24.6 g\nDietary fibre 4 g");
  await page.getByRole("button", { name: "Review extracted values" }).click();
  await page.getByLabel("Food name").fill("Test label food");
  const save = page.getByRole("button", { name: "Save verified food" });
  await expect(save).toBeDisabled();
  await page.getByRole("checkbox", { name: /I checked these values/i }).check();
  await expect(save).toBeEnabled();
  await expectNoSeriousViolations(page);
});

test("energy unit toggle updates and persists", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-28");
  const kcal = page.getByRole("button", { name: /Energy shown in kilocalories/i });
  await expect(kcal).toBeVisible();
  await kcal.click();
  await expect(page.getByRole("button", { name: /Energy shown in kilojoules/i })).toBeVisible();
  await expect(page.getByText(/kJ/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Energy shown in kilojoules/i })).toBeVisible();
});
