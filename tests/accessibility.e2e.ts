import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect(violations, violations.map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`).join("\n")).toEqual([]);
}

async function swipeScreen(page:Page,from:{x:number;y:number},to:{x:number;y:number}){
  await page.locator("main").evaluate((target,{from,to})=>{
    const make=(point:{x:number;y:number})=>new Touch({identifier:7,target,clientX:point.x,clientY:point.y,screenX:point.x,screenY:point.y,radiusX:2,radiusY:2,rotationAngle:0,force:0.5});
    target.dispatchEvent(new TouchEvent("touchstart",{bubbles:true,cancelable:true,touches:[make(from)],targetTouches:[make(from)],changedTouches:[make(from)]}));
    target.dispatchEvent(new TouchEvent("touchend",{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[make(to)]}));
  },{from,to});
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

test("horizontal swipes work across primary content and from the screen edge",async({page})=>{
  await page.goto("/#screen=body&date=2026-07-27");
  await expect(page.getByRole("button",{name:"Body",exact:true})).toHaveAttribute("aria-current","page");
  await swipeScreen(page,{x:330,y:430},{x:80,y:430});
  await expect(page.getByRole("button",{name:"Calendar",exact:true})).toHaveAttribute("aria-current","page");
  await swipeScreen(page,{x:20,y:430},{x:300,y:430});
  await expect(page.getByRole("button",{name:"Body",exact:true})).toHaveAttribute("aria-current","page");
});

test("food and recipe picker has labelled, accessible controls", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose Food" })).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.getByRole("button", { name: "Log", exact: true }).first().waitFor();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: /Beef Rice Bowl/i }).click();
  const recipeName = page.getByLabel("Recipe name");
  await expect(recipeName).not.toBeFocused();
  await expect(recipeName).toHaveCSS("font-size", "16px");
  await expect(page.getByRole("button", { name: "Add ingredient", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Create a new ingredient food/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Add ingredient", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose Ingredient" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Filter by category" })).toBeVisible();
  await page.getByPlaceholder("Food name, brand or category").fill("Quick oats");
  await page.locator(".recipe-ingredient-picker .food-select").filter({ hasText: "Quick oats" }).click();
  await expect(page.getByRole("spinbutton", { name: "Quantity for Quick oats" })).toBeVisible();
  await expect(page.getByLabel("Preparation steps")).toHaveCSS("font-size", "16px");
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

test("Australian generic search understands common food names and aliases", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  const search = page.getByPlaceholder("Food name, brand or category");
  await search.fill("naval orange");
  await expect(page.getByText("Orange, navel, peeled, raw", { exact: true })).toBeVisible();
  await search.fill("quick oats");
  await expect(page.getByText("Quick oats", { exact: true })).toBeVisible();
  await expect(page.getByText("Oats, rolled, uncooked", { exact: true })).toBeVisible();
});

test("renaming a recipe updates its existing day card", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.getByRole("button", { name: "Log", exact: true }).first().click();
  await page.getByRole("button", { name: "Log recipe" }).click();
  await expect(page.getByRole("button", { name: "Edit Beef Rice Bowl" })).toBeVisible();

  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.getByRole("button", { name: /Beef Rice Bowl/i }).click();
  await page.getByLabel("Recipe name").fill("Weeknight Beef Bowl");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Edit Weeknight Beef Bowl" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Beef Rice Bowl" })).toHaveCount(0);
});

test("Australian fast food catalogue finds Chicken Rappa offline and requires review", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: /Import label/i }).click();
  await page.getByRole("button", { name: /Australian fast food/i }).click();
  await expect(page.getByRole("heading", { name: "Australian Fast Food" })).toBeVisible();
  await page.getByPlaceholder("Restaurant or menu item").fill("Chicken Rappa");
  const result = page.getByRole("button", { name: /Chicken Rappa.*Oporto.*420 kcal/i }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByLabel("Food name")).toHaveValue("Chicken Rappa");
  await expect(page.getByLabel("Brand (optional)")).toHaveValue("Oporto");
  await expect(page.getByRole("spinbutton", { name: "Energy in kilocalories" })).toHaveValue("420");
  await expect(page.getByRole("button", { name: "Save verified food" })).toBeDisabled();
  await expectNoSeriousViolations(page);
});

test("energy unit toggle updates and persists", async ({ page }) => {
  const yesterday = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  await page.goto(`/#screen=day&date=${yesterday}`);
  const kcal = page.getByRole("button", { name: /Energy shown in kilocalories/i });
  await expect(kcal).toBeVisible();
  await kcal.click();
  await expect(page.getByRole("button", { name: /Energy shown in kilojoules/i })).toBeVisible();
  await expect(page.getByText(/kJ/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Energy shown in kilojoules/i })).toBeVisible();
});

test("custom food energy can be entered in kcal or kJ", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: "Add custom food" }).click();

  const energy = page.getByRole("spinbutton", { name: "Energy in kilocalories" });
  await energy.fill("100");
  const unit = page.getByRole("button", { name: /Energy unit kcal/i });
  await unit.click();
  const kilojoules = page.getByRole("spinbutton", { name: "Energy in kilojoules" });
  await expect(kilojoules).toHaveValue("418.4");
  await kilojoules.fill("836.8");
  await page.getByRole("button", { name: /Energy unit kJ/i }).click();
  await expect(page.getByRole("spinbutton", { name: "Energy in kilocalories" })).toHaveValue("200");
  await expectNoSeriousViolations(page);
});

test("add weight opens without focusing or zooming the numeric field", async ({ page }) => {
  await page.goto("/#screen=body&date=2026-07-27");
  await page.getByRole("button", { name: "Add weight" }).click();
  const weight = page.getByRole("spinbutton", { name: /Weight/ });
  await expect(weight).toBeVisible();
  await expect(weight).not.toBeFocused();
  await expect(weight).toHaveCSS("font-size", "16px");
});

test("per-serving custom food logs and displays as serves", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: "Add custom food" }).click();
  await page.getByLabel("Food name").fill("Serving unit test");
  await page.getByLabel("Per serving").check();
  await expect(page.getByRole("combobox", { name: "Unit", exact: true })).toHaveValue("serving");
  await page.getByRole("spinbutton", { name: "Energy in kilocalories" }).fill("100");
  await page.getByRole("button", { name: "Save food" }).click();
  await page.getByPlaceholder("Food name, brand or category").fill("Serving unit test");
  await page.getByRole("button", { name: /Serving unit test.*Never logged/i }).click();
  await page.getByRole("spinbutton", { name: "Servings / quantity" }).fill("2");
  await page.getByRole("button", { name: "Add food" }).click();
  await expect(page.getByRole("button", { name: "Edit Serving unit test" }).getByText("2 serves")).toBeVisible();
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByPlaceholder("Food name, brand or category").fill("Serving unit test");
  await page.getByRole("button", { name: "Edit Serving unit test" }).click();
  await page.getByRole("button", { name: "Delete saved food" }).click();
  await expect(page.getByRole("dialog", { name: "Delete Serving unit test?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete food", exact: true }).click();
  await expect(page.getByText("Serving unit test deleted from saved foods")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Serving unit test" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Edit Serving unit test" }).getByText("2 serves")).toBeVisible();
});
