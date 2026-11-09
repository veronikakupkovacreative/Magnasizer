import { describe, expect, it } from "vitest";
import { createProject, newLayer } from "@/features/projects/demo";
import { createHistory, execute, undo, redo, HISTORY_LIMIT } from "./history";

describe("immutable command history", () => {
  it("undoes and redoes exact text and geometry without mutating the original", () => {
    const project = createProject(true).project;
    const initial = structuredClone(project);
    const headline = project.document.layers.find(
      (l) => l.id === "text-headline",
    )!;
    if (headline.type !== "text") throw new Error("Missing headline");
    let h = createHistory(project);
    h = execute(h, {
      type: "update-layer",
      layer: {
        ...headline,
        text: "Approved copy",
        geometry: { ...headline.geometry, x: 99 },
      },
    });
    expect(project).toEqual(initial);
    const changed = h.present;
    h = undo(h);
    expect(h.present).toEqual(initial);
    h = redo(h);
    expect(h.present).toEqual(changed);
  });
  it("clears redo after branching and ignores no-op commands", () => {
    let h = createHistory(createProject(true).project);
    expect(execute(h, { type: "rename", name: h.present.name })).toBe(h);
    h = execute(h, { type: "rename", name: "A" });
    h = undo(h);
    h = execute(h, { type: "rename", name: "B" });
    expect(h.future).toHaveLength(0);
    expect(redo(h)).toBe(h);
  });
  it("enforces locks for edit, delete and ordering, with undoable unlocking", () => {
    let h = createHistory(createProject(true).project);
    h = execute(h, { type: "toggle-lock", id: "text-headline" });
    const locked = h.present.document.layers.find(
      (l) => l.id === "text-headline",
    )!;
    for (const command of [
      { type: "delete-layer" as const, id: locked.id },
      { type: "reorder" as const, id: locked.id, direction: "up" as const },
      { type: "update-layer" as const, layer: { ...locked, name: "Changed" } },
    ])
      expect(execute(h, command)).toBe(h);
    expect(
      undo(h).present.document.layers.find((l) => l.id === locked.id)?.locked,
    ).toBe(false);
  });
  it("preserves product aspect ratio in the command model itself", () => {
    const h = createHistory(createProject(true).project);
    const layer = h.present.document.layers.find((l) => l.type === "image")!;
    const next = execute(h, {
      type: "update-layer",
      layer: {
        ...layer,
        geometry: { ...layer.geometry, width: 180, height: 520 },
      },
    });
    const image = next.present.document.layers.find((l) => l.id === layer.id)!;
    expect(image.geometry.width).toBe(180);
    expect(image.geometry.height).toBe(260);
  });
  it("normalizes z-order after duplicate/reorder/delete and restores all layers", () => {
    let h = createHistory(createProject(true).project);
    const initial = h.present;
    const layer = newLayer("shape", 10);
    h = execute(h, { type: "insert-layer", layer });
    h = execute(h, { type: "reorder", id: layer.id, direction: "down" });
    expect(h.present.document.layers[9].id).toBe(layer.id);
    h = execute(h, { type: "delete-layer", id: layer.id });
    expect(h.present.document.layers.map((l) => l.zIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(undo(undo(undo(h))).present).toEqual(initial);
  });
  it("bounds retained history and keeps an empty history stable", () => {
    let h = createHistory(createProject(false).project);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    for (let i = 0; i < 120; i++)
      h = execute(h, { type: "rename", name: `Version ${i}` });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
