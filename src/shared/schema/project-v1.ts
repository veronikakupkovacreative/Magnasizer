import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;
export const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const geometrySchema = z
  .object({
    x: z.number().finite().min(-16000).max(16000),
    y: z.number().finite().min(-16000).max(16000),
    width: z.number().finite().min(8).max(8192),
    height: z.number().finite().min(8).max(8192),
    rotation: z.number().finite().min(-360).max(360),
  })
  .strict();
const common = {
  id,
  sourceId: id,
  name: z.string().trim().min(1).max(100),
  geometry: geometrySchema,
  zIndex: z.number().int().min(0),
  role: z.enum([
    "background",
    "headline",
    "body",
    "product",
    "logo",
    "cta",
    "decoration",
  ]),
  priority: z.number().int().min(0).max(100),
  anchor: z.enum(["top-left", "center", "bottom-right"]),
  constraints: z
    .object({
      preserveAspectRatio: z.boolean(),
      minWidth: z.number().min(8).max(8192),
      minHeight: z.number().min(8).max(8192),
    })
    .strict(),
  locked: z.boolean(),
};
export const layerSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...common,
      type: z.literal("text"),
      text: z.string().max(4000),
      style: z
        .object({
          fill: color,
          fontFamily: z.literal("Inter Variable"),
          fontSize: z.number().min(8).max(300),
          fontWeight: z.enum(["400", "600", "700"]),
          align: z.enum(["left", "center", "right"]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("shape"),
      style: z
        .object({ fill: color, radius: z.number().min(0).max(1000) })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("image"),
      assetId: id,
      style: z.object({ opacity: z.number().min(0).max(1) }).strict(),
    })
    .strict(),
]);
export const documentSchema = z
  .object({
    id,
    width: z.number().int().min(64).max(8192),
    height: z.number().int().min(64).max(8192),
    background: color,
    layers: z.array(layerSchema).max(200),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    doc.layers.forEach((layer, index) => {
      if (
        layer.geometry.width < layer.constraints.minWidth ||
        layer.geometry.height < layer.constraints.minHeight
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["layers", index, "geometry"],
          message: "Layer dimensions violate minimum constraints",
        });
      }
      if (ids.has(layer.id))
        ctx.addIssue({
          code: "custom",
          path: ["layers", index, "id"],
          message: "Duplicate layer ID",
        });
      ids.add(layer.id);
      if (layer.zIndex !== index)
        ctx.addIssue({
          code: "custom",
          path: ["layers", index, "zIndex"],
          message: "Layer order must be canonical",
        });
      if (layer.type === "image" && !layer.constraints.preserveAspectRatio)
        ctx.addIssue({
          code: "custom",
          message: "Image aspect ratio must be protected",
        });
    });
  });
export const projectSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id,
    name: z.string().trim().min(1).max(100),
    owner: z.literal("local"),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    document: documentSchema,
  })
  .strict();
// The only Phase 0 asset is immutable and bundled. Arbitrary URLs, SVG markup,
// binary data and remote resources are intentionally rejected at this boundary.
export const assetSchema = z
  .object({
    id,
    kind: z.literal("bundled-image"),
    src: z.literal("/assets/form-bottle.svg"),
    mimeType: z.literal("image/svg+xml"),
    width: z.literal(360),
    height: z.literal(520),
  })
  .strict();
export const bundleSchema = z
  .object({
    format: z.literal("smart-resize-studio"),
    version: z.literal(1),
    project: projectSchema,
    assets: z.array(assetSchema).max(20),
  })
  .strict()
  .superRefine(({ project, assets }, ctx) => {
    if (new Set(assets.map((a) => a.id)).size !== assets.length)
      ctx.addIssue({ code: "custom", message: "Duplicate asset ID" });
    for (const layer of project.document.layers) {
      if (layer.type !== "image") continue;
      const asset = assets.find((a) => a.id === layer.assetId);
      if (!asset)
        ctx.addIssue({ code: "custom", message: "Missing asset reference" });
      else if (
        Math.abs(
          layer.geometry.width / layer.geometry.height -
            asset.width / asset.height,
        ) > 0.005
      )
        ctx.addIssue({
          code: "custom",
          message: "Image proportions are invalid",
        });
    }
  });
export type Geometry = z.infer<typeof geometrySchema>;
export type Layer = z.infer<typeof layerSchema>;
export type StudioDocument = z.infer<typeof documentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type ProjectBundle = z.infer<typeof bundleSchema>;

// Explicit version dispatch: introduce migrations here when a real v2 exists.
// Unknown versions fail closed rather than dropping data.
export function deserializeProject(json: string): ProjectBundle {
  if (new TextEncoder().encode(json).byteLength > MAX_PROJECT_BYTES)
    throw new Error("PROJECT_TOO_LARGE");
  const value: unknown = JSON.parse(json);
  return bundleSchema.parse(value);
}
export function serializeProject(bundle: ProjectBundle): string {
  return JSON.stringify(bundleSchema.parse(bundle), null, 2);
}
