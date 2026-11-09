import type { Asset, AssetBlobs } from "@/shared/schema/project";
import { hashBlob } from "./import";

const FONT_EXTENSIONS = { ttf: "font/ttf", otf: "font/otf", woff2: "font/woff2" } as const;
export const FONT_ACCEPT = ".ttf,.otf,.woff2";

export async function importFontFile(file: File): Promise<{ asset: Extract<Asset, { kind: "imported-font" }>; blob: Blob }> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !(extension in FONT_EXTENSIONS)) throw new Error("unsupportedFont");
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("fontTooLarge");
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const magic = String.fromCharCode(...bytes);
  const truetype = bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0;
  if (!((extension === "otf" && (magic === "OTTO" || truetype)) ||
    (extension === "woff2" && magic === "wOF2") ||
    (extension === "ttf" && (truetype || magic === "true" || magic === "typ1")))) {
    throw new Error("invalidFont");
  }
  const mimeType = FONT_EXTENSIONS[extension as keyof typeof FONT_EXTENSIONS];
  const blob = new Blob([file], { type: mimeType });
  const blobKey = await hashBlob(blob);
  const normalized = file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N} _-]/gu, " ").trim().slice(0, 90);
  if (!normalized) throw new Error("invalidFont");
  const fontFamily = `SRS ${normalized} ${blobKey.slice(0, 6)}`;
  return {
    asset: { kind: "imported-font", id: crypto.randomUUID(), name: file.name.slice(0, 200), fontFamily, mimeType, byteLength: file.size, blobKey },
    blob,
  };
}

export async function loadProjectFonts(assets: Asset[], blobs: AssetBlobs) {
  const fontAssets = assets.filter((asset) => asset.kind === "imported-font");
  await Promise.all(fontAssets.map(async (asset) => {
    if (Array.from(document.fonts).some((face) => face.family === asset.fontFamily && face.status === "loaded")) return;
    const blob = blobs[asset.blobKey];
    if (!blob) throw new Error("missingFont");
    const face = new FontFace(asset.fontFamily, await blob.arrayBuffer());
    await face.load();
    document.fonts.add(face);
  }));
}
