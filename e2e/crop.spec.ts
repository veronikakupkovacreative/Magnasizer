import { test, expect } from "@playwright/test";

test("panoramic crop handles follow the rendered image coordinates", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 100;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#a78bfa";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Import images", { exact: true }).setInputFiles({
    name: "panorama.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.getByRole("button", { name: "Crop image", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const renderedHeight = await page
    .locator(".crop-preview svg")
    .evaluate((el) => {
      const svg = el as SVGSVGElement;
      return svg.viewBox.baseVal.height * svg.getScreenCTM()!.d;
    });
  const handle = await page.getByTestId("crop-handle-s").boundingBox();
  expect(handle).toBeTruthy();
  const x = handle!.x + handle!.width / 2;
  const y = handle!.y + handle!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - renderedHeight / 4, { steps: 5 });
  await page.mouse.up();
  const height = page.getByRole("spinbutton", { name: "Height (%)" });
  const croppedHeight = Number(await height.inputValue());
  expect(Math.abs(croppedHeight - 75)).toBeLessThan(2);
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  await page.getByRole("button", { name: "Crop image", exact: true }).click();
  await expect(height).toHaveValue(String(croppedHeight));
  await page.getByRole("button", { name: "Full image", exact: true }).click();
  await expect(height).toHaveValue("100");
  await page
    .locator(".crop-footer")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
});
