import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { fitZoom, resizeGeometry } from "./geometry";
describe("renderer-independent geometry", () => {
  const doc = createProject(true).project.document;
  const image = doc.layers.find((l) => l.type === "image")!;
  it("fits the artboard inside the viewport with room for controls", () => {
    expect(fitZoom(doc, { width: 720, height: 600 })).toBeCloseTo(0.3833, 3);
    expect(
      fitZoom(doc, { width: 720, height: 300 }) * doc.height,
    ).toBeLessThanOrEqual(160);
  });
  it("protects aspect ratio with both inspector axes and extreme bounds", () => {
    expect(resizeGeometry(image, 180, 999)).toMatchObject({
      width: 180,
      height: 260,
    });
    expect(resizeGeometry(image, 999, 260, "height")).toMatchObject({
      width: 180,
      height: 260,
    });
    for (const size of [-1, 0, 12, 8192, 99999]) {
      const g = resizeGeometry(image, size, size);
      expect(g.width / g.height).toBeCloseTo(360 / 520);
      expect(g.width).toBeGreaterThanOrEqual(36);
      expect(g.height).toBeLessThanOrEqual(8192);
    }
  });
  it("allows independent shape resizing and clamps unusable viewport sizes", () => {
    expect(resizeGeometry(doc.layers[0], 150, 200)).toMatchObject({
      width: 150,
      height: 200,
    });
    expect(fitZoom(doc, { width: 0, height: 0 })).toBe(0.1);
  });
});
