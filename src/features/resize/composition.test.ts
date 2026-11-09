import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { bundleSchema } from "@/shared/schema/project";
import { composeDocument, generateVariant, mergeGeneratedVariants, recomposeVariant, approximateTextLines, fillImageCrop, type CompositionMode } from "./engine";

describe("Smart Layout Engine 2.0", () => {
  const master = createProject(true).project.document;
  const modes: CompositionMode[] = ["balanced", "product", "text"];

  it("keeps approved text, source ids, layer stacking and product proportions in all presets", () => {
    for (const preset of FORMAT_PRESETS) {
      for (const mode of modes) {
        const variant = generateVariant(master, preset, mode);
        expect(variant.composition).toBe(mode);
        expect(variant.document.layers.map((l) => [l.id, l.sourceId, l.zIndex])).toEqual(master.layers.map((l) => [l.id, l.sourceId, l.zIndex]));
        const bottle = variant.document.layers.find((layer) => layer.id === "image-product")!;
        expect(bottle.geometry.width / bottle.geometry.height).toBeCloseTo(360 / 520, 4);
        const title = variant.document.layers.find((layer) => layer.id === "text-headline");
        expect(title?.type === "text" ? title.text : "").toBe("BETTER.\nBY");
      }
    }
  });

  it("changes the focal regions when switching composition modes", () => {
    const preset = FORMAT_PRESETS.find((p) => p.id === "pmax-landscape-1200x628")!;
    const balanced = generateVariant(master, preset, "balanced");
    const product = generateVariant(master, preset, "product");
    const copy = generateVariant(master, preset, "text");
    const bottle = (v: typeof balanced) => v.document.layers.find((l) => l.id === "image-product")!.geometry;
    const headline = (v: typeof balanced) => v.document.layers.find((l) => l.id === "text-headline")!.geometry;
    expect(bottle(product).width).toBeGreaterThan(bottle(copy).width);
    expect(headline(copy).width).toBeGreaterThan(headline(product).width);
    expect(balanced.document.width).toBe(1200);
  });

  it("never overwrites manual variants in bulk and preserves their positions", () => {
    const preset = FORMAT_PRESETS[2];
    const custom = generateVariant(master, preset, "balanced");
    custom.status = "customized";
    custom.document.layers[0].geometry.x = 17;
    const merged = mergeGeneratedVariants(master, [preset], [custom], "product");
    expect(merged[0]).toEqual(custom);
    const synced = { ...custom, status: "synced" as const };
    const [regenerated] = mergeGeneratedVariants(master, [preset], [synced], "text");
    expect(regenerated.id).toBe(synced.id);
    expect(regenerated.composition).toBe("text");
  });

  it("recomposes only the explicit target variant", () => {
    const first = generateVariant(master, FORMAT_PRESETS[1], "balanced");
    const other = generateVariant(master, FORMAT_PRESETS[2], "balanced");
    const replacement = recomposeVariant(master, first, "product");
    expect(replacement.id).toBe(first.id);
    expect(replacement.composition).toBe("product");
    expect(other.composition).toBe("balanced");
    expect(replacement.document.layers.length).toBe(master.layers.length);
  });

  it("keeps schema compatibility for old and new composition projects", () => {
    const bundle = createProject(true);
    const first = generateVariant(master, FORMAT_PRESETS[1], "product");
    bundle.project.variants.push(first);
    expect(bundleSchema.parse(bundle).project.variants[0].composition).toBe("product");
    delete first.composition;
    expect(bundleSchema.parse(bundle).project.variants[0].composition).toBeUndefined();
  });

  it("applies safe nondestructive background crops without stretching photography", () => {
    const product = master.layers.find((layer) => layer.type === "image")!;
    if (product.type !== "image") throw Error("Missing fixture image");
    const background = { ...product, role: "background" as const, anchor: "center" as const,
      layout: { ...product.layout, sizing: "fill" as const } };
    const cropped = fillImageCrop(background, { x: 0, y: 0, width: 1200, height: 628 });
    expect(cropped.type).toBe("image");
    if (cropped.type !== "image") return;
    const originalAspect = product.geometry.width / product.geometry.height;
    const cropAspect = originalAspect * cropped.crop.width / cropped.crop.height;
    expect(cropAspect).toBeCloseTo(1200 / 628, 4);
    expect(cropped.crop.height).toBeLessThan(1);
    expect(product.crop.height).toBe(1);
    expect(cropped.geometry).toMatchObject({ width: 1200, height: 628 });
  });

  it("keeps typography within allowed font size constraints without rewriting text", () => {
    const preset = FORMAT_PRESETS.find(p => p.id === "gdn-320x100")!;
    const doc = composeDocument(master, preset.width, preset.height, preset.safeZone, "balanced");
    const title = doc.layers.find((l) => l.id === "text-headline");
    expect(title?.type).toBe("text");
    if (title?.type === "text") {
      expect(title.style.fontSize).toBeGreaterThanOrEqual(8);
      expect(title.text).toBe("BETTER.\nBY");
    }
    expect(approximateTextLines("Two\nwords", 200, 20)).toBe(2);
  });
});

describe("0.6.2 composition safety checks", () => {
  it("keeps customized copy, geometry and selected mode unchanged when other presets regenerate", () => {
    const master = createProject(true).project.document;
    const presets = FORMAT_PRESETS.filter((p) => p.platform === "pmax").slice(0, 2);
    const [first, second] = presets.map((p) => generateVariant(master, p, "balanced"));
    const editedFirst = structuredClone(first);
    editedFirst.status = "customized";
    const headline = editedFirst.document.layers.find((layer) => layer.id === "text-headline")!;
    if (headline.type !== "text") throw new Error("Missing demo headline");
    headline.geometry.x += 17;
    headline.text = "APPROVED TEXT";
    const merged = mergeGeneratedVariants(master, presets, [editedFirst, second], "product");
    expect(merged[0]).toEqual(editedFirst);
    expect(merged[0].composition).toBe("balanced");
    expect(merged[1].composition).toBe("product");
    expect(merged[1].id).toBe(second.id);
    const recomposed = recomposeVariant(master, merged[0], "text");
    expect(recomposed.id).toBe(editedFirst.id);
    expect(recomposed.composition).toBe("text");
    expect(recomposed.status).toBe("synced");
    // Recomposition is explicit; original customized document is untouched.
    expect(editedFirst.document.layers.find(l => l.id === "text-headline")).toEqual(headline);
    expect(recomposed.document.layers.find(l => l.id === "text-headline")).not.toEqual(headline);
  });
});
