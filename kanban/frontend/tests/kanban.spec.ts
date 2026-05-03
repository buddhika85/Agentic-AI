import { expect, test } from "@playwright/test";

const dragCard = async (
  page: import("@playwright/test").Page,
  sourceTestId: string,
  targetTestId: string,
) => {
  const source = page.getByTestId(sourceTestId);
  const target = page.getByTestId(targetTestId);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("Could not resolve drag target elements.");
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
};

test("renders seeded board with five columns", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product Delivery" })).toBeVisible();
  await expect(page.getByTestId(/column-column-/)).toHaveCount(5);
});

test("renames a column title", async ({ page }) => {
  await page.goto("/");
  const firstColumnTitle = page.getByTestId("column-title-column-1");
  await firstColumnTitle.fill("Ideas");
  await firstColumnTitle.blur();
  await expect(firstColumnTitle).toHaveValue("Ideas");
});

test("adds and deletes a card", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Card title").first().fill("QA Pass");
  await page.getByPlaceholder("Card details").first().fill("Validate final interactions.");
  await page.getByRole("button", { name: "Add card" }).first().click();

  const newCard = page.getByText("QA Pass");
  await expect(newCard).toBeVisible();
  await page.getByTestId("card-card-7").getByRole("button", { name: "Delete QA Pass" }).click();
  await expect(newCard).toHaveCount(0);
});

test("drags a card to another column", async ({ page }) => {
  await page.goto("/");
  await dragCard(page, "card-card-2", "column-column-3");

  const destinationColumn = page.getByTestId("column-column-3");
  await expect(destinationColumn.getByText("Wireframes")).toBeVisible();
});
