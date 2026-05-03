import { test, expect } from "@playwright/test";

test("board loads and can add a card", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kanban board for one team" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="column-panel"]').nth(0),
  ).toBeVisible();

  const firstColumn = page.locator('[data-testid="column-panel"]').first();
  await firstColumn.getByPlaceholder("Card title").fill("New board card");
  await firstColumn.getByPlaceholder("Card details").fill("A quick task");
  await firstColumn.getByRole("button", { name: "Add card" }).click();

  await expect(page.getByText("New board card")).toBeVisible();
});
