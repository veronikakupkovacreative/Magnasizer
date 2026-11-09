"use client";
import Konva from "konva";
import type { Asset, AssetBlobs, StudioDocument } from "@/shared/schema/project";
import { loadProjectFonts } from "@/features/assets/fonts";

export type ExportFormat = "png" | "jpeg" | "webp";
const MIME_TYPES: Record<ExportFormat, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

async function imageResources(assets: Asset[], blobs: AssetBlobs): Promise<{ map: Record<string, HTMLImageElement>; cleanup(): void }> {
  const urls: string[] = [];
  try {
    const pairs = await Promise.all(assets.filter(a => a.kind !== "imported-font").map(async (asset) => {
      const source = asset.kind === "bundled-image" ? asset.src : (() => {
        const blob = blobs[asset.renderKey];
        if (!blob) throw new Error("missingAsset");
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return url;
      })();
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("assetDecodeError"));
        img.src = source;
      });
      return [asset.id, image] as const;
    }));
    return { map: Object.fromEntries(pairs), cleanup: () => urls.forEach(URL.revokeObjectURL) };
  } catch (error) {
    urls.forEach(URL.revokeObjectURL);
    throw error;
  }
}
export async function renderDocuments(
  documents: { document: StudioDocument; name: string; key: string }[],
  assets: Asset[], blobs: AssetBlobs, format: ExportFormat,
  onProgress?: (done: number, total: number) => void,
  previewMaxEdge?: number,
): Promise<{ name: string; bytes: Uint8Array<ArrayBuffer> }[]> {
  await document.fonts.ready;
  await loadProjectFonts(assets, blobs);
  const res = await imageResources(assets, blobs);
  const mimeType = MIME_TYPES[format];
  const output: { name: string; bytes: Uint8Array<ArrayBuffer> }[] = [];
  try {
    for (const [index, item] of documents.entries()) {
      const doc = item.document;
      // Preview thumbnails use the exact export renderer, but a bounded canvas.
      // Production exports never pass previewMaxEdge and remain at native resolution.
      const previewScale = previewMaxEdge && previewMaxEdge > 0
        ? Math.min(1, previewMaxEdge / Math.max(doc.width, doc.height))
        : 1;
      const stage = new Konva.Stage({ container: document.createElement("div"),
        width: Math.max(1, Math.round(doc.width * previewScale)),
        height: Math.max(1, Math.round(doc.height * previewScale)), listening: false });
      try {
        const layer = new Konva.Layer({ listening: false });
        layer.scale({ x: previewScale, y: previewScale });
        stage.add(layer);
        layer.add(new Konva.Rect({ x: 0, y: 0, width: doc.width, height: doc.height, fill: doc.background, listening: false }));
        for (const item of doc.layers) {
          if (!item.visible) continue;
          const geometry = item.geometry;
          if (item.type === "shape") {
            layer.add(new Konva.Rect({ ...geometry, fill: item.style.fill, cornerRadius: item.style.radius, listening: false }));
          } else if (item.type === "text") {
            layer.add(new Konva.Text({ ...geometry, text: item.text, fill: item.style.fill, fontFamily: item.style.fontFamily,
              fontSize: item.style.fontSize, fontStyle: item.style.fontWeight, align: item.style.align,
              lineHeight: 1.1, wrap: "word", listening: false }));
          } else {
            const image = res.map[item.assetId];
            if (!image) throw new Error("missingAsset");
            layer.add(new Konva.Image({ ...geometry, image, opacity: item.style.opacity, listening: false,
              crop: { x: item.crop.x * image.naturalWidth, y: item.crop.y * image.naturalHeight,
                width: item.crop.width * image.naturalWidth, height: item.crop.height * image.naturalHeight } }));
          }
        }
        layer.draw();
        const dataUrl = stage.toDataURL({ mimeType, quality: format === "jpeg" || format === "webp" ? .92 : undefined, pixelRatio: 1 });
        if (!dataUrl.startsWith(`data:${mimeType};`)) throw new Error("exportUnsupportedFormat");
        const binary = atob(dataUrl.split(",")[1]);
        const bytes = new Uint8Array(binary.length);
        for (let n = 0; n < binary.length; n++) bytes[n] = binary.charCodeAt(n);
        const filename = `${String(index + 1).padStart(2, "0")}-${item.name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70)}-${doc.width}x${doc.height}.${format === "jpeg" ? "jpg" : format}`;
        output.push({ name: filename, bytes });
        onProgress?.(index + 1, documents.length);
      } finally {
        stage.destroy();
      }
    }
    return output;
  } finally {
    res.cleanup();
  }
}
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
