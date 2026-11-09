import { cropSchema, type Crop, type Layer } from "@/shared/schema/project";
import { clamp } from "./geometry";
export function constrainCrop(crop: Crop, minW = 0.001, minH = 0.001): Crop {
  const width = clamp(crop.width, minW, 1),
    height = clamp(crop.height, minH, 1);
  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}
/** Change only the visible source window. The original source scale stays exact. */
export function cropImageLayer(
  layer: Extract<Layer, { type: "image" }>,
  next: Crop,
): Layer {
  const crop = cropSchema.parse(next);
  const { geometry: g, crop: old } = layer;
  const sx = g.width / old.width,
    sy = g.height / old.height;
  const width = sx * crop.width,
    height = sy * crop.height;
  if (
    width < layer.constraints.minWidth ||
    height < layer.constraints.minHeight ||
    width > 8192 ||
    height > 8192
  )
    return layer;
  const angle = (g.rotation * Math.PI) / 180;
  const dx = sx * (crop.x - old.x),
    dy = sy * (crop.y - old.y);
  return {
    ...layer,
    crop,
    geometry: {
      ...g,
      width,
      height,
      x: clamp(
        g.x + dx * Math.cos(angle) - dy * Math.sin(angle),
        -16000,
        16000,
      ),
      y: clamp(
        g.y + dx * Math.sin(angle) + dy * Math.cos(angle),
        -16000,
        16000,
      ),
    },
  };
}
