import { expect, test } from "@playwright/test";

test("loads the populated board and supports the core workflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Kanban Board" })).toBeVisible();
  await expect(page.getByText("Map onboarding flow")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Backlog column name" })).toHaveValue("Backlog");

  const source = await page.getByTestId("card-card-1").boundingBox();
  const target = await page.getByTestId("column-done").boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();

  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + 90, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByTestId("column-done").getByText("Map onboarding flow")).toBeVisible();

  await page.getByRole("textbox", { name: "Ready column name" }).fill("Next Up");
  await expect(page.getByRole("textbox", { name: "Next Up column name" })).toBeVisible();

  await page.getByRole("button", { name: "Add card to Next Up" }).click();
  await page.getByLabel("Card title").fill("Confirm metrics");
  await page.getByLabel("Card details").fill("Review the basic delivery numbers.");
  await page.getByRole("button", { name: "Add card", exact: true }).click();

  await expect(page.getByText("Confirm metrics")).toBeVisible();

  await page.getByRole("button", { name: "Delete Confirm metrics", exact: true }).click();
  await expect(page.getByText("Confirm metrics")).toHaveCount(0);
});
