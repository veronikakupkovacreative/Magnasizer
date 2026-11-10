/** Local-only interchange format shared with the MAGNASIZER Figma development plugin.
 * No remote Figma API, access token or server is required.
 */
import { z } from "zod";
import { createProject } from "@/features/projects/demo";
import { importImage, MAX_TOTAL_BYTES } from "@/features/assets/import";
import { bundleSchema, type AssetBlobs, type Layer } from "@/shared/schema/project";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const geometry = {
  name: z.string().min(1).max(100),
  x: z.number().finite().min(-16000).max(16000),
  y: z.number().finite().min(-16000).max(16000),
  width: z.number().finite().min(8).max(8192),
  height: z.number().finite().min(8).max(8192),
  rotation: z.number().finite().min(-360).max(360).default(0),
  group: z.string().max(160).optional(),
  groupId: z.string().min(1).max(160).optional(),
};
const figmaNodeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), ...geometry, text: z.string().max(4000),
    fill: color, fontFamily: z.string().min(1).max(120), fontSize: z.number().min(8).max(300),
    fontWeight: z.enum(["400", "600", "700"]), align: z.enum(["left", "center", "right"]),
  }).strict(),
  z.object({ type: z.literal("shape"), ...geometry, fill: color,
    radius: z.number().min(0).max(1000).default(0),
  }).strict(),
  z.object({ type: z.literal("image"), ...geometry, contentRole: z.literal("text").optional(), pngBase64: z.string().min(32).max(14_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  }).strict(),
]);
export const figmaTransferSchema = z.object({
  source: z.literal("magnasizer-figma"),
  version: z.literal(1),
  name: z.string().min(1).max(100),
  width: z.number().int().min(64).max(8192),
  height: z.number().int().min(64).max(8192),
  background: color,
  nodes: z.array(figmaNodeSchema).min(1).max(180),
  warnings: z.array(z.string().max(300)).max(100).optional(),
}).strict();
export type FigmaTransfer = z.infer<typeof figmaTransferSchema>;
export const FIGMA_TRANSFER_MAX_CHARS = 24 * 1024 * 1024;

export function parseFigmaTransfer(json: string): FigmaTransfer {
  if (json.length > FIGMA_TRANSFER_MAX_CHARS) throw new Error("figmaTransferTooLarge");
  try {
    return figmaTransferSchema.parse(JSON.parse(json));
  } catch (error) {
    if (error instanceof Error && error.message === "figmaTransferTooLarge") throw error;
    throw new Error("figmaTransferInvalid");
  }
}

function deriveRole(name: string, type: "text" | "shape" | "image") {
  const lower = name.toLowerCase();
  if (/logo|wordmark|brand/.test(lower)) return "logo" as const;
  if (/cta|button|action/.test(lower)) return "cta" as const;
  if (/headline|heading|title|\bh1\b/.test(lower) && type === "text") return "headline" as const;
  if (/body|subtitle|description|paragraph/.test(lower) && type === "text") return "body" as const;
  if (type === "image") return "product" as const;
  return "decoration" as const;
}

/** Convert Figma's serialized frame to native editable text/shape and image layers.
 * The existing project serializer and asset store remain the authority for persistence. */
export async function createProjectFromFigma(transfer: FigmaTransfer) {
  const bundle = createProject(false);
  bundle.project.name = transfer.name;
  bundle.project.document.width = transfer.width;
  bundle.project.document.height = transfer.height;
  bundle.project.document.background = transfer.background;
  const document = bundle.project.document;
  const blobs: AssetBlobs = {};
  const groups = new Map<string, string>();
  const warnings = [...(transfer.warnings ?? [])];
  for (const source of transfer.nodes) {
    if (document.layers.length >= 180) throw new Error("figmaTransferTooLarge");
    const id = crypto.randomUUID();
    // Group labels may repeat in Figma; use the stable source node ID as identity.
    const groupKey = source.groupId ?? source.group;
    if (groupKey && !groups.has(groupKey)) groups.set(groupKey, crypto.randomUUID());
    const groupId = groupKey ? groups.get(groupKey) : undefined;
    const importedText = source.type === "text" || (source.type === "image" && source.contentRole === "text");
    const role = importedText
      ? (/headline|heading|title|\\bh1\\b/i.test(source.name) ? "headline" as const : "body" as const)
      : deriveRole(source.name, source.type);
    const base = {
      id, sourceId: id, name: source.name,
      ...(groupId ? { groupId, groupName: source.group?.slice(0, 100) } : {}),
      geometry: { x: source.x, y: source.y, width: source.width, height: source.height, rotation: source.rotation },
      zIndex: document.layers.length,
      role,
      priority: importedText || /headline|product|logo|cta/i.test(source.name) ? 90 : 50,
      anchor: "top-left" as const,
      constraints: { preserveAspectRatio: source.type === "image", minWidth: 8, minHeight: 8 },
      locked: false, visible: true,
      layout: { sizing: source.type === "image" ? "scale" as const : "fixed" as const,
        // Preserve all imported layers. A compact resize may need manual tuning,
        // but it must never silently hide approved copy or frame elements.
        mandatory: true, padding: 0 },
    };
    let layer: Layer;
    if (source.type === "text") {
      layer = { ...base, type: "text", text: source.text,
        style: { fill: source.fill, fontFamily: source.fontFamily, fontSize: source.fontSize,
          fontWeight: source.fontWeight, align: source.align } };
    } else if (source.type === "shape") {
      layer = { ...base, type: "shape", style: { fill: source.fill, radius: source.radius } };
    } else {
      // File API is only used on user-supplied bytes and validates PNG magic, dimensions and size.
      const bytes = Uint8Array.from(atob(source.pngBase64), (char) => char.charCodeAt(0));
      const imported = await importImage(new File([bytes], `${source.name.replace(/[^a-z0-9_-]/gi, "-")}.png`, { type: "image/png" }));
      bundle.assets.push(imported.asset);
      Object.assign(blobs, imported.blobs);
      const ratio = imported.asset.width / imported.asset.height;
      const desiredRatio = source.width / source.height;
      const width = source.width;
      const height = width / ratio;
      if (Math.abs(ratio - desiredRatio) > 0.015) warnings.push(`Raster bounds adjusted: ${source.name}`);
      layer = { ...base, type: "image", assetId: imported.asset.id,
        geometry: { ...base.geometry, y: source.y + (source.height - height) / 2, width, height },
        crop: { x: 0, y: 0, width: 1, height: 1 }, style: { opacity: 1 },
        role,
      };
    }
    document.layers.push(layer);
  }
  // A flattened Figma frame is a finished advertising creative, not a product
  // isolated from its design. Reuse the fully tested flat-JPG/PNG resize flow.
  if (document.layers.length === 1) {
    const only = document.layers[0];
    if (only.type === "image" && Math.abs(only.geometry.x) <= 2 &&
      Math.abs(only.geometry.y) <= 2 &&
      Math.abs(only.geometry.width - document.width) <= 2 &&
      Math.abs(only.geometry.height - document.height) <= 2) {
      only.role = "background";
      only.priority = 100;
      only.layout = { sizing: "fill", mandatory: true, padding: 0 };
      bundle.project.flatImage = {
        sourceLayerId: only.id, fitMode: "smart", focalX: 0.5, focalY: 0.5, protectedArea: 0.5,
      };
    }
  }
  if (Object.values(blobs).reduce((total, blob) => total + blob.size, 0) > MAX_TOTAL_BYTES)
    throw new Error("figmaTransferTooLarge");
  return { bundle: bundleSchema.parse(bundle), blobs, warnings };
}
