import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("PNG master imports at native dimensions and resizes without flattening the editor", async ({ page }) => {
  await page.goto("/");
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 628;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#172820";
    ctx.fillRect(0, 0, 1200, 628);
    ctx.fillStyle = "#C1E36C";
    ctx.fillRect(400, 80, 250, 220);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "client-banner.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  });
  await expect(page.getByTestId("canvas-host").locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resize", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await expect(page.getByTestId("flat-mode-smart")).toBeVisible();
  await expect(page.getByTestId("flat-mode-contain")).toBeVisible();
  await expect(page.getByTestId("flat-mode-cover")).toBeVisible();
  await page.getByTestId("flat-mode-contain").click();
  await page.getByRole("button", { name: "Generate selected", exact: true }).click();
  await expect(page.getByTestId("canvas-host")).toHaveAttribute("data-artboard-count", "5");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download project JSON", exact: true }).click();
  const file = await download;
  const bundle = JSON.parse((await readFile((await file.path())!)).toString());
  expect(bundle.project.document).toMatchObject({ width: 1200, height: 628 });
  expect(bundle.project.flatImage.fitMode).toBe("contain");
  expect(bundle.project.document.layers).toHaveLength(1);
  expect(bundle.project.variants).toHaveLength(4);
  expect(bundle.project.variants.every((v: { flatImage?: { fitMode: string } }) => v.flatImage?.fitMode === "contain")).toBe(true);
});
