import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { generateVariant, hasStructuredLayoutRoles, preserveMasterComposition } from "./engine";

/** Mirrors an ad-hoc editor document: two text layers, two decorative
 * shapes (including a wide rounded CTA pill) and one raster product. */
const arbitraryMaster = () => {
  const doc = structuredClone(createProject(true).project.document);
  const keep = new Set(["text-headline", "text-body", "shape-orbit", "shape-cta", "image-product"]);
  doc.layers = doc.layers.filter(layer => keep.has(layer.id)).map((layer, zIndex) => {
    const role = layer.type === "text" ? "headline" as const
      : layer.type === "image" ? "product" as const : "decoration" as const;
    return { ...layer, role, zIndex };
  });
  return doc;
};

describe("unstructured master preservation", () => {
  it("keeps the demo's intentional semantic compositions intact", () => {
    expect(hasStructuredLayoutRoles(createProject(true).project.document)).toBe(true);
    expect(hasStructuredLayoutRoles(arbitraryMaster())).toBe(false);
  });

  it("does not reshape decorative pills into circles or hide user copy", () => {
    const master = arbitraryMaster();
    const before = JSON.stringify(master);
    for (const presetId of ["meta-story-1080x1920", "pmax-landscape-1200x628", "gdn-300x250"]) {
      const preset = FORMAT_PRESETS.find(p => p.id === presetId)!;
      const generated = generateVariant(master, preset, "auto").document;
      expect(generated.width).toBe(preset.width);
      expect(generated.height).toBe(preset.height);
      expect(generated.layers.map(layer => [layer.id, layer.sourceId, layer.zIndex]))
        .toEqual(master.layers.map(layer => [layer.id, layer.sourceId, layer.zIndex]));
      expect(generated.layers.every(layer => layer.visible)).toBe(true);
      const shape = generated.layers.find(layer => layer.id === "shape-cta")!;
      const originalShape = master.layers.find(layer => layer.id === "shape-cta")!;
      expect(shape.geometry.width / shape.geometry.height)
        .toBeCloseTo(originalShape.geometry.width / originalShape.geometry.height, 3);
      const image = generated.layers.find(layer => layer.type === "image")!;
      const originalImage = master.layers.find(layer => layer.type === "image")!;
      expect(image.geometry.width / image.geometry.height)
        .toBeCloseTo(originalImage.geometry.width / originalImage.geometry.height, 3);
      const importedCopy = generated.layers.filter(layer => layer.type === "text").map(layer => layer.type === "text" ? layer.text : "");
      expect(importedCopy).toEqual(master.layers.filter(layer => layer.type === "text").map(layer => layer.type === "text" ? layer.text : ""));
      expect(generated.layers.some(layer => layer.id === "image-product")).toBe(true);
    }
    expect(JSON.stringify(master)).toBe(before);
  });

  it("spreads artwork into portrait space rather than compressing every layer into a center strip", () => {
    const master = arbitraryMaster();
    const preset = FORMAT_PRESETS.find(p => p.id === "meta-story-1080x1920")!;
    const result = preserveMasterComposition(master, preset.width, preset.height, preset.safeZone);
    const headline = result.layers.find(layer => layer.id === "text-headline")!;
    const product = result.layers.find(layer => layer.id === "image-product")!;
    expect(product.geometry.y).toBeGreaterThan(headline.geometry.y + headline.geometry.height);
  });
});
