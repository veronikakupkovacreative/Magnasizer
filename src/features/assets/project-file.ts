import { z } from "zod";
import {
  bundleSchema,
  deserializeProject,
  MAX_PROJECT_BYTES,
  type LoadedProject,
  type ProjectBundle,
  type AssetBlobs,
} from "@/shared/schema/project";
import { assetKeys, decodeImage, hashBlob, MAX_TOTAL_BYTES } from "./import";
import { rasterInfo, validateDimensions } from "./raster";
import { sanitizeSvg } from "./svg";
const fileSchema = z
  .object({
    key: z.string().regex(/^[a-f0-9]{64}$/),
    type: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "font/ttf", "font/otf", "font/woff2"]),
    data: z
      .string()
      .max(14 * 1024 * 1024)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  })
  .strict();
const portableSchema = bundleSchema.safeExtend({
  files: z.array(fileSchema).max(400),
});
export async function encodeProject(bundle: ProjectBundle, blobs: AssetBlobs) {
  const valid = bundleSchema.parse(bundle);
  const files = await Promise.all(
    assetKeys(valid.assets).map(async (key) => {
      const blob = blobs[key];
      if (!blob) throw new Error("missingAsset");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { key, type: blob.type, data };
    }),
  );
  return JSON.stringify({ ...valid, files });
}
export async function decodeProject(json: string): Promise<LoadedProject> {
  if (new TextEncoder().encode(json).byteLength > MAX_PROJECT_BYTES)
    throw new Error("PROJECT_TOO_LARGE");
  const raw: unknown = JSON.parse(json);
  if (typeof raw !== "object" || raw === null || !("files" in raw)) {
    const bundle = deserializeProject(json);
    if (assetKeys(bundle.assets).length) throw new Error("missingAsset");
    return { bundle, blobs: {} };
  }
  const parsed = portableSchema.parse(raw);
  const { files, ...bundle } = parsed;
  const blobs: AssetBlobs = {};
  let total = 0;
  for (const entry of files) {
    if (blobs[entry.key]) throw new Error("Duplicate blob");
    const bytes = Uint8Array.from(atob(entry.data), (c) => c.charCodeAt(0));
    total += bytes.byteLength;
    if (total > MAX_TOTAL_BYTES) throw new Error("projectTooLarge");
    const blob = new Blob([bytes], { type: entry.type });
    if ((await hashBlob(blob)) !== entry.key)
      throw new Error("Invalid checksum");
    blobs[entry.key] = blob;
  }
  for (const key of assetKeys(bundle.assets))
    if (!blobs[key]) throw new Error("missingAsset");
  if (Object.keys(blobs).length !== assetKeys(bundle.assets).length)
    throw new Error("Unexpected asset payload");
  for (const asset of bundle.assets) {
    if (asset.kind === "imported-font") {
      const blob = blobs[asset.blobKey];
      if (!blob || blob.size !== asset.byteLength || blob.type !== asset.mimeType) throw new Error("Invalid font asset");
      continue;
    }
    if (asset.kind !== "imported-image") continue;
    const original = blobs[asset.originalKey],
      render = blobs[asset.renderKey];
    if (
      original.size !== asset.byteLength ||
      original.type !== asset.mimeType ||
      render.type !== asset.mimeType
    )
      throw new Error("Invalid asset metadata");
    if (asset.mimeType === "image/svg+xml") {
      const safe = sanitizeSvg(await original.text());
      if (
        !asset.sanitized ||
        (await hashBlob(new Blob([safe.svg], { type: asset.mimeType }))) !==
          asset.renderKey
      )
        throw new Error("Invalid SVG derivative");
    } else {
      const header = rasterInfo(new Uint8Array(await original.arrayBuffer()));
      validateDimensions(header.width, header.height);
      if (
        header.mimeType !== asset.mimeType ||
        asset.renderKey !== asset.originalKey
      )
        throw new Error("Invalid raster");
    }
    const size = await decodeImage(render);
    if (size.width !== asset.width || size.height !== asset.height)
      throw new Error("Invalid dimensions");
  }
  return { bundle, blobs };
}
