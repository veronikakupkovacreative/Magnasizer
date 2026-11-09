import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteDB, openDB } from "idb";
import { createProject } from "@/features/projects/demo";
import { localProjects } from "./projects";
import type { Asset } from "@/shared/schema/project";
import { imageLayer, hashBlob } from "@/features/assets/import";
import { generateVariant } from "@/features/resize/engine";
import { FORMAT_PRESETS } from "@/features/formats/presets";
beforeEach(async () => {
  await deleteDB("smart-resize-studio");
});
describe("versioned local project storage", () => {
  it("atomically saves and reopens original binary files separately from canonical metadata", async () => {
    const bundle = createProject(false),
      blob = new Blob(["image bytes"], { type: "image/png" }),
      key = await hashBlob(blob);
    const asset: Asset = {
      id: "asset-one",
      kind: "imported-image",
      name: "product.png",
      mimeType: "image/png",
      width: 320,
      height: 160,
      byteLength: blob.size,
      originalKey: key,
      renderKey: key,
      sanitized: false,
    };
    bundle.assets = [asset];
    bundle.project.document.layers = [
      imageLayer(asset, bundle.project.document),
    ];
    await localProjects.save(bundle, { [key]: blob });
    const loaded = (await localProjects.load(bundle.project.id))!;
    expect(loaded.bundle.project.document).toEqual(bundle.project.document);
    expect(await loaded.blobs[key].text()).toBe("image bytes");
    expect(JSON.stringify(loaded.bundle.project)).not.toContain("image bytes");
    // Same asset ID in another imported project cannot overwrite this catalog.
    const other = structuredClone(bundle);
    other.project.id = "other-project";
    other.assets[0] = { ...asset, name: "renamed.png" };
    await localProjects.save(other);
    expect(
      (await localProjects.load(bundle.project.id))!.bundle.assets[0],
    ).toEqual(asset);
  });
  it("fails safely if image bytes are missing without creating a partial project", async () => {
    const bundle = createProject(false);
    const asset: Asset = {
      id: "missing",
      kind: "imported-image",
      name: "x.png",
      mimeType: "image/png",
      width: 100,
      height: 100,
      byteLength: 10,
      originalKey: "a".repeat(64),
      renderKey: "a".repeat(64),
      sanitized: false,
    };
    bundle.assets = [asset];
    bundle.project.document.layers = [
      imageLayer(asset, bundle.project.document),
    ];
    await expect(localProjects.save(bundle)).rejects.toThrow("missingAsset");
    expect(await localProjects.load(bundle.project.id)).toBeUndefined();
  });
  it("reopens assets referenced only by generated variants", async () => {
    const bundle = createProject(false),
      blob = new Blob(["variant image"], { type: "image/png" }),
      key = await hashBlob(blob);
    const asset: Asset = {
      id: "variant-asset",
      kind: "imported-image",
      name: "variant.png",
      mimeType: "image/png",
      width: 200,
      height: 100,
      byteLength: blob.size,
      originalKey: key,
      renderKey: key,
      sanitized: false,
    };
    bundle.assets = [asset];
    const variant = generateVariant(bundle.project.document, FORMAT_PRESETS[2]);
    variant.document.layers = [imageLayer(asset, variant.document)];
    bundle.project.variants = [variant];
    await localProjects.save(bundle, { [key]: blob });
    const loaded = (await localProjects.load(bundle.project.id))!;
    expect(loaded.bundle.assets[0]).toEqual(asset);
    expect(await loaded.blobs[key].text()).toBe("variant image");
  });
  it("migrates a Phase 0 IndexedDB project without losing geometry, IDs or assets", async () => {
    const bundle = createProject(true);
    const old = {
      ...bundle.project,
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
    };
    const db = await openDB("smart-resize-studio", 1, {
      upgrade(db) {
        db.createObjectStore("projects", { keyPath: "id" });
        db.createObjectStore("assets", { keyPath: "id" });
      },
    });
    await db.put("projects", old);
    await db.put("assets", bundle.assets[0]);
    db.close();
    const loaded = (await localProjects.load(bundle.project.id))!;
    expect(loaded.bundle.version).toBe(2);
    expect(
      loaded.bundle.project.document.layers.map((l) => l.geometry),
    ).toEqual(bundle.project.document.layers.map((l) => l.geometry));
    expect(loaded.bundle.project.document.layers.map((l) => l.id)).toEqual(
      bundle.project.document.layers.map((l) => l.id),
    );
    expect(loaded.bundle.project.document.layers.every((l) => l.visible)).toBe(
      true,
    );
    await localProjects.save(loaded.bundle, loaded.blobs);
    expect((await localProjects.list())[0].schemaVersion).toBe(2);
  });
});

describe("version 0.5 font and workspace persistence", () => {
  it("retains uploaded fonts even when no layer references them yet", async () => {
    const bundle = createProject(true);
    const font = new Blob([new Uint8Array([0, 1, 0, 0, 42])], { type: "font/ttf" });
    const key = await hashBlob(font);
    bundle.assets.push({ id: "font-test", kind: "imported-font", name: "Brand.ttf", fontFamily: "SRS Brand 000001", mimeType: "font/ttf", byteLength: font.size, blobKey: key });
    bundle.project.workspacePositions = { master: { x: 500, y: 250 } };
    await localProjects.save(bundle, { [key]: font });
    const loaded = (await localProjects.load(bundle.project.id))!;
    expect(loaded.bundle.project.workspacePositions?.master).toEqual({ x: 500, y: 250 });
    expect(loaded.bundle.assets.find(asset => asset.kind === "imported-font")?.id).toBe("font-test");
    expect(await loaded.blobs[key].arrayBuffer()).toEqual(await font.arrayBuffer());
  });
});

describe("version 0.6.2 permanent project deletion", () => {
  it("removes exactly one project, its catalog and unreferenced image data", async () => {
    const target = createProject(false);
    target.project.name = "Remove me";
    const other = createProject(false);
    other.project.name = "Keep me";
    const blob = new Blob(["private asset"], { type: "image/png" });
    const key = await hashBlob(blob);
    const asset: Asset = {
      id: "private-image", kind: "imported-image", name: "private.png",
      mimeType: "image/png", width: 80, height: 80, byteLength: blob.size,
      originalKey: key, renderKey: key, sanitized: false,
    };
    target.assets.push(asset);
    target.project.document.layers.push(imageLayer(asset, target.project.document));
    await localProjects.save(target, { [key]: blob });
    await localProjects.save(other);
    expect(await localProjects.remove(target.project.id)).toBe(true);
    expect(await localProjects.load(target.project.id)).toBeUndefined();
    expect((await localProjects.list()).map((project) => project.name)).toEqual(["Keep me"]);
    expect(await localProjects.load(other.project.id)).toBeDefined();
    const db = await openDB("smart-resize-studio", 2);
    expect(await db.get("binaries", key)).toBeUndefined();
    expect(await db.getAll("catalog")).toHaveLength(0);
    db.close();
  });

  it("keeps content-addressed files used by other projects until the last reference is removed", async () => {
    const blob = new Blob(["shared file"], { type: "image/png" });
    const key = await hashBlob(blob);
    const projects = [createProject(false), createProject(false)];
    for (const [index, bundle] of projects.entries()) {
      const asset: Asset = {
        id: `same-binary-${index}`, kind: "imported-image", name: `shared-${index}.png`,
        mimeType: "image/png", width: 80, height: 80, byteLength: blob.size,
        originalKey: key, renderKey: key, sanitized: false,
      };
      bundle.assets.push(asset);
      bundle.project.document.layers.push(imageLayer(asset, bundle.project.document));
      await localProjects.save(bundle, { [key]: blob });
    }
    expect(await localProjects.remove(projects[0].project.id)).toBe(true);
    expect(await (await localProjects.load(projects[1].project.id))?.blobs[key].text()).toBe("shared file");
    const db = await openDB("smart-resize-studio", 2);
    expect(await db.get("binaries", key)).toBeDefined();
    db.close();
    expect(await localProjects.remove(projects[1].project.id)).toBe(true);
    const lastDb = await openDB("smart-resize-studio", 2);
    expect(await lastDb.get("binaries", key)).toBeUndefined();
    lastDb.close();
  });

  it("removes orphaned font binaries and does not alter storage for an unknown project", async () => {
    const bundle = createProject(false);
    const font = new Blob([new Uint8Array([0, 1, 0, 0, 42])], { type: "font/ttf" });
    const key = await hashBlob(font);
    bundle.assets.push({ id: "font-to-delete", kind: "imported-font", name: "Brand.ttf",
      fontFamily: "SRS Brand 000001", mimeType: "font/ttf", byteLength: font.size, blobKey: key });
    await localProjects.save(bundle, { [key]: font });
    expect(await localProjects.remove("unknown-project")).toBe(false);
    expect(await localProjects.remove(" ")).toBe(false);
    expect((await localProjects.list())).toHaveLength(1);
    expect(await localProjects.remove(bundle.project.id)).toBe(true);
    const db = await openDB("smart-resize-studio", 2);
    expect(await db.get("binaries", key)).toBeUndefined();
    expect(await db.getAll("catalog")).toHaveLength(0);
    db.close();
  });
});

describe("0.6.2 legacy asset cleanup", () => {
  it("does not discard legacy assets used by another saved project", async () => {
    const blob = new Blob(["legacy"], { type: "image/png" });
    const key = await hashBlob(blob);
    const asset: Asset = { id: "legacy-image", kind: "imported-image", name: "legacy.png",
      mimeType: "image/png", width: 80, height: 80, byteLength: blob.size,
      originalKey: key, renderKey: key, sanitized: false };
    const first = createProject(false);
    const second = createProject(false);
    for (const bundle of [first, second]) {
      bundle.project.document.layers = [imageLayer(asset, bundle.project.document)];
    }
    // Simulate the unscoped Phase-1 asset store after automatic schema upgrade.
    const db = await openDB("smart-resize-studio", 2, {
      upgrade(db) {
        db.createObjectStore("projects", { keyPath: "id" });
        db.createObjectStore("assets", { keyPath: "id" });
        db.createObjectStore("catalog", { keyPath: ["projectId", "id"] });
        db.createObjectStore("binaries");
      },
    });
    await db.put("projects", first.project);
    await db.put("projects", second.project);
    await db.put("assets", asset);
    await db.put("binaries", blob, key);
    db.close();
    expect(await localProjects.remove(first.project.id)).toBe(true);
    const kept = await openDB("smart-resize-studio", 2);
    expect(await kept.get("assets", asset.id)).toEqual(asset);
    expect(await kept.get("binaries", key)).toBeDefined();
    kept.close();
    expect(await localProjects.remove(second.project.id)).toBe(true);
    const cleaned = await openDB("smart-resize-studio", 2);
    expect(await cleaned.get("assets", asset.id)).toBeUndefined();
    expect(await cleaned.get("binaries", key)).toBeUndefined();
    cleaned.close();
  });
});
