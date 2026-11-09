import { expect, test } from "@playwright/test";

test("manual variant survives regeneration and keeps layout after saving", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await page.getByTestId("generate-variants").click();
  const story = page.getByTestId("artboard-nav-meta-story-1080x1920");
  // The accessible artboard list also supports selection without using the canvas at small zoom.
  if (await story.count()) await story.click();
  else await page.getByRole("button", { name: /Meta Story \/ Reel.*1080.*1920/ }).first().click();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  const x = page.getByRole("spinbutton", { name: "X", exact: true });
  const changed = Number(await x.inputValue()) + 27;
  await x.fill(String(changed));
  await x.press("Enter");
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await expect(page.getByText(/manually adjusted variants will stay untouched/)).toBeVisible();
  await page.getByTestId("generate-variants").click();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await expect(x).toHaveValue(String(changed));
  await page.getByRole("button", { name: "Save locally" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Meta Story \/ Reel.*1080.*1920/ }).first().click();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await expect(x).toHaveValue(String(changed));
});
