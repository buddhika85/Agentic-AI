import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:8000/");
  await page.fill('input[name="username"]', "user");
  await page.fill('input[name="password"]', "password");
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
});

test("loads the Kanban board after login", async ({ page }) => {
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns via drag simulation", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Drag test card");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await page.waitForTimeout(1000);

  const newCard = firstColumn.locator('[data-testid^="card-"]').last();
  const targetColumn = page.getByTestId("column-col-review");
  const cardId = await newCard.getAttribute("data-testid");
  await expect(newCard).toBeVisible();

  await newCard.hover();
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(0, -15);
  await page.waitForTimeout(200);

  const targetBox = await targetColumn.boundingBox();
  if (!targetBox) throw new Error("Target column not found");
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(1000);

  await expect(targetColumn.getByTestId(cardId)).toBeVisible();
});

test("chat sidebar is visible and sends a message", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "AI Assistant" }).first()).toBeVisible();
  const input = page.getByPlaceholder("Ask AI...").first();
  await expect(input).toBeVisible();
  await input.fill("Hello");
  await page.getByRole("button", { name: "Send" }).first().click();
  await expect(page.getByText("Thinking...")).toBeVisible();
});

test("drag and drop works while chat sidebar is visible", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();

  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Sidebar drag card");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await page.waitForTimeout(1000);

  const newCard = firstColumn.locator('[data-testid^="card-"]').last();
  const targetColumn = page.getByTestId("column-col-done");
  const cardId = await newCard.getAttribute("data-testid");
  await expect(newCard).toBeVisible();
  const firstColumnCardCount = await firstColumn.locator('[data-testid^="card-"]').count();

  await newCard.hover();
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(0, -15);
  await page.waitForTimeout(200);

  const targetBox = await targetColumn.boundingBox();
  if (!targetBox) throw new Error("Target column not found");
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 60, { steps: 20 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(1000);

  const firstColumnCardCountAfter = await firstColumn.locator('[data-testid^="card-"]').count();
  expect(firstColumnCardCountAfter).toBeLessThan(firstColumnCardCount);
});

test("concurrent edits in multiple tabs", async ({ browser }) => {
  const uniqueTitle = `Concurrent ${Date.now()}`;

  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto("http://localhost:8000/");
  await page1.fill('input[name="username"]', "user");
  await page1.fill('input[name="password"]', "password");
  await page1.click('button[type="submit"]');
  await expect(page1.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  await page1.locator('[data-testid^="column-"]').first().getByRole("button", { name: /add a card/i }).click();
  await page1.locator('[data-testid^="column-"]').first().getByPlaceholder("Card title").fill(uniqueTitle);
  await page1.locator('[data-testid^="column-"]').first().getByRole("button", { name: /add card/i }).click();
  await expect(page1.locator('[data-testid^="column-"]').first().getByText(uniqueTitle)).toBeVisible();

  await page1.waitForTimeout(1500);

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto("http://localhost:8000/");
  await page2.fill('input[name="username"]', "user");
  await page2.fill('input[name="password"]', "password");
  await page2.click('button[type="submit"]');
  await expect(page2.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  await expect(page2.locator('[data-testid^="column-"]').first().getByText(uniqueTitle)).toBeVisible();

  await context1.close();
  await context2.close();
});
