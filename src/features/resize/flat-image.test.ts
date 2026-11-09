import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { imageLayer, asFlatMaster } from "@/features/assets/import";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { bundleSchema, type Asset, type FlatImageSettings } from "@/shared/schema/project";
import { flatPlan, flatSource } from "./flat-image";
import { generateVariant, mergeGeneratedVariants, recomposeVariant } from "./engine";

const raster: Asset = {
  id: "raster-master",
  kind: "imported-image",
  name: "master.png",
  mimeType: "image/png",
  width: 1200,
  height: 1200,
  originalKey: "a".repeat(64),
  renderKey: "b".repeat(64),
  byteLength: 250000,
  sanitized: false,
};

function fixture() {
  const bundle = createProject(false);
  const flat = asFlatMaster(raster, bundle.project.document)!;
  bundle.project.flatImage = flat;
  bundle.assets = [raster];
  return { bundle, flat };
}

describe("0.8.1 JPG/PNG master workflow", () => {
  it("imports a single raster with native master dimensions, not a centered 80% picture", () => {
    const { bundle, flat } = fixture();
    const image = bundle.project.document.layers[0];
    expect(bundle.project.document.width).toBe(1200);
    expect(image.geometry).toMatchObject({ x: 0, y: 0, width: 1200, height: 1200 });
    expect(image.role).toBe("background");
    expect(flatSource(bundle.project.document, flat)?.id).toBe(image.id);
    expect(bundleSchema.parse(bundle).project.flatImage).toEqual(flat);
  });

  it("recognizes JPG and WebP as flat masters too", () => {
    for (const mimeType of ["image/jpeg", "image/webp"] as const) {
      const bundle = createProject(false);
      const flat = asFlatMaster({ ...raster, mimeType }, bundle.project.document);
      expect(flat?.fitMode).toBe("smart");
      expect(bundle.project.document.layers).toHaveLength(1);
    }
  });

  it("contains the entire image without cropping for every preset", () => {
    const { bundle, flat } = fixture();
    const master = bundle.project.document;
    const contain: FlatImageSettings = { ...flat, fitMode: "contain" };
    for (const preset of FORMAT_PRESETS) {
      const variant = generateVariant(master, preset, "auto", contain);
      expect(variant.document).toMatchObject({ width: preset.width, height: preset.height });
      expect(variant.flatImage).toEqual(contain);
      expect(variant.document.layers).toHaveLength(1);
      const layer = variant.document.layers[0];
      if (layer.type !== "image") throw new Error("Image expected");
      expect(layer.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
      expect(layer.geometry.width / layer.geometry.height).toBeCloseTo(1, 5);
      expect(layer.geometry.x).toBeGreaterThanOrEqual(0);
      expect(layer.geometry.y).toBeGreaterThanOrEqual(0);
      expect(layer.geometry.x + layer.geometry.width).toBeLessThanOrEqual(preset.width + .01);
      expect(layer.geometry.y + layer.geometry.height).toBeLessThanOrEqual(preset.height + .01);
      expect(bundleSchema.parse({ ...bundle, project: { ...bundle.project, variants: [variant] } })).toBeTruthy();
    }
  });

  it("cover keeps image proportions, fills all sizes and follows a right-side focal point", () => {
    const { bundle, flat } = fixture();
    for (const preset of FORMAT_PRESETS) {
      const plan = flatPlan(bundle.project.document, preset.width, preset.height, { ...flat, fitMode: "cover", focalX: 1, focalY: .5 });
      expect(plan.outcome).toBe("cover");
      const layer = plan.document.layers[0];
      if (layer.type !== "image") throw new Error("Image expected");
      expect(layer.geometry).toMatchObject({ x: 0, y: 0, width: preset.width, height: preset.height });
      expect(layer.geometry.width / layer.geometry.height).toBeCloseTo(layer.crop.width / layer.crop.height, 6);
      expect(layer.crop.x + layer.crop.width).toBeCloseTo(1, 6);
      expect(layer.crop.y + layer.crop.height).toBeLessThanOrEqual(1.000001);
    }
  });

  it("smart refuses destructive crops and protects the specified focal region", () => {
    const { bundle, flat } = fixture();
    const square = bundle.project.document;
    const extremelyWide = flatPlan(square, 728, 90, { ...flat, fitMode: "smart", protectedArea: .5 });
    expect(extremelyWide.outcome).toBe("contain");
    expect(extremelyWide.document.layers[0].type === "image" && extremelyWide.document.layers[0].crop.width).toBe(1);
    const moderate = flatPlan(square, 1200, 628, { ...flat, fitMode: "smart", protectedArea: .4 });
    expect(moderate.outcome).toBe("cover");
    expect(moderate.document.layers[0].geometry.width).toBe(1200);
    expect(flatPlan(square, 1080, 1920, { ...flat, fitMode: "smart", protectedArea: .9 }).outcome).toBe("contain");
  });

  it("regenerates safe variants but never overwrites customized crop/position", () => {
    const { bundle, flat } = fixture();
    const preset = FORMAT_PRESETS.find(p => p.id === "meta-story-1080x1920")!;
    const original = generateVariant(bundle.project.document, preset, "auto", flat);
    const custom = structuredClone(original);
    custom.status = "customized";
    custom.document.layers[0].geometry.x += 15;
    const changed = { ...flat, fitMode: "contain" as const };
    expect(mergeGeneratedVariants(bundle.project.document, [preset], [custom], "auto", changed)[0]).toEqual(custom);
    const applied = recomposeVariant(bundle.project.document, custom, "auto", changed);
    expect(applied.status).toBe("synced");
    expect(applied.flatImage).toEqual(changed);
    expect(original.flatImage?.fitMode).toBe("smart");
  });

  it("does not misclassify layered designs as flat masters", () => {
    const { bundle, flat } = fixture();
    bundle.project.document.layers.push({
      ...imageLayer(raster, bundle.project.document),
      zIndex: 1,
    });
    expect(flatSource(bundle.project.document, flat)).toBeNull();
  });
});
