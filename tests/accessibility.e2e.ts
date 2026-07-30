import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect(violations, violations.map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`).join("\n")).toEqual([]);
}

async function swipeScreen(page:Page,from:{x:number;y:number},to:{x:number;y:number}){
  const session=await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:from.x,y:from.y}]});
  for(const progress of [0.25,0.5,0.75,1])await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress}]});
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await session.detach();
}

async function tapTouch(page:Page,target:Locator){
  const box=await target.boundingBox();
  expect(box).not.toBeNull();
  const point={x:box!.x+box!.width/2,y:box!.y+box!.height/2};
  const session=await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[point]});
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await session.detach();
}

async function longPressTouch(page:Page,target:Locator){
  const box=await target.boundingBox();
  expect(box).not.toBeNull();
  const point={x:box!.x+box!.width/2,y:box!.y+box!.height/2};
  const session=await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[point]});
  await page.waitForTimeout(460);
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await session.detach();
}

test("primary screens have no serious automated accessibility violations", async ({ page }) => {
  for (const screen of ["day", "body", "calendar", "charts", "settings"] as const) {
    await page.goto(`/#screen=${screen}&date=2026-07-27`);
    await (screen==="day"?page.locator(".day-carousel-panel:not([aria-hidden]) .day-screen"):page.locator(".auxiliary-overlay > main")).waitFor();
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

test("horizontal swipes change days and secondary screens minimise to the tracker",async({page})=>{
  await page.goto("/#screen=day&date=2026-07-27");
  await expect(page.getByText("27 July 2026",{exact:true})).toBeVisible();
  const track=page.locator(".day-carousel-track");
  const session=await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:330,y:430}]});
  await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:195,y:430}]});
  await expect.poll(()=>track.evaluate(element=>getComputedStyle(element).transform)).not.toBe("none");
  await expect(track).toHaveCSS("--day-drag","-135px");
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await session.detach();
  await expect(page.getByText("28 July 2026",{exact:true})).toBeVisible();
  await expect(page.locator(".day-carousel-panel:not([aria-hidden]) .loading")).toHaveCount(0);
  await swipeScreen(page,{x:20,y:430},{x:300,y:430});
  await expect(page.getByText("27 July 2026",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Body",exact:true}).click();
  await expect(page.getByRole("button",{name:"Minimise Body"})).toBeVisible();
  await expect(page.locator(".day-carousel-panel:not([aria-hidden]) .day-screen")).toHaveCount(1);
  await page.getByRole("button",{name:"Minimise Body"}).click();
  await expect(page.getByRole("button",{name:"Minimise Body"})).toHaveCount(0);
});

test("calendar presents a vertically scrollable run of months",async({page})=>{
  await page.goto("/#screen=calendar&date=2026-07-27");
  const months=page.locator(".calendar-month-scroll");
  await expect(months.locator(".scroll-month")).toHaveCount(13);
  const before=await months.evaluate(element=>element.scrollTop);
  await months.evaluate(element=>element.scrollBy({top:250,behavior:"instant"}));
  await expect.poll(()=>months.evaluate(element=>element.scrollTop)).toBeGreaterThan(before);
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

test("an unknown barcode is distinguished from a provider outage",async({page})=>{
  await page.route("https://world.openfoodfacts.org/api/v2/product/**",route=>route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({status:0,status_verbose:"product not found"})}));
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button",{name:"Food",exact:true}).click();
  await page.getByRole("button",{name:/Scan or search/i}).click();
  await page.getByRole("button",{name:/Scan a barcode/i}).click();
  await page.getByLabel("Barcode",{exact:true}).fill("9300000000000");
  await page.getByRole("button",{name:"Look up product"}).click();
  await expect(page.getByRole("alert")).toContainText("not in Open Food Facts yet");
  await expect(page.getByRole("alert")).not.toContainText("could not be reached");
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
  await search.fill("milk");
  await expect(page.locator(".food-list .food-select strong").first()).toContainText(/^Milk/i);
  await search.fill("full cream milk");
  await expect(page.locator(".food-list .food-select strong").first()).toContainText(/Milk.*regular fat/i);
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

test("long-press edit mode supports selecting and deleting multiple entries",async({page})=>{
  await page.goto("/#screen=day&date=2026-07-27");
  for(let index=0;index<2;index+=1){
    await page.getByRole("button",{name:"Food",exact:true}).click();
    await page.getByRole("button",{name:"Recipes",exact:true}).click();
    await page.getByRole("button",{name:"Log",exact:true}).first().click();
    await page.getByRole("button",{name:"Log recipe"}).click();
  }
  const currentPanel=page.locator(".day-carousel-panel:not([aria-hidden])");
  const cards=currentPanel.locator(".food-card .card-main");
  await expect(cards).toHaveCount(2);
  await longPressTouch(page,cards.first());
  await expect(page.getByRole("toolbar",{name:"Edit 1 selected entry"})).toBeVisible();
  await tapTouch(page,page.getByRole("button",{name:"Select Beef Rice Bowl",exact:true}));
  await expect(page.getByRole("toolbar",{name:"Edit 2 selected entries"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Done"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Delete 2"})).toBeVisible();
  await page.getByRole("button",{name:"Delete 2"}).click();
  await expect(currentPanel.locator(".food-card")).toHaveCount(0);
  await expect(page.getByText("2 entries deleted")).toBeVisible();
  await page.getByRole("button",{name:"Undo"}).click();
  await expect(currentPanel.locator(".food-card")).toHaveCount(2);
});

test("convert-day dialog opens without focusing or zooming its name field",async({page})=>{
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button",{name:"Food",exact:true}).click();
  await page.getByRole("button",{name:"Recipes",exact:true}).click();
  await page.getByRole("button",{name:"Log",exact:true}).first().click();
  await page.getByRole("button",{name:"Log recipe"}).click();
  await page.getByRole("button",{name:"Day options"}).click();
  await page.getByRole("button",{name:"Convert to Template"}).click();
  const name=page.getByPlaceholder("e.g. Cutting Day");
  await expect(name).toBeVisible();
  await expect(name).not.toBeFocused();
  await expect(name).toHaveCSS("font-size","16px");
});

test("Australian fast food catalogue finds Chicken Rappa offline and requires review", async ({ page }) => {
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: /Import label/i }).click();
  await page.getByRole("button", { name: /Australian fast food/i }).click();
  await expect(page.getByRole("heading", { name: "Australian Fast Food" })).toBeVisible();
  await page.getByRole("button",{name:/Oporto.*8 menu items/i}).click();
  await page.getByPlaceholder("Search Oporto menu").fill("Chicken Rappa");
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

test("numeric fields can clear zero before entering a replacement value",async({page})=>{
  await page.goto("/#screen=settings&date=2026-07-27");
  const calories=page.locator(".preferences input[type=number]").first();
  await calories.fill("0");
  await calories.press("Backspace");
  await expect(calories).toHaveValue("");
  await calories.pressSequentially("2500");
  await expect(calories).toHaveValue("2500");
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

test("editing a saved food refreshes matching entries on the selected day",async({page})=>{
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button",{name:"Food",exact:true}).click();
  await page.getByRole("button",{name:"Add custom food"}).click();
  await page.getByLabel("Food name").fill("Refresh Test Food");
  await page.getByRole("spinbutton",{name:"Energy in kilocalories"}).fill("100");
  await page.getByRole("button",{name:"Save food"}).click();
  const search=page.getByPlaceholder("Food name, brand or category");
  await search.fill("Refresh Test Food");
  await page.locator(".food-select").filter({hasText:"Refresh Test Food"}).click();
  await page.getByRole("button",{name:"Add food"}).click();
  await expect(page.getByRole("button",{name:"Edit Refresh Test Food"})).toContainText("100 kcal");
  await page.getByRole("button",{name:"Food",exact:true}).click();
  await page.getByPlaceholder("Food name, brand or category").fill("Refresh Test Food");
  await page.getByRole("button",{name:"Edit Refresh Test Food"}).click();
  await page.getByRole("spinbutton",{name:"Energy in kilocalories"}).fill("250");
  await page.getByRole("button",{name:"Save food"}).click();
  await page.getByRole("button",{name:"Close"}).click();
  await expect(page.getByRole("button",{name:"Edit Refresh Test Food"})).toContainText("250 kcal");
});

test("custom liquids support a per-mL nutrition basis",async({page})=>{
  await page.goto("/#screen=day&date=2026-07-27");
  await page.getByRole("button",{name:"Food",exact:true}).click();
  await page.getByRole("button",{name:"Add custom food"}).click();
  await page.getByLabel("Food name").fill("Per mL Test Drink");
  await page.getByRole("button",{name:"Per 1 mL"}).click();
  await expect(page.getByLabel("Base quantity")).toHaveValue("1");
  const basisFields = page.locator(".form-grid").filter({ hasText: "Base quantity" }).first();
  await expect(basisFields.getByRole("combobox")).toHaveValue("ml");
  await page.getByRole("spinbutton",{name:"Energy in kilocalories"}).fill("0.6");
  await page.getByRole("button",{name:"Save food"}).click();
  await page.getByPlaceholder("Food name, brand or category").fill("Per mL Test Drink");
  await page.locator(".food-select").filter({hasText:"Per mL Test Drink"}).click();
  await page.getByRole("spinbutton",{name:"Quantity (ml)"}).fill("250");
  await expect(page.locator(".preview")).toContainText("150 kcal");
  await page.getByRole("button",{name:"Add food"}).click();
  const card=page.getByRole("button",{name:"Edit Per mL Test Drink"});
  await expect(card).toContainText("250 mL");
  await expect(card).toContainText("150 kcal");
});
