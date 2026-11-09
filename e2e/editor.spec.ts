import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function demo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Demo Project", exact: true })
    .click();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
}

test("fill, z-order, zoom and keyboard-resizable panel persistence", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Forest canvas", exact: true })
    .click();
  const fill = page.getByRole("textbox", { name: "Fill HEX", exact: true });
  await fill.fill("#AACCDD");
  await fill.press("Enter");
  await expect(fill).toHaveValue("#AACCDD");
  await page
    .getByRole("button", { name: "Bring forward", exact: true })
    .click();
  await expect(page.locator(".layer-select").nth(8)).toHaveText(
    "Forest canvas",
  );
  await page.keyboard.press("Control+z");
  await expect(page.locator(".layer-select").nth(9)).toHaveText(
    "Forest canvas",
  );
  const divider = page.getByRole("separator", { name: "Resize layers panel" });
  await divider.focus();
  await divider.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "272");
  await expect(divider).toBeFocused();
  await page
    .getByRole("combobox", { name: "Zoom", exact: true })
    .selectOption("0.5");
  await page.getByRole("button", { name: "Hide layers", exact: true }).click();
  await page
    .getByRole("button", { name: "Hide properties", exact: true })
    .click();
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Show layers", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show properties", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Zoom", exact: true }),
  ).toHaveValue("0.5");
  await page.getByRole("button", { name: "Show layers", exact: true }).click();
  await expect(divider).toHaveAttribute("aria-valuenow", "272");
  await page
    .getByRole("button", { name: "Show properties", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Forest canvas", exact: true })
    .click();
  await expect(fill).toHaveValue("#AACCDD");
});
test("edit, undo, save, reopen, and preserve preferences", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  const content = page.getByTestId("canvas-text-editor");
  await content.fill("Made for every day.");
  await content.blur();
  await expect(page.getByRole("status")).toHaveText("Unsaved changes");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(content).toHaveValue("BETTER.\nBY");
  await content.press("Escape");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(content).toHaveValue("Made for every day.");
  await content.press("Escape");
  await page.getByRole("spinbutton", { name: "X", exact: true }).fill("100");
  await page.getByRole("spinbutton", { name: "X", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Use light theme" }).click();
  await page.getByRole("button", { name: "Save locally" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  const url = page.url();
  await page.reload();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(content).toHaveValue("Made for every day.");
  await content.press("Escape");
  await expect(
    page.getByRole("spinbutton", { name: "X", exact: true }),
  ).toHaveValue("100");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to Czech" }).click();
  await expect(
    page.getByRole("button", { name: "Uložit místně" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await page.getByRole("button", { name: "Zpět na projekty" }).click();
  await page
    .getByRole("button", { name: /FORM · Better by design/ })
    .click();
  await expect(page).toHaveURL(url);
});

test("canvas drag, resize, product protection, lock, duplicate and delete", async ({
  page,
}) => {
  await demo(page);
  const host = page.getByTestId("canvas-host");
  const metrics = await host.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const d = (el as HTMLElement).dataset;
    return {
      x: rect.x + Number(d.originX),
      y: rect.y + Number(d.originY),
      z: Number(d.zoom),
    };
  });
  // Drag the real rendered headline, not a DOM surrogate.
  const p = { x: metrics.x + 160 * metrics.z, y: metrics.y + 352 * metrics.z };
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 30, p.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("textbox", { name: "Layer name" })).toHaveValue(
    "Headline",
  );
  const x = Number(
    await page.getByRole("spinbutton", { name: "X", exact: true }).inputValue(),
  );
  expect(x).toBeGreaterThan(70);
  const y = Number(
    await page.getByRole("spinbutton", { name: "Y", exact: true }).inputValue(),
  );
  // Resize via the transformer's bottom-right handle.
  const handle = {
    x: metrics.x + (x + 568) * metrics.z,
    y: metrics.y + (y + 302) * metrics.z,
  };
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 20, handle.y + 15, { steps: 8 });
  await page.mouse.up();
  expect(
    Number(
      await page
        .getByRole("spinbutton", { name: "Width", exact: true })
        .inputValue(),
    ),
  ).toBeGreaterThan(568);
  await expect(
    page.getByRole("spinbutton", { name: "Font size", exact: true }),
  ).toHaveValue("99");
  await page
    .getByRole("button", { name: "Everyday bottle", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Width", exact: true })
    .fill("180");
  await page
    .getByRole("spinbutton", { name: "Width", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("spinbutton", { name: "Height", exact: true }),
  ).toHaveValue("260");
  await page
    .getByRole("button", { name: "Lock layer: Everyday bottle", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock layer: Everyday bottle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplicate layer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Everyday bottle copy", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete layer", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete layer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Everyday bottle copy", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Everyday bottle copy", exact: true }),
  ).toBeVisible();
});

test("empty project, keyboard save, portable JSON, invalid import and narrow fallback", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(page.getByText("No layers yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  const content = page.getByTestId("canvas-text-editor");
  await content.fill("Saved text");
  await content.press("Control+s");
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page.reload();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(content).toHaveValue("Saved text");
  await content.press("Escape");
  await page
    .getByRole("combobox", { name: "Zoom", exact: true })
    .selectOption("0.25");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download project JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.srs\.json$/);
  const file = await download.path();
  expect(file).toBeTruthy();
  const downloaded = JSON.parse(await readFile(file!, "utf8"));
  expect(downloaded.project.document).toMatchObject({
    width: 1200,
    height: 1200,
  });
  expect(downloaded.project.document.layers[0].geometry).toMatchObject({
    x: 80,
    y: 80,
    width: 420,
    height: 90,
  });
  await page.getByRole("button", { name: "Back to projects" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Start with an image. Or open a project.",
    }),
  ).toBeVisible();
  await page.locator(".dropzone input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"invalid":true}'),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not open" }),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: await readFile(file!),
  });
  await expect(
    page.getByRole("button", { name: "Text", exact: true }),
  ).toBeVisible();
  for (const width of [768, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await expect(
      page.getByRole("heading", {
        name: "Give your ideas a little more room.",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
