import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { bundleSchema, FULL_CROP } from "@/shared/schema/project";
import { createHistory, execute, undo, redo } from "./history";
import { cropImageLayer, constrainCrop } from "./crop";
import { layerBounds, snapMove } from "./snapping";

describe("advanced canvas commands", () => {
  it("commits a multi-layer move as one reversible action and protects locks", () => {
    const project = createProject(true).project;
    project.document.layers[0].locked = true;
    const h = execute(createHistory(project), {
      type: "batch",
      commands: project.document.layers.slice(0, 3).map((layer) => ({
        type: "update-layer",
        layer: {
          ...layer,
          geometry: { ...layer.geometry, x: layer.geometry.x + 10 },
        },
      })),
    });
    expect(h.past).toHaveLength(1);
    expect(h.present.document.layers[0]).toEqual(project.document.layers[0]);
    expect(h.present.document.layers[1].geometry.x).toBe(
      project.document.layers[1].geometry.x + 10,
    );
    expect(undo(h).present).toEqual(project);
    expect(redo(undo(h)).present).toEqual(h.present);
  });
  it("reorders a multi-selection without reversing its internal stacking order", () => {
    const h = createHistory(createProject(true).project);
    const ids = ["text-headline", "shape-orbit"];
    const next = execute(h, {
      type: "reorder-layers",
      ids,
      direction: "front",
    });
    expect(next.present.document.layers.slice(-2).map((l) => l.id)).toEqual([
      "shape-orbit",
      "text-headline",
    ]);
    expect(next.present.document.layers.map((l) => l.zIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(undo(next).present).toEqual(h.present);
  });
  it("preserves source IDs and makes visibility and metadata reversible", () => {
    let h = createHistory(createProject(true).project);
    const original = h.present,
      layer = original.document.layers[4];
    h = execute(h, {
      type: "batch",
      commands: [
        { type: "set-visible", id: layer.id, visible: false },
        {
          type: "metadata",
          id: layer.id,
          role: "headline",
          priority: 95,
          anchor: "center",
          layout: { sizing: "scale", mandatory: true, padding: 24 },
        },
      ],
    });
    expect(h.present.document.layers[4]).toMatchObject({
      id: layer.id,
      sourceId: layer.sourceId,
      visible: false,
      priority: 95,
      layout: { padding: 24 },
    });
    expect(undo(h).present).toEqual(original);
  });
});
describe("nondestructive crop geometry", () => {
  it("changes the source window while preserving original scale and rotated position", () => {
    const bundle = createProject(true),
      image = bundle.project.document.layers.find((l) => l.type === "image")!;
    image.geometry.rotation = 90;
    const cropped = cropImageLayer(image, {
      x: 0.25,
      y: 0.1,
      width: 0.5,
      height: 0.8,
    });
    expect(cropped.geometry.width).toBeCloseTo(image.geometry.width * 0.5);
    expect(cropped.geometry.height).toBeCloseTo(image.geometry.height * 0.8);
    expect(cropped.geometry.x).toBeCloseTo(image.geometry.x - image.geometry.height * 0.1);
    expect(cropped.geometry.y).toBeCloseTo(image.geometry.y + image.geometry.width * 0.25);
    bundle.project.document.layers[8] = cropped;
    expect(() => bundleSchema.parse(bundle)).not.toThrow();
    if (cropped.type !== "image") throw new Error("Wrong layer");
    const reset = cropImageLayer(cropped, FULL_CROP);
    expect(reset.geometry.x).toBeCloseTo(image.geometry.x);
    expect(reset.geometry.y).toBeCloseTo(image.geometry.y);
    expect(reset.geometry.width).toBe(image.geometry.width);
    expect(reset.geometry.height).toBe(image.geometry.height);
    expect(image.crop).toEqual(FULL_CROP);
  });
  it("rejects invalid crops, clamps UI boundaries and enforces minimum display size", () => {
    const image = createProject(true).project.document.layers.find(
      (l) => l.type === "image",
    )!;
    expect(() =>
      cropImageLayer(image, { x: 0.9, y: 0, width: 0.5, height: 1 }),
    ).toThrow();
    expect(
      cropImageLayer(image, { x: 0, y: 0, width: 0.001, height: 0.001 }),
    ).toEqual(image);
    expect(
      constrainCrop({ x: -0.5, y: 0.99, width: 1.5, height: 0.5 }),
    ).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 });
  });
  it("undoes crop with its exact geometry in one step", () => {
    const h = createHistory(createProject(true).project);
    const cropped = execute(h, {
      type: "crop-image",
      id: "image-product",
      crop: { x: 0.2, y: 0.1, width: 0.6, height: 0.8 },
    });
    expect(cropped.past).toHaveLength(1);
    expect(undo(cropped).present).toEqual(h.present);
    expect(redo(undo(cropped)).present).toEqual(cropped.present);
  });
});
describe("smart guides", () => {
  it("snaps to canvas edges at a screen-space tolerance and ignores hidden targets", () => {
    const doc = createProject(true).project.document;
    const layer = doc.layers[1];
    doc.layers = [
      {
        ...layer,
        zIndex: 0,
        geometry: { x: 100, y: 100, width: 100, height: 100, rotation: 0 },
      },
    ];
    expect(snapMove(doc, [layer.id], -96, 0, 1)).toMatchObject({
      dx: -100,
      guides: [{ axis: "x", value: 0 }],
    });
    expect(snapMove(doc, [layer.id], -96, 0, 2).dx).toBe(-96);
    const target = {
      ...doc.layers[0],
      id: "target",
      sourceId: "target",
      zIndex: 1,
      geometry: { x: 300, y: 300, width: 100, height: 100, rotation: 0 },
    };
    doc.layers.push(target);
    expect(snapMove(doc, [layer.id], 97, 200, 1).dx).toBe(100);
    target.visible = false;
    expect(snapMove(doc, [layer.id], 97, 200, 1).dx).toBe(97);
  });
  it("uses rotated bounds and keeps a multi-selection together", () => {
    const box = layerBounds({
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      rotation: 90,
    });
    expect(box.x).toBeCloseTo(50);
    expect(box.width).toBeCloseTo(50);
    expect(box.height).toBeCloseTo(100);
    const doc = createProject(true).project.document;
    doc.layers = doc.layers.slice(0, 2).map((l, i) => ({
      ...l,
      geometry: {
        x: 100 + i * 200,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
      },
    }));
    expect(
      snapMove(
        doc,
        doc.layers.map((l) => l.id),
        -96,
        0,
        1,
      ).dx,
    ).toBe(-100);
  });
});
