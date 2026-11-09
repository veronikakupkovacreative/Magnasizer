import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import {
  deserializeProject,
  serializeProject,
  MAX_PROJECT_BYTES,
} from "./project";

describe("versioned document serialization", () => {
  it("round-trips exact dimensions, geometry, content, IDs and assets", () => {
    const bundle = createProject(true);
    const copy = deserializeProject(serializeProject(bundle));
    expect(copy).toEqual(bundle);
    expect(copy.project.document).toMatchObject({ width: 1200, height: 1200 });
    expect(copy.project.document.layers.map((l) => l.id)).toEqual(
      bundle.project.document.layers.map((l) => l.id),
    );
    expect(JSON.stringify(copy.project)).not.toContain("/assets/");
  });
  it("supports an empty master", () => {
    const bundle = createProject(false);
    expect(
      deserializeProject(serializeProject(bundle)).project.document.layers,
    ).toEqual([]);
  });
  it("rejects newer schema and bundle versions instead of losing fields", () => {
    const bundle = createProject(true);
    expect(() =>
      deserializeProject(JSON.stringify({ ...bundle, version: 3 })),
    ).toThrow();
    expect(() =>
      deserializeProject(
        JSON.stringify({
          ...bundle,
          project: { ...bundle.project, schemaVersion: 3 },
        }),
      ),
    ).toThrow();
  });
  it("rejects duplicate stable IDs and noncanonical z-order", () => {
    const bundle = createProject(true);
    bundle.project.document.layers[1].id = bundle.project.document.layers[0].id;
    expect(() => serializeProject(bundle)).toThrow();
    const other = createProject(true);
    other.project.document.layers[0].zIndex = 5;
    expect(() => serializeProject(other)).toThrow();
  });
  it("rejects dangling assets, remote URLs, and untrusted SVG markup", () => {
    const bundle = createProject(true);
    expect(() => serializeProject({ ...bundle, assets: [] })).toThrow();
    const remote = {
      ...bundle,
      assets: [{ ...bundle.assets[0], src: "https://example.com/tracker.svg" }],
    };
    expect(() => deserializeProject(JSON.stringify(remote))).toThrow();
    expect(() =>
      deserializeProject(
        JSON.stringify({ ...bundle, svg: '<svg onload="alert(1)"/>' }),
      ),
    ).toThrow();
  });
  it("rejects distorted products and disabled aspect protection", () => {
    const bundle = createProject(true);
    const image = bundle.project.document.layers.find(
      (l) => l.type === "image",
    )!;
    image.geometry.width *= 2;
    expect(() => serializeProject(bundle)).toThrow();
    image.geometry.width /= 2;
    image.constraints.preserveAspectRatio = false;
    expect(() => serializeProject(bundle)).toThrow();
  });
  it("rejects invalid geometry, malformed JSON and oversized documents", () => {
    const bundle = createProject(true);
    bundle.project.document.layers[0].geometry.width = -1;
    expect(() => serializeProject(bundle)).toThrow();
    expect(() => deserializeProject("{")).toThrow();
    expect(() => deserializeProject(" ".repeat(MAX_PROJECT_BYTES + 1))).toThrow(
      "PROJECT_TOO_LARGE",
    );
  });
});

it("migrates Phase 0 JSON and preserves exact text, layout and source lineage", () => {
  const bundle = createProject(true);
  const { variants: _variants, ...legacyProject } = bundle.project;
  void _variants;
  const old = {
    ...bundle,
    version: 1,
    project: {
      ...legacyProject,
      schemaVersion: 1,
      document: {
        ...bundle.project.document,
        layers: bundle.project.document.layers.map((layer) => {
          const { visible, layout, ...rest } = layer;
          void visible;
          void layout;
          if (rest.type === "image") {
            const { crop, ...image } = rest;
            void crop;
            return image;
          }
          return rest;
        }),
      },
    },
  };
  const migrated = deserializeProject(JSON.stringify(old));
  expect(migrated.version).toBe(2);
  expect(
    migrated.project.document.layers.map((l) => ({
      id: l.id,
      sourceId: l.sourceId,
      geometry: l.geometry,
    })),
  ).toEqual(
    bundle.project.document.layers.map((l) => ({
      id: l.id,
      sourceId: l.sourceId,
      geometry: l.geometry,
    })),
  );
  expect(migrated.project.document.layers[4]).toMatchObject({
    type: "text",
    text: "BETTER.\nBY DESIGN.",
    visible: true,
    layout: { mandatory: true },
  });
});
