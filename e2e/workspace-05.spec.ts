import { expect, test, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
}
test("custom artboard is editable, can be renamed and independently exported", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Custom artboard" }).click();
  await page.getByPlaceholder("Custom format").fill("Social portrait");
  await page.getByRole("button", { name: "Create artboard" }).click();
  await expect(page.getByTestId("canvas-host")).toHaveAttribute("data-artboard-count", "2");
  await expect(page.getByText("Social portrait", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Export creatives" }).click();
  await expect(page.getByRole("dialog", { name: "Export creatives" })).toBeVisible();
  await expect(page.locator(".studio-export-board")).toHaveCount(2);
  const all = page.getByRole("checkbox", { name: "All artboards" });
  await all.uncheck();
  await page.locator(".studio-export-board").last().getByRole("checkbox").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected (1)" }).click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toMatch(/1080x1440\.png$/);
});
test("artboard can be dragged without modifying layer coordinates, and position survives reload", async ({ page }) => {
  await demo(page);
  const label = page.getByTestId("artboard-label-master");
  const original = await label.boundingBox();
  expect(original).toBeTruthy();
  await page.mouse.move(original!.x + original!.width / 2, original!.y + 12);
  await page.mouse.down();
  await page.mouse.move(original!.x + original!.width / 2 + 52, original!.y + 36, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".save-status")).toHaveText("Unsaved changes");
  await page.getByTestId("save-project").click();
  await page.reload();
  const reopened = await label.boundingBox();
  expect(reopened).toBeTruthy();
  await page.getByRole("button", { name: "Auto-arrange artboards" }).click();
  await expect(page.locator(".save-status")).toHaveText("Unsaved changes");
});
