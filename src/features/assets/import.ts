import {
  assetSchema,
  FULL_CROP,
  type Asset,
  type AssetBlobs,
  type Layer,
  type StudioDocument,
  type FlatImageSettings,
} from "@/shared/schema/project";
import { sanitizeSvg } from "./svg";
import { rasterInfo, validateDimensions } from "./raster";
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
export const IMAGE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml";
export async function hashBlob(blob: Blob) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function decodeImage(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("assetDecodeError"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export type ImportedAsset = {
  asset: Extract<Asset, { kind: "imported-image" }>;
  blobs: AssetBlobs;
  removed: number;
};
export async function importImage(file: File): Promise<ImportedAsset> {
  if (file.size === 0 || file.size > MAX_ASSET_BYTES)
    throw new Error("assetTooLarge");
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (!["png", "jpg", "jpeg", "webp", "svg"].includes(extension ?? ""))
    throw new Error("unsupportedImage");
  let render: Blob,
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml",
    removed = 0;
  if (extension === "svg") {
    const safe = sanitizeSvg(await file.text());
    removed = safe.removed;
    mimeType = "image/svg+xml";
    render = new Blob([safe.svg], { type: mimeType });
  } else {
    const header = rasterInfo(new Uint8Array(await file.arrayBuffer()));
    validateDimensions(header.width, header.height);
    mimeType = header.mimeType;
    const expected =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";
    if (expected !== mimeType) throw new Error("unsupportedImage");
    render = new Blob([file], { type: mimeType });
  }
  const dimensions = await decodeImage(render);
  validateDimensions(dimensions.width, dimensions.height);
  const original = new Blob([file], { type: mimeType }),
    originalKey = await hashBlob(original),
    renderKey = await hashBlob(render);
  const asset = assetSchema.parse({
    id: crypto.randomUUID(),
    kind: "imported-image",
    name: file.name.slice(0, 200),
    mimeType,
    ...dimensions,
    byteLength: file.size,
    originalKey,
    renderKey,
    sanitized: mimeType === "image/svg+xml",
  });
  if (asset.kind !== "imported-image") throw new Error("unsupportedImage");
  return {
    asset,
    blobs: { [originalKey]: original, [renderKey]: render },
    removed,
  };
}
export function imageLayer(
  asset: Extract<Asset, { kind: "bundled-image" | "imported-image" }>,
  doc: Pick<StudioDocument, "width" | "height" | "layers">,
  offset = 0,
): Layer {
  const scale = Math.max(
    8 / asset.width,
    8 / asset.height,
    Math.min(
      1,
      (doc.width * 0.8) / asset.width,
      (doc.height * 0.8) / asset.height,
    ),
  );
  const width = asset.width * scale,
    height = asset.height * scale;
  if (width > 8192 || height > 8192) throw new Error("imageDimensions");
  const id = crypto.randomUUID();
  return {
    id,
    sourceId: id,
    name:
      asset.kind === "imported-image"
        ? asset.name.trim().slice(0, 100) || "Image"
        : "Image",
    type: "image",
    assetId: asset.id,
    crop: { ...FULL_CROP },
    style: { opacity: 1 },
    geometry: {
      x: (doc.width - width) / 2 + offset,
      y: (doc.height - height) / 2 + offset,
      width,
      height,
      rotation: 0,
    },
    zIndex: doc.layers.length,
    role: "product",
    priority: 80,
    anchor: "center",
    constraints: { preserveAspectRatio: true, minWidth: 8, minHeight: 8 },
    locked: false,
    visible: true,
    layout: { sizing: "scale", mandatory: true, padding: 0 },
  };
}
export function assetKeys(assets: Asset[]) {
  return [
    ...new Set(
      assets.flatMap((a) =>
        a.kind === "imported-image" ? [a.originalKey, a.renderKey] : a.kind === "imported-font" ? [a.blobKey] : [],
      ),
    ),
  ];
}

/** When a single PNG/JPG starts a project, make it the actual full-size master. */
export function asFlatMaster(asset: Asset, document: StudioDocument): FlatImageSettings | null {
  if (asset.kind !== "imported-image" || !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType) || asset.width < 64 || asset.height < 64) return null;
  // A canvas image layer cannot represent a sub-8px side. Keep exceptionally
  // extreme images in the existing ordinary import workflow instead.
  const ratio = asset.width / asset.height;
  if (ratio < 0.1 || ratio > 10) return null;
  const source = imageLayer(asset, { width: asset.width, height: asset.height, layers: [] });
  document.width = asset.width;
  document.height = asset.height;
  document.layers = [{
    ...source,
    role: "background",
    priority: 100,
    geometry: { x: 0, y: 0, width: asset.width, height: asset.height, rotation: 0 },
    layout: { sizing: "fill", mandatory: true, padding: 0 },
  }];
  return { sourceLayerId: source.id, fitMode: "smart", focalX: 0.5, focalY: 0.5, protectedArea: 0.5 };
}
