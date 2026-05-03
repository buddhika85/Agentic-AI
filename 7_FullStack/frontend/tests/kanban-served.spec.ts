import { expect, test } from "@playwright/test";

test("served kanban board loads correctly", async ({ page }) => {
  await page.goto("http://localhost:8000/");
  await expect(
    page.getByRole("heading", { name: "Sign in to Kanban Studio" }),
  ).toBeVisible();
});

test("login with correct credentials shows board", async ({ page }) => {
  await page.goto("http://localhost:8000/");
  await page.fill('input[name="username"]', "user");
  await page.fill('input[name="password"]', "password");
  await page.click('button[type="submit"]');
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" }),
  ).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("login with wrong credentials shows error", async ({ page }) => {
  await page.goto("http://localhost:8000/");
  await page.fill('input[name="username"]', "wrong");
  await page.fill('input[name="password"]', "wrong");
  await page.click('button[type="submit"]');
  await expect(page.locator("text=Invalid username or password")).toBeVisible();
});

test("drag and drop moves a card between columns", async ({ page }) => {
  await page.goto("http://localhost:8000/");
  await page.fill('input[name="username"]', "user");
  await page.fill('input[name="password"]', "password");
  await page.click('button[type="submit"]');

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
