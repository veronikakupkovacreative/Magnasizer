import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function openDemo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Demo Project", exact: true })
    .click();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
}
async function metrics(page: Page) {
  return page.getByTestId("canvas-host").evaluate((el) => {
    const r = el.getBoundingClientRect(),
      d = (el as HTMLElement).dataset;
    return {
      x: r.x + Number(d.originX),
      y: r.y + Number(d.originY),
      z: Number(d.zoom),
    };
  });
}
async function download(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download project JSON" }).click();
  const file = await pending;
  return readFile((await file.path())!);
}

test("direct multiline text at zoom, cancellation, native typing, undo and keyboard save", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openDemo(page);
  await page
    .getByRole("combobox", { name: "Zoom", exact: true })
    .selectOption("0.5");
  const m = await metrics(page);
  await page.mouse.dblclick(m.x + 160 * m.z, m.y + 240 * m.z);
  const edit = page.getByTestId("canvas-text-editor");
  await expect(edit).toBeFocused();
  await expect(edit).toHaveCSS("font-size", "88px");
  await expect(edit).toHaveCSS("font-weight", "700");
  await edit.fill("A cancelled\nchange");
  await edit.press("Escape");
  await expect(edit).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(edit).toHaveValue("BETTER.\nBY");
  await edit.fill("Made for\nevery day.\nEverywhere.");
  await edit.press("Control+Enter");
  const height = Number(
    await page
      .getByRole("spinbutton", { name: "Height", exact: true })
      .inputValue(),
  );
  expect(height).toBeGreaterThan(175);
  await page.keyboard.press("Control+z");
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(edit).toHaveValue("BETTER.\nBY");
  await edit.press("Escape");
  await page.keyboard.press("Control+Shift+z");
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(edit).toHaveValue("Made for\nevery day.\nEverywhere.");
  // Backspace and arrow keys remain native while editing.
  await edit.press("End");
  await edit.press("Backspace");
  await expect(page.locator(".layer-select")).toHaveCount(10);
  await edit.fill("Saved directly\nfrom the canvas");
  await edit.press("Control+s");
  await expect(page.locator(".save-status")).toHaveText("Saved locally");
  await page.reload();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text on canvas", exact: true })
    .click();
  await expect(edit).toHaveValue("Saved directly\nfrom the canvas");
  await edit.press("Escape");
  expect(errors).toEqual([]);
});

test("layer range selection, batch nudge, rename, visibility, locks and reorder survive reopening", async ({
  page,
}) => {
  await openDemo(page);
  await page
    .getByRole("button", { name: "Supporting copy", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Headline", exact: true })
    .click({ modifiers: ["Shift"] });
  await expect(page.locator(".layer-select[aria-pressed=true]")).toHaveCount(2);
  await page.keyboard.press("Shift+ArrowRight");
  let bundle = JSON.parse((await download(page)).toString());
  expect(
    bundle.project.document.layers.find(
      (l: { id: string }) => l.id === "text-headline",
    ).geometry.x,
  ).toBe(74);
  expect(
    bundle.project.document.layers.find(
      (l: { id: string }) => l.id === "text-body",
    ).geometry.x,
  ).toBe(78);
  await page.keyboard.press("Control+z");
  await page
    .getByRole("button", { name: "Bring to front", exact: true })
    .click();
  await expect(page.locator(".layer-select").nth(0)).toHaveText(
    "Supporting copy",
  );
  await expect(page.locator(".layer-select").nth(1)).toHaveText("Headline");
  await page
    .getByRole("button", { name: "Hide selection", exact: true })
    .click();
  await expect(page.locator(".layer-row.is-hidden")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Lock selection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Duplicate selection", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock selection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show selection", exact: true })
    .click();
  await page.getByRole("button", { name: "Headline", exact: true }).dblclick();
  const rename = page.locator(".layer-rename");
  await rename.fill("Approved headline");
  await rename.press("Enter");
  await page
    .getByRole("combobox", { name: "Layer role", exact: true })
    .selectOption("headline");
  await page.getByRole("spinbutton", { name: "Priority (0–100)" }).fill("92");
  await page
    .getByRole("spinbutton", { name: "Priority (0–100)" })
    .press("Enter");
  await page
    .getByRole("combobox", { name: "Sizing rule" })
    .selectOption("scale");
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved locally");
  await page.reload();
  await page
    .getByRole("button", { name: "Approved headline", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Priority (0–100)" }),
  ).toHaveValue("92");
  await expect(page.getByRole("combobox", { name: "Sizing rule" })).toHaveValue(
    "scale",
  );
  bundle = JSON.parse((await download(page)).toString());
  expect(bundle.project.document.layers.at(-2).name).toBe("Approved headline");
});

test("raster and sanitized SVG imports, crop handles, original bytes and self-contained backups", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const images = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c2d2b2";
    ctx.fillRect(0, 0, 320, 160);
    ctx.fillStyle = "#202820";
    ctx.fillRect(80, 20, 160, 120);
    return ["image/png", "image/jpeg", "image/webp"].map((type) => ({
      type,
      data: c.toDataURL(type).split(",")[1],
    }));
  });
  await page.getByLabel("Import images", { exact: true }).setInputFiles(
    images.map((item, i) => ({
      name: `product.${["png", "jpg", "webp"][i]}`,
      mimeType: item.type,
      buffer: Buffer.from(item.data, "base64"),
    })),
  );
  await expect(page.locator(".layer-select")).toHaveCount(3);
  await page.getByRole("button", { name: "product.png", exact: true }).click();
  await page.getByRole("button", { name: "Crop image", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const handle = page.getByTestId("crop-handle-e"),
    box = await handle.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x - 60, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(
    Number(
      await page.getByRole("spinbutton", { name: "Width (%)" }).inputValue(),
    ),
  ).toBeLessThan(100);
  await page.getByRole("spinbutton", { name: "Width (%)" }).fill("50");
  await page.getByRole("spinbutton", { name: "Width (%)" }).press("Enter");
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("160");
  await expect(
    page.getByRole("spinbutton", { name: "Height", exact: true }),
  ).toHaveValue("160");
  await page.keyboard.press("Control+z");
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("320");
  await page.keyboard.press("Control+Shift+z");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><script>window.bad=true</script><rect onload="alert(1)" width="200" height="100" fill="#a78bfa"/></svg>';
  // Real drop event, using a browser File and DataTransfer.
  await page.locator(".canvas-region").evaluate((el, source) => {
    const dt = new DataTransfer();
    dt.items.add(new File([source], "mark.svg", { type: "image/svg+xml" }));
    el.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: dt }),
    );
  }, svg);
  await expect(
    page.getByRole("button", { name: "mark.svg", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Unsafe scripts or attributes were removed/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved locally");
  const bytes = await download(page),
    bundle = JSON.parse(bytes.toString());
  expect(bundle.files).toHaveLength(5);
  const png = bundle.assets.find(
    (a: { name: string }) => a.name === "product.png",
  );
  expect(
    bundle.files.find((f: { key: string }) => f.key === png.originalKey).data,
  ).toBe(images[0].data);
  const vector = bundle.assets.find(
    (a: { name: string }) => a.name === "mark.svg",
  );
  expect(
    Buffer.from(
      bundle.files.find((f: { key: string }) => f.key === vector.originalKey)
        .data,
      "base64",
    ).toString(),
  ).toBe(svg);
  expect(
    Buffer.from(
      bundle.files.find((f: { key: string }) => f.key === vector.renderKey)
        .data,
      "base64",
    ).toString(),
  ).not.toMatch(/script|onload/);
  await page.reload();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "product.png", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("160");
  // A fresh browser context has no existing IndexedDB or Blob URLs.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const clean = await context.newPage();
  await clean.goto("http://127.0.0.1:3000");
  await clean.locator("input[type=file]").setInputFiles({
    name: "portable.srs.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(
    clean.getByTestId("canvas-host").locator("canvas"),
  ).toBeVisible();
  await expect(clean.locator(".layer-select")).toHaveCount(4);
  await clean.getByRole("button", { name: "product.png", exact: true }).click();
  await expect(
    clean.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("160");
  await clean.getByRole("button", { name: "Crop image", exact: true }).click();
  await clean.getByRole("button", { name: "Full image", exact: true }).click();
  await clean.getByRole("button", { name: "Apply crop", exact: true }).click();
  await expect(
    clean.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("320");
  await context.close();
});

test("invalid images and unsupported SVG produce recoverable errors without partial import", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text>Not outlined</text></svg>',
    ),
  });
  await expect(page.locator(".error-notice")).toContainText(
    "unsupported features",
  );
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Import images", { exact: true }).setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.locator(".error-notice")).toContainText("Use PNG");
  await expect(page.locator(".layer-select")).toHaveCount(0);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await expect(page.locator(".layer-select")).toHaveCount(1);
});

test("multi-selection canvas transforms are proportional and undo as one gesture", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Smart guides", exact: true }).click();
  await page
    .getByRole("button", { name: "Everyday bottle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Product spotlight", exact: true })
    .click({ modifiers: ["Control"] });
  await expect(page.locator(".layer-select[aria-pressed=true]")).toHaveCount(2);
  const m = await metrics(page);
  const original = JSON.parse((await download(page)).toString());
  const originalBottle = original.project.document.layers.find((l: { id: string }) => l.id === "image-product").geometry;
  const originalOrbit = original.project.document.layers.find((l: { id: string }) => l.id === "shape-orbit").geometry;
  const p = { x: m.x + (originalBottle.x + originalBottle.width / 2) * m.z,
    y: m.y + (originalBottle.y + 42) * m.z };
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 20, p.y - 10, { steps: 8 });
  await page.mouse.up();
  let bundle = JSON.parse((await download(page)).toString());
  const layers = bundle.project.document.layers as Array<{
    id: string;
    geometry: { x: number; y: number; width: number; height: number };
  }>;
  const bottle = layers.find((l) => l.id === "image-product")!,
    orbit = layers.find((l) => l.id === "shape-orbit")!;
  expect(bottle.geometry.x - originalBottle.x).toBeCloseTo(orbit.geometry.x - originalOrbit.x, 1);
  expect(bottle.geometry.x).toBeGreaterThan(originalBottle.x);
  expect(bottle.geometry.y - originalBottle.y).toBeCloseTo(orbit.geometry.y - originalOrbit.y, 1);
  const right = Math.max(bottle.geometry.x + bottle.geometry.width, orbit.geometry.x + orbit.geometry.width),
    bottom = Math.max(bottle.geometry.y + bottle.geometry.height, orbit.geometry.y + orbit.geometry.height);
  const handle = { x: m.x + right * m.z, y: m.y + bottom * m.z };
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 14, handle.y + 20, { steps: 8 });
  await page.mouse.up();
  bundle = JSON.parse((await download(page)).toString());
  const scaled = bundle.project.document.layers.find(
    (l: { id: string }) => l.id === "image-product",
  );
  expect(scaled.geometry.width).toBeGreaterThan(originalBottle.width);
  expect(scaled.geometry.width / scaled.geometry.height).toBeCloseTo(
    360 / 520,
    5,
  );
  await page.keyboard.press("Control+z");
  bundle = JSON.parse((await download(page)).toString());
  expect(
    bundle.project.document.layers.find(
      (l: { id: string }) => l.id === "image-product",
    ).geometry,
  ).toEqual(bottle.geometry);
});

test("marquee selection and smart guide snapping use the actual artboard coordinates", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
  const m = await metrics(page),
    p = { x: m.x + 220 * m.z, y: m.y + 250 * m.z };
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 116 * m.z, p.y, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("spinbutton", { name: "X", exact: true }),
  ).toHaveValue("0");
  // Deselect, then select the shape by drawing a rectangle from blank artboard.
  await page.keyboard.press("Escape");
  await page.mouse.move(m.x + 300 * m.z, m.y + 400 * m.z);
  await page.mouse.down();
  await page.mouse.move(m.x + 20 * m.z, m.y + 100 * m.z, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Shape", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
