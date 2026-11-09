import { expect, test } from "@playwright/test";

test("overview selection shows a thin outline rather than huge Konva handles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  const host = page.getByTestId("canvas-host");
  await expect(host.locator("canvas")).toBeVisible();
  await expect(host).toHaveAttribute("data-studio-version", "0.5.2");
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await page.getByRole("combobox", { name: "Zoom", exact: true }).selectOption("0.1");
  await expect(host).toHaveAttribute("data-transform-controls", "outline");
  await page.getByRole("combobox", { name: "Zoom", exact: true }).selectOption("0.5");
  await expect(host).toHaveAttribute("data-transform-controls", "handles");
  await page.getByRole("combobox", { name: "Zoom", exact: true }).selectOption("0.1");
  await expect(host).toHaveAttribute("data-transform-controls", "outline");
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await expect(host).toHaveAttribute("data-transform-controls", "outline");
});
