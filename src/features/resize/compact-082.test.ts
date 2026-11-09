import { describe, it, expect } from "vitest";
import { createProject } from "@/features/projects/demo";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { generateVariant, scoreComposition, refineCompactLayout } from "./engine";

describe("MAGNASIZER 0.8.2 compact display layouts", () => {
  const master = createProject(true).project.document;
  const sizes = ["gdn-320x100", "gdn-728x90", "gdn-300x250", "gdn-336x280"];
  it("keeps essential roles visible and within each target artboard", () => {
    for (const id of sizes) {
      const preset = FORMAT_PRESETS.find((item) => item.id === id)!;
      const generated = generateVariant(master, preset, "auto");
      expect(generated.document.width).toBe(preset.width);
      expect(generated.document.height).toBe(preset.height);
      for (const role of ["headline", "logo", "cta", "product"] as const) {
        const item = generated.document.layers.find((layer) => layer.role === role && (role !== "cta" || layer.type === "text"));
        expect(item?.visible).toBe(true);
        if (!item) continue;
        expect(item.geometry.x).toBeGreaterThanOrEqual(-1);
        expect(item.geometry.y).toBeGreaterThanOrEqual(-1);
        expect(item.geometry.x + item.geometry.width).toBeLessThanOrEqual(preset.width + 2);
        expect(item.geometry.y + item.geometry.height).toBeLessThanOrEqual(preset.height + 2);
      }
      const image = generated.document.layers.find((layer) => layer.role === "product" && layer.type === "image");
      expect(image?.geometry.width! / image?.geometry.height!).toBeCloseTo(360 / 520, 3);
    }
  });
  it("leaves master unchanged; layout scoring consistently selects best candidate", () => {
    const before = JSON.stringify(master);
    for (const id of sizes) {
      const preset = FORMAT_PRESETS.find((item) => item.id === id)!;
      const candidates = (["balanced", "product", "text"] as const).map((mode) => generateVariant(master, preset, mode));
      const auto = generateVariant(master, preset, "auto");
      const max = Math.max(...candidates.map((v) => scoreComposition(v.document, preset.safeZone)));
      expect(scoreComposition(auto.document, preset.safeZone)).toBeCloseTo(max, 4);
      expect(refineCompactLayout(candidates[0].document, preset.safeZone, "balanced").layers.length).toBe(master.layers.length);
    }
    expect(JSON.stringify(master)).toBe(before);
  });
});
