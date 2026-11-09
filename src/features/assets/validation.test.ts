import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { bundleSchema, type Asset } from "@/shared/schema/project";
import { createHistory, execute } from "@/features/editor/model/history";
import { decodeProject } from "./project-file";
import { hashBlob, imageLayer } from "./import";
import { rasterInfo, validateDimensions } from "./raster";

describe("raster validation", () => {
  it("reads PNG dimensions before decoding and rejects unsupported signatures", () => {
    const bytes = new Uint8Array(33);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    bytes.set([73, 72, 68, 82], 12);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 800);
    view.setUint32(20, 400);
    expect(rasterInfo(bytes)).toEqual({
      mimeType: "image/png",
      width: 800,
      height: 400,
    });
    expect(() => rasterInfo(new TextEncoder().encode("<svg/>"))).toThrow(
      "unsupportedImage",
    );
  });
  it("enforces dimension and pixel limits before allocation", () => {
    expect(() => validateDimensions(8192, 8192)).toThrow("imageDimensions");
    expect(() => validateDimensions(8193, 1)).toThrow("imageDimensions");
    expect(() => validateDimensions(0, 100)).toThrow("imageDimensions");
    expect(() => validateDimensions(4000, 3000)).not.toThrow();
  });
  it("fits extreme proportions without distorting images or violating minimums", () => {
    const asset: Asset = {
      id: "thin",
      kind: "imported-image",
      name: "thin.png",
      mimeType: "image/png",
      width: 800,
      height: 1,
      byteLength: 100,
      originalKey: "a".repeat(64),
      renderKey: "a".repeat(64),
      sanitized: false,
    };
    const layer = imageLayer(asset, createProject(false).project.document);
    expect(layer.geometry.width / layer.geometry.height).toBe(800);
    expect(layer.geometry.height).toBe(8);
    expect(() =>
      imageLayer(
        { ...asset, width: 8192 },
        createProject(false).project.document,
      ),
    ).toThrow("imageDimensions");
  });
  it.each([
    "product-".repeat(24) + ".png",
    " ".repeat(196) + ".png",
    " ".repeat(200),
  ])(
    "imports a schema-safe layer without changing its source filename",
    (name) => {
      const bundle = createProject(false);
      const asset: Asset = {
        id: "named-asset",
        kind: "imported-image",
        name,
        mimeType: "image/png",
        width: 100,
        height: 50,
        byteLength: 100,
        originalKey: "a".repeat(64),
        renderKey: "a".repeat(64),
        sanitized: false,
      };
      const layer = imageLayer(asset, bundle.project.document);
      const history = execute(createHistory(bundle.project), {
        type: "insert-layer",
        layer,
      });
      const saved = bundleSchema.parse({
        ...bundle,
        project: history.present,
        assets: [asset],
      });
      expect(saved.project.document.layers[0].name.length).toBeGreaterThan(0);
      expect(saved.project.document.layers[0].name.length).toBeLessThanOrEqual(
        100,
      );
      expect(saved.assets[0]).toMatchObject({ name });
      expect(asset.name).toBe(name);
    },
  );
});
describe("portable image payload validation", () => {
  async function fixture() {
    const bundle = createProject(false),
      blob = new Blob(["unchanged source"], { type: "image/png" }),
      key = await hashBlob(blob);
    const asset: Asset = {
      id: "asset",
      kind: "imported-image",
      name: "product.png",
      mimeType: "image/png",
      width: 100,
      height: 50,
      byteLength: blob.size,
      originalKey: key,
      renderKey: key,
      sanitized: false,
    };
    bundle.assets = [asset];
    bundle.project.document.layers = [
      imageLayer(asset, bundle.project.document),
    ];
    return {
      bundle,
      file: { key, type: "image/png", data: btoa(await blob.text()) },
    };
  }
  it("rejects metadata-only downloads when imported bytes are missing", async () => {
    const { bundle } = await fixture();
    await expect(decodeProject(JSON.stringify(bundle))).rejects.toThrow(
      "missingAsset",
    );
    await expect(
      decodeProject(JSON.stringify({ ...bundle, files: [] })),
    ).rejects.toThrow("missingAsset");
  });
  it("rejects corrupt checksums before decoding any image", async () => {
    const { bundle, file } = await fixture();
    await expect(
      decodeProject(
        JSON.stringify({
          ...bundle,
          files: [{ ...file, data: btoa("tampered") }],
        }),
      ),
    ).rejects.toThrow("Invalid checksum");
  });
  it("rejects duplicate binary keys", async () => {
    const { bundle, file } = await fixture();
    await expect(
      decodeProject(JSON.stringify({ ...bundle, files: [file, file] })),
    ).rejects.toThrow("Duplicate blob");
  });
});
