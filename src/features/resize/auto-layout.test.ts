import { describe, it, expect } from "vitest";
import { createProject } from "@/features/projects/demo";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { generateVariant, scoreComposition, mergeGeneratedVariants } from "./engine";
import { bundleSchema } from "@/shared/schema/project";

describe("0.8 Auto Layout", () => {
  const master = createProject(true).project.document;
  it("chooses a best-scored preset plan without touching the master", () => {
    for (const preset of FORMAT_PRESETS) {
      const candidates = (["balanced", "product", "text"] as const).map(mode => generateVariant(master, preset, mode));
      const auto = generateVariant(master, preset, "auto");
      const maxScore = Math.max(...candidates.map(v => scoreComposition(v.document, v.safeZone)));
      expect(scoreComposition(auto.document, preset.safeZone)).toBeCloseTo(maxScore, 5);
      expect(auto.composition).toBe("auto");
      expect(auto.document.backgroundStyleId).toBe(master.backgroundStyleId);
      const product = auto.document.layers.find(l => l.id === "image-product");
      expect(product?.type).toBe("image");
      if (product?.type === "image") expect(product.geometry.width / product.geometry.height).toBeCloseTo(360 / 520, 4);
    }
  });
  it("preserves manually customized layouts on regeneration with auto mode", () => {
    const preset = FORMAT_PRESETS[1];
    const variant = generateVariant(master, preset, "text");
    variant.status = "customized";
    const updated = mergeGeneratedVariants(master, [preset], [variant], "auto");
    expect(updated[0]).toEqual(variant);
  });
  it("preserves schema compatibility when persisting auto composition", () => {
    const bundle = createProject(true);
    bundle.project.variants.push(generateVariant(master, FORMAT_PRESETS[0], "auto"));
    expect(bundleSchema.parse(bundle).project.variants[0].composition).toBe("auto");
  });
});
