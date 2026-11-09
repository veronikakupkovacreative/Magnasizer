import { z } from "zod";
import * as legacy from "./project-v1";

export const SCHEMA_VERSION = 2 as const;
export const MAX_PROJECT_BYTES = 64 * 1024 * 1024;
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
  groupId: id.optional(),
  groupName: z.string().trim().min(1).max(100).optional(),
  colorStyleId: id.optional(),
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
  visible: z.boolean(),
  layout: z
    .object({
      sizing: z.enum(["fixed", "scale", "fill"]),
      mandatory: z.boolean(),
      padding: z.number().min(0).max(512),
    })
    .strict(),
};
export const cropSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0.001).max(1),
    height: z.number().min(0.001).max(1),
  })
  .strict()
  .refine(
    (c) => c.x + c.width <= 1.0000001 && c.y + c.height <= 1.0000001,
    "Crop exceeds image bounds",
  );
export const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 } as const;
export type Crop = z.infer<typeof cropSchema>;
export const layerSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...common,
      type: z.literal("text"),
      text: z.string().max(4000),
      textStyleId: id.optional(),
      style: z
        .object({
          fill: color,
          fontFamily: z.string().trim().min(1).max(120),
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
      crop: cropSchema,
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
    backgroundStyleId: id.optional(),
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

export const safeZoneSchema = z
  .object({
    top: z.number().int().min(0).max(4096),
    right: z.number().int().min(0).max(4096),
    bottom: z.number().int().min(0).max(4096),
    left: z.number().int().min(0).max(4096),
  })
  .strict();
export const flatImageSettingsSchema = z.object({
  sourceLayerId: id,
  fitMode: z.enum(["contain", "cover", "smart"]),
  focalX: z.number().finite().min(0).max(1),
  focalY: z.number().finite().min(0).max(1),
  protectedArea: z.number().finite().min(0.1).max(1),
}).strict();
export type FlatImageSettings = z.infer<typeof flatImageSettingsSchema>;

export const variantSchema = z
  .object({
    id,
    presetId: z.string().min(1).max(100),
    presetVersion: z.number().int().min(1).max(1000),
    platform: z.enum(["meta", "pmax", "gdn", "custom"]),
    name: z.string().trim().min(1).max(100),
    status: z.enum(["synced", "customized"]),
    strategy: z.enum(["landscape", "square", "portrait", "compact"]),
    composition: z.enum(["auto", "balanced", "product", "text"]).optional(),
    flatImage: flatImageSettingsSchema.optional(),
    safeZone: safeZoneSchema,
    document: documentSchema,
  })
  .strict();

export const brandKitSchema = z.object({
  colors: z.array(z.object({ id, name: z.string().trim().min(1).max(60), value: color }).strict()).max(60),
  textStyles: z.array(z.object({
    id, name: z.string().trim().min(1).max(60),
    fontFamily: z.string().trim().min(1).max(120),
    fontSize: z.number().min(8).max(300),
    fontWeight: z.enum(["400", "600", "700"]),
    align: z.enum(["left", "center", "right"]),
  }).strict()).max(40),
}).strict();
export const projectSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id,
    name: z.string().trim().min(1).max(100),
    owner: z.literal("local"),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    document: documentSchema,
    variants: z.array(variantSchema).max(40).default([]),
    brandKit: brandKitSchema.optional(),
    flatImage: flatImageSettingsSchema.optional(),
    workspacePositions: z.record(id, z.object({ x: z.number().finite().min(0).max(16000), y: z.number().finite().min(0).max(16000) }).strict()).optional(),
  })
  .strict();
export const assetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id,
      kind: z.literal("bundled-image"),
      src: z.literal("/assets/form-bottle.svg"),
      mimeType: z.literal("image/svg+xml"),
      width: z.literal(360),
      height: z.literal(520),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("imported-font"),
      name: z.string().trim().min(1).max(200),
      fontFamily: z.string().trim().min(1).max(120),
      mimeType: z.enum(["font/ttf", "font/otf", "font/woff2"]),
      byteLength: z.number().int().min(1).max(5 * 1024 * 1024),
      blobKey: z.string().regex(/^[a-f0-9]{64}$/),
    }).strict(),
  z
    .object({
      id,
      kind: z.literal("imported-image"),
      name: z.string().min(1).max(200),
      mimeType: z.enum([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
      ]),
      width: z.number().int().min(1).max(8192),
      height: z.number().int().min(1).max(8192),
      byteLength: z
        .number()
        .int()
        .min(1)
        .max(10 * 1024 * 1024),
      originalKey: z.string().regex(/^[a-f0-9]{64}$/),
      renderKey: z.string().regex(/^[a-f0-9]{64}$/),
      sanitized: z.boolean(),
    })
    .strict(),
]);
export const bundleSchema = z
  .object({
    format: z.literal("smart-resize-studio"),
    version: z.literal(2),
    project: projectSchema,
    assets: z.array(assetSchema).max(200),
  })
  .strict()
  .superRefine(({ project, assets }, ctx) => {
    if (new Set(assets.map((a) => a.id)).size !== assets.length)
      ctx.addIssue({ code: "custom", message: "Duplicate asset ID" });
    const documents = [
      project.document,
      ...project.variants.map((variant) => variant.document),
    ];
    for (const layer of documents.flatMap((document) => document.layers)) {
      if (layer.type !== "image") continue;
      const asset = assets.find((a) => a.id === layer.assetId);
      if (!asset)
        ctx.addIssue({ code: "custom", message: "Missing asset reference" });
      else if (asset.kind === "imported-font")
        ctx.addIssue({ code: "custom", message: "Image layer references font asset" });
      else if (
        Math.abs(
          layer.geometry.width / layer.geometry.height -
            (asset.width * layer.crop.width) /
              (asset.height * layer.crop.height),
        ) > 0.005
      )
        ctx.addIssue({
          code: "custom",
          message: "Image proportions are invalid",
        });
    }
  });
export type BrandKit = z.infer<typeof brandKitSchema>;
export type Geometry = z.infer<typeof geometrySchema>;
export type Layer = z.infer<typeof layerSchema>;
export type StudioDocument = z.infer<typeof documentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type SafeZone = z.infer<typeof safeZoneSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type ProjectBundle = z.infer<typeof bundleSchema>;

export type AssetBlobs = Record<string, Blob>;
export type LoadedProject = { bundle: ProjectBundle; blobs: AssetBlobs };
export function migrateProject(value: unknown): Project {
  if (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 1
  ) {
    const old = legacy.projectSchema.parse(value);
    return projectSchema.parse({
      ...old,
      schemaVersion: 2,
      document: {
        ...old.document,
        layers: old.document.layers.map((layer) => ({
          ...layer,
          visible: true,
          layout: {
            sizing: "fixed",
            mandatory: ["logo", "headline", "product", "cta"].includes(
              layer.role,
            ),
            padding: 0,
          },
          ...(layer.type === "image" ? { crop: { ...FULL_CROP } } : {}),
        })),
      },
    });
  }
  return projectSchema.parse(value);
}
export function parseBundle(value: unknown): ProjectBundle {
  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1
  ) {
    const old = legacy.bundleSchema.parse(value);
    return bundleSchema.parse({
      ...old,
      version: 2,
      project: migrateProject(old.project),
    });
  }
  return bundleSchema.parse(value);
}
export function deserializeProject(json: string): ProjectBundle {
  if (new TextEncoder().encode(json).byteLength > MAX_PROJECT_BYTES)
    throw new Error("PROJECT_TOO_LARGE");
  return parseBundle(JSON.parse(json));
}
export function serializeProject(bundle: ProjectBundle): string {
  return JSON.stringify(bundleSchema.parse(bundle), null, 2);
}
