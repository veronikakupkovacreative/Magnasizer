import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { generateVariant } from "@/features/resize/engine";
import { projectSchema } from "@/shared/schema/project";
import { addBrandColor, applyColorStyle, deleteBrandColor, updateBrandColor, updateBrandTextStyle, deleteBrandTextStyle } from "./brand-styles";

describe("0.8 linked brand styles", () => {
  it("keeps the demo prelinked and schema compatible with empty legacy brand kits", () => {
    const demo = createProject(true).project;
    expect(projectSchema.parse(demo).brandKit?.colors.length).toBeGreaterThan(0);
    const old = createProject(false).project;
    expect(projectSchema.parse(old).brandKit).toBeUndefined();
  });
  it("recolors the linked master and customized variants without changing approved copy or geometry", () => {
    const project = createProject(true).project;
    const variant = generateVariant(project.document, FORMAT_PRESETS[1], "balanced");
    variant.status = "customized";
    project.variants = [variant];
    const initial = structuredClone(project.variants[0].document);
    const updated = updateBrandColor(project, "brand-lime", "#E8312A", "Campaign red");
    expect(updated.brandKit?.colors.find(c => c.id === "brand-lime")?.value).toBe("#E8312A");
    expect(updated.document.layers.find(l => l.id === "shape-orbit")?.type).toBe("shape");
    const spot = updated.variants[0].document.layers.find(l => l.id === "shape-orbit")!;
    expect(spot.type === "shape" ? spot.style.fill : null).toBe("#E8312A");
    expect(spot.geometry).toEqual(initial.layers.find(l => l.id === "shape-orbit")!.geometry);
    expect(updated.variants[0].status).toBe("customized");
  });
  it("can link, detach and delete styles without destroying the layer appearance", () => {
    const initial = createProject(true).project;
    const added = addBrandColor(initial, { id: "test-brand-color", name: "Primary", value: "#335577" });
    const linked = applyColorStyle(added, null, "text-headline", "test-brand-color");
    expect(linked.document.layers.find(l => l.id === "text-headline")?.colorStyleId).toBe("test-brand-color");
    const deleted = deleteBrandColor(linked, "test-brand-color");
    const headline = deleted.document.layers.find(l => l.id === "text-headline")!;
    expect(headline.colorStyleId).toBeUndefined();
    expect(headline.type === "text" && headline.style.fill).toBe("#335577");
  });
  it("updates linked text styles across variants while keeping independent text and layout", () => {
    const initial = createProject(true).project;
    const variant = generateVariant(initial.document, FORMAT_PRESETS[2], "auto");
    variant.status = "customized";
    const target = variant.document.layers.find(l => l.id === "text-headline")!;
    if (target.type !== "text") throw Error("Missing headline");
    target.text = "APPROVED";
    const before = structuredClone(target.geometry);
    initial.variants = [variant];
    const next = updateBrandTextStyle(initial, "brand-headline", {
      id: "brand-headline", name: "Display", fontFamily: "Arial", fontSize: 95, fontWeight: "600", align: "left",
    });
    const after = next.variants[0].document.layers.find(l => l.id === "text-headline")!;
    expect(after.type === "text" ? after.text : "").toBe("APPROVED");
    expect(after.geometry).toEqual(before);
    expect(after.type === "text" ? after.style.fontFamily : "").toBe("Arial");
    const detached = deleteBrandTextStyle(next, "brand-headline");
    expect(detached.variants[0].document.layers.find(l => l.id === "text-headline")?.type === "text").toBe(true);
    expect(projectSchema.parse(detached)).toBeTruthy();
  });
});
