import { expect, test } from "@playwright/test";

test("generate, customize, save and reopen resize variants", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await expect(page.getByLabel("Generate resize variants")).toBeVisible();
  await page.getByRole("button", { name: "Generate selected", exact: true }).click();

  const storyBoard = page.getByRole("button", { name: /Meta Story \/ Reel.*1080.*1920/ }).first();
  await expect(storyBoard).toBeVisible();
  await expect(page.getByTestId("canvas-host")).toHaveAttribute("data-artboard-count", "5");
  await expect(page.locator(".workspace-artboard-label")).toHaveCount(5);
  await storyBoard.click();
  await expect(page.getByText("1080 × 1920", { exact: true }).first()).toBeVisible();
  await expect(storyBoard).toHaveAttribute("aria-current", "true");

  await page.getByRole("button", { name: "Headline", exact: true }).click();
  const x = page.getByRole("spinbutton", { name: "X", exact: true });
  const before = Number(await x.inputValue());
  await x.fill(String(before + 24));
  await x.press("Enter");
  await expect(storyBoard.locator(".workspace-status-dot")).toHaveClass(/customized/);

  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved locally");
  await page.reload();
  await page.getByRole("button", { name: /Meta Story \/ Reel.*1080.*1920/ }).first().click();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await expect(x).toHaveValue(String(before + 24));
});

test("workspace shows all formats on one Konva stage with independent layer editing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await page.getByRole("button", { name: "Generate selected", exact: true }).click();

  const host = page.getByTestId("canvas-host");
  await expect(host).toHaveAttribute("data-artboard-count", "5");
  await expect(page.locator(".workspace-artboard-label")).toHaveCount(5);
  // One workspace and one scene canvas, not one editor or stage per variant.
  await expect(page.locator(".canvas-host")).toHaveCount(1);

  const master = page.getByTestId("artboard-nav-master");
  const story = page.getByRole("button", { name: /Meta Story \/ Reel.*1080.*1920/ }).first();
  await story.click();
  await expect(story).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  const x = page.getByRole("spinbutton", { name: "X", exact: true });
  const originalVariantX = Number(await x.inputValue());
  await x.fill(String(originalVariantX + 17));
  await x.press("Enter");

  await master.click();
  await expect(master).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await expect(x).toHaveValue("70");
  await story.click();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await expect(x).toHaveValue(String(originalVariantX + 17));
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved locally");
  await page.reload();
  await expect(page.locator(".workspace-artboard-label")).toHaveCount(5);
});
