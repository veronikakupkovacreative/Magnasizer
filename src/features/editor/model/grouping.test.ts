import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { bundleSchema } from "@/shared/schema/project";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { generateVariant, mergeGeneratedVariants } from "@/features/resize/engine";
import { createHistory, execute, redo, undo } from "./history";

const ids = ["text-headline", "text-body", "text-cta"];

describe("Layer groups: 0.7.1", () => {
  it("creates an editable, named group in one undo step and persists through project schema", () => {
    const bundle = createProject(true);
    const original = createHistory(bundle.project);
    const grouped = execute(original, { type: "group-layers", ids, groupId: "group-copy", name: "Campaign Copy" });
    expect(grouped.past).toHaveLength(1);
    for (const layer of grouped.present.document.layers.filter((layer) => ids.includes(layer.id))) {
      expect(layer).toMatchObject({ groupId: "group-copy", groupName: "Campaign Copy" });
    }
    expect(() => bundleSchema.parse({ ...bundle, project: grouped.present })).not.toThrow();
    expect(undo(grouped).present).toEqual(original.present);
    expect(redo(undo(grouped)).present).toEqual(grouped.present);
  });

  it("does not alter child coordinates or layer order when grouping or ungrouping", () => {
    const original = createHistory(createProject(true).project);
    let history = execute(original, { type: "group-layers", ids, groupId: "group-copy", name: "Copy" });
    expect(history.present.document.layers.map((l) => l.geometry)).toEqual(original.present.document.layers.map((l) => l.geometry));
    expect(history.present.document.layers.map((l) => l.id)).toEqual(original.present.document.layers.map((l) => l.id));
    history = execute(history, { type: "ungroup-layers", ids: ["text-headline"] });
    expect(history.present.document.layers.every((l) => l.groupId !== "group-copy")).toBe(true);
    expect(undo(history).present.document.layers.find(l => l.id === "text-cta")?.groupId).toBe("group-copy");
  });

  it("renames groups without changing individual layer names", () => {
    const base = createHistory(createProject(true).project);
    const grouped = execute(base, { type: "group-layers", ids, groupId: "group-copy", name: "Copy" });
    const renamed = execute(grouped, { type: "rename-group", groupId: "group-copy", name: "  Product Message  " });
    expect(renamed.present.document.layers.filter(l => ids.includes(l.id)).every(l => l.groupName === "Product Message")).toBe(true);
    expect(renamed.present.document.layers.find(l => l.id === "text-headline")?.name).toBe("Headline");
  });

  it("rejects grouping a locked layer and prevents accidental ID collision", () => {
    const project = createProject(true).project;
    project.document.layers.find(l => l.id === "text-cta")!.locked = true;
    const original = createHistory(project);
    expect(execute(original, { type: "group-layers", ids, groupId: "group-locked", name: "Copy" })).toEqual(original);
    const valid = execute(original, { type: "group-layers", ids: ids.slice(0, 2), groupId: "group-copy", name: "Copy" });
    const collision = execute(valid, { type: "group-layers", ids: ["text-brand", "text-body"], groupId: "group-copy", name: "Other" });
    expect(collision).toEqual(valid);
  });

  it("moves all members together when each member is updated as one history batch", () => {
    const base = createHistory(createProject(true).project);
    const grouped = execute(base, { type: "group-layers", ids, groupId: "group-copy", name: "Copy" });
    const members = grouped.present.document.layers.filter(l => l.groupId === "group-copy");
    const moved = execute(grouped, {
      type: "batch",
      commands: members.map(layer => ({ type: "update-layer", layer: { ...layer, geometry: { ...layer.geometry, x: layer.geometry.x + 32, y: layer.geometry.y + 16 } } })),
    });
    expect(moved.past).toHaveLength(2);
    for (const layer of members) {
      const next = moved.present.document.layers.find(l => l.id === layer.id)!;
      expect(next.geometry.x).toBe(layer.geometry.x + 32);
      expect(next.geometry.y).toBe(layer.geometry.y + 16);
      expect(next.groupId).toBe("group-copy");
    }
    expect(undo(moved).present).toEqual(grouped.present);
  });

  it("preserves groups in generated variants and never overwrites customized variants", () => {
    const grouped = execute(createHistory(createProject(true).project), { type: "group-layers", ids, groupId: "group-copy", name: "Copy" }).present;
    const preset = FORMAT_PRESETS[1];
    const variant = generateVariant(grouped.document, preset, "balanced");
    expect(variant.document.layers.filter(l => l.groupId === "group-copy")).toHaveLength(3);
    const customized = { ...variant, status: "customized" as const };
    expect(mergeGeneratedVariants(grouped.document, [preset], [customized], "product")[0]).toEqual(customized);
  });
});
