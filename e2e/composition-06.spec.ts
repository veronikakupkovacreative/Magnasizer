import { expect, test } from "@playwright/test";

test("preview three real compositional layouts and generate chosen style", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Composition mode" })).toBeVisible();
  await expect(page.locator(".composition-option")).toHaveCount(4);
  await page.getByTestId("composition-product").click();
  await expect(page.getByTestId("composition-product")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("generate-variants").click();
  await expect(page.getByTestId("canvas-host")).toHaveAttribute("data-artboard-count", "5");
  await page.getByRole("button", { name: /Meta Story \/ Reel.*1080.*1920/ }).first().click();
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await expect(page.getByText("Current layout: Product-led")).toBeVisible();
});

test("customized variant requires confirmation before replacing its layout", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await page.getByTestId("generate-variants").click();
  await page.getByRole("button", { name: /Meta Story \/ Reel.*1080.*1920/ }).first().click();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  const x = page.getByRole("spinbutton", { name: "X", exact: true });
  const before = Number(await x.inputValue());
  await x.fill(String(before + 15));
  await x.press("Enter");
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await page.getByTestId("composition-text").click();
  await page.getByTestId("apply-composition").click();
  await expect(page.getByRole("alertdialog", { name: "Replace your custom layout?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await expect(x).toHaveValue(String(before + 15));
});
