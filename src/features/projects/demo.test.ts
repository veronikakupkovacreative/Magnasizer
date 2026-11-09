import { describe, expect, it } from "vitest";
import { createProject } from "./demo";
import { bundleSchema } from "@/shared/schema/project";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { generateVariant, mergeGeneratedVariants } from "@/features/resize/engine";

describe("FORM editorial demo — release 0.7.0", () => {
  it("creates a valid dark 1200-square document with independently editable product and copy", () => {
    const bundle = createProject(true);
    expect(() => bundleSchema.parse(bundle)).not.toThrow();
    const doc = bundle.project.document;
    expect([doc.width, doc.height, doc.background]).toEqual([1200, 1200, "#172820"]);
    expect(doc.layers).toHaveLength(10);
    expect(doc.layers.find((layer) => layer.id === "text-headline")).toMatchObject({
      type: "text", text: "BETTER.\nBY", role: "headline", visible: true,
    });
    expect(doc.layers.find((layer) => layer.id === "image-product")).toMatchObject({
      type: "image", role: "product", visible: true,
    });
  });

  it("gives all three compositions their original editable text and valid product proportions", () => {
    const master = createProject(true).project.document;
    for (const mode of ["balanced", "product", "text"] as const) {
      for (const preset of FORMAT_PRESETS) {
        const variant = generateVariant(master, preset, mode);
        expect(variant.document.layers.find((layer) => layer.id === "text-headline")).toMatchObject({
          text: "BETTER.\nBY",
        });
        const product = variant.document.layers.find((layer) => layer.id === "image-product");
        expect(product?.geometry.width! / product?.geometry.height!).toBeCloseTo(360 / 520, 3);
        expect(variant.document).toMatchObject({ width: preset.width, height: preset.height });
      }
    }
  });

  it("keeps a manually customized artboard intact when regenerating a batch", () => {
    const master = createProject(true).project.document;
    const preset = FORMAT_PRESETS.find((value) => value.id === "meta-story-1080x1920")!;
    const adjusted = generateVariant(master, preset, "balanced");
    adjusted.status = "customized";
    adjusted.document.layers[4].geometry.x += 29;
    const [result] = mergeGeneratedVariants(master, [preset], [adjusted], "product");
    expect(result).toEqual(adjusted);
  });
});
