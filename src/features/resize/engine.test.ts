import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { generateVariant, mergeGeneratedVariants, validateVariant, variantCountAfterGeneration } from "./engine";

describe("resize engine", () => {
  const master = createProject(true).project.document;
  it("generates multiple ratios deterministically without distorting images", () => {
    for (const preset of FORMAT_PRESETS.slice(0, 6)) {
      const variant = generateVariant(master, preset);
      expect(variant.document).toMatchObject({ width: preset.width, height: preset.height });
      const image = variant.document.layers.find((layer) => layer.type === "image")!;
      expect(image.geometry.width / image.geometry.height).toBeCloseTo(360 / 520);
      const headline = variant.document.layers.find((layer) => layer.id === "text-headline")!;
      expect(headline.type).toBe("text");
      if (headline.type === "text") expect(headline.text).toBe("BETTER.\nBY");
    }
  });
  it("rejects only new presets at the 40-artboard boundary", () => {
    const template = generateVariant(master, FORMAT_PRESETS[0]);
    const current = Array.from({ length: 40 }, (_, i) => ({ ...template,
      id: `custom-${i}`, presetId: `custom-${i}`, status: "customized" as const }));
    expect(variantCountAfterGeneration(current, [FORMAT_PRESETS[1]])).toBe(41);
    const retained = [{ ...template, id: "existing" }, ...current.slice(1)];
    expect(variantCountAfterGeneration(retained, [FORMAT_PRESETS[0]])).toBe(40);
  });
  it("preserves customized variants on regeneration", () => {
    const preset = FORMAT_PRESETS[2];
    const customized = { ...generateVariant(master, preset), status: "customized" as const };
    customized.document.layers[0].geometry.x = 123;
    const [result] = mergeGeneratedVariants(master, [preset], [customized]);
    expect(result).toEqual(customized);
  });
  it("reports safe-zone warnings instead of silently changing approved content", () => {
    const variant = generateVariant(master, FORMAT_PRESETS.at(-1)!);
    expect(validateVariant(variant.document, variant.safeZone).length).toBeGreaterThan(0);
  });
});
