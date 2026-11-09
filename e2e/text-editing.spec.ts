import { test, expect } from "@playwright/test";

test("multiline text keeps its expanded height during continued typing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Zoom", exact: true })
    .selectOption("0.5");
  const height = page.getByRole("spinbutton", {
    name: "Height",
    exact: true,
  });
  const originalHeight = Number(await height.inputValue());
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();

  const edit = page.getByTestId("canvas-text-editor");
  const original = await edit.inputValue();
  await edit.fill("First\nSecond\nThird");
  const expandedHeight = await edit.evaluate((el) => el.clientHeight);
  expect(expandedHeight).toBeGreaterThan(originalHeight);

  await edit.press("End");
  await edit.pressSequentially(" row");
  await expect(edit).toHaveValue("First\nSecond\nThird row");
  const visible = await edit.evaluate((el) => ({
    height: el.clientHeight,
    contentHeight: el.scrollHeight,
  }));
  expect(visible.height).toBe(expandedHeight);
  expect(visible.contentHeight).toBeLessThanOrEqual(visible.height + 1);

  await edit.press("Control+Enter");
  await expect(height).toHaveValue(String(expandedHeight));
  await page.keyboard.press("Control+z");
  await expect(height).toHaveValue(String(originalHeight));
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(edit).toHaveValue(original);
  await edit.press("Escape");
  await page.keyboard.press("Control+Shift+z");
  await expect(height).toHaveValue(String(expandedHeight));
});
