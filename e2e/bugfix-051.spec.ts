import { expect, test, type Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
}

test("deletion opens visible confirmation and removes only the chosen artboard", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Custom artboard" }).click();
  await page.getByPlaceholder("Custom format").fill("Temporary test artboard");
  await page.getByRole("button", { name: "Create artboard" }).click();
  await expect(page.getByTestId("canvas-host")).toHaveAttribute("data-artboard-count", "2");
  await page.getByRole("button", { name: "Delete artboard: Temporary test artboard" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete artboard" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("canvas-host")).toHaveAttribute("data-artboard-count", "2");
  await page.getByRole("button", { name: "Delete artboard: Temporary test artboard" }).click();
  await dialog.getByRole("button", { name: "Delete artboard" }).click();
  await expect(page.getByTestId("canvas-host")).toHaveAttribute("data-artboard-count", "1");
  await expect(page.getByTestId("artboard-nav-master")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("canvas-host")).toHaveAttribute("data-artboard-count", "2");
});

test("font import is available without selecting a text layer and reports invalid formats", async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole("button", { name: "Upload font" })).toBeVisible();
  await page.getByTestId("font-upload-input").setInputFiles({
    name: "broken.ttf", mimeType: "font/ttf", buffer: Buffer.from("not a valid font file"),
  });
  await expect(page.getByRole("alert")).toContainText("Invalid font file");
});
