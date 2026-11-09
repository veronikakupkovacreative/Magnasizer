import type { Geometry, Layer, StudioDocument, FlatImageSettings } from "@/shared/schema/project";

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
type ImageLayer = Extract<Layer, { type: "image" }>;
export type FlatImageOutcome = "contain" | "cover";

/** A flat master must be a single, unrotated image layer.
 * Other artwork continues through the existing layer-aware resize engine. */
export function flatSource(master: StudioDocument, settings?: FlatImageSettings): ImageLayer | null {
  if (!settings || master.layers.length !== 1) return null;
  const layer = master.layers[0];
  return layer.type === "image" && layer.id === settings.sourceLayerId && layer.visible && layer.geometry.rotation === 0
    ? layer : null;
}

/** Keep the source image binary intact. Changing mode never modifies the master. */
export function flatPlan(master: StudioDocument, width: number, height: number, settings: FlatImageSettings): {
  document: StudioDocument;
  outcome: FlatImageOutcome;
  croppedFraction: number;
} {
  const source = flatSource(master, settings);
  if (!source) throw new Error("flatSourceMissing");
  const original = source.crop;
  const ratio = source.geometry.width / source.geometry.height;
  const targetRatio = width / height;
  const crop = { ...original };
  if (targetRatio > ratio) crop.height = original.height * ratio / targetRatio;
  else crop.width = original.width * targetRatio / ratio;

  // Coordinates are normalized against the original image, not the artboard.
  const centerX = original.x + settings.focalX * original.width;
  const centerY = original.y + settings.focalY * original.height;
  const desiredX = clamp(centerX - crop.width / 2, original.x, original.x + original.width - crop.width);
  const desiredY = clamp(centerY - crop.height / 2, original.y, original.y + original.height - crop.height);
  crop.x = desiredX;
  crop.y = desiredY;

  // The protected region is a configurable square around the focal point.
  // Smart fit only crops when this entire region can remain visible.
  const protectedW = original.width * settings.protectedArea;
  const protectedH = original.height * settings.protectedArea;
  const protectedLeft = clamp(centerX - protectedW / 2, original.x, original.x + original.width - protectedW);
  const protectedTop = clamp(centerY - protectedH / 2, original.y, original.y + original.height - protectedH);
  const roomXMin = Math.max(original.x, protectedLeft + protectedW - crop.width);
  const roomXMax = Math.min(original.x + original.width - crop.width, protectedLeft);
  const roomYMin = Math.max(original.y, protectedTop + protectedH - crop.height);
  const roomYMax = Math.min(original.y + original.height - crop.height, protectedTop);
  const protectedFits = roomXMin <= roomXMax + 1e-9 && roomYMin <= roomYMax + 1e-9;
  if (settings.fitMode === "smart" && protectedFits) {
    crop.x = clamp(desiredX, roomXMin, roomXMax);
    crop.y = clamp(desiredY, roomYMin, roomYMax);
  }

  const outcome: FlatImageOutcome = settings.fitMode === "contain" || (settings.fitMode === "smart" && !protectedFits) ? "contain" : "cover";
  let geometry: Geometry;
  let finalCrop = crop;
  if (outcome === "contain") {
    finalCrop = { ...original };
    const scale = Math.min(width / source.geometry.width, height / source.geometry.height);
    const fittedWidth = source.geometry.width * scale;
    const fittedHeight = source.geometry.height * scale;
    geometry = {
      x: (width - fittedWidth) / 2,
      y: (height - fittedHeight) / 2,
      width: fittedWidth,
      height: fittedHeight,
      rotation: 0,
    };
  } else {
    geometry = { x: 0, y: 0, width, height, rotation: 0 };
  }
  const image: ImageLayer = {
    ...source,
    role: "background",
    geometry,
    crop: finalCrop,
    layout: { ...source.layout, sizing: outcome === "cover" ? "fill" : "scale" },
    zIndex: 0,
  };
  return {
    document: {
      id: crypto.randomUUID(),
      width,
      height,
      background: master.background,
      backgroundStyleId: master.backgroundStyleId,
      layers: [image],
    },
    outcome,
    croppedFraction: outcome === "contain" ? 0 : 1 - crop.width * crop.height / (original.width * original.height),
  };
}
