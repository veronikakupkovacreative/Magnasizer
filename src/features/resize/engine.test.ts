import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { generateVariant, mergeGeneratedVariants, validateVariant } from "./engine";

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
