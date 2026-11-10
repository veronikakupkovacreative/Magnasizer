import type { Geometry, Layer } from "@/shared/schema/project";
export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export function resizeGeometry(
  layer: Layer,
  width: number,
  height: number,
  axis: "width" | "height" = "width",
): Geometry {
  const old = layer.geometry;
  let w = clamp(width, layer.constraints.minWidth, 8192);
  let h = clamp(height, layer.constraints.minHeight, 8192);
  if (layer.constraints.preserveAspectRatio) {
    const ratio = old.width / old.height;
    const minW = Math.max(
      layer.constraints.minWidth,
      layer.constraints.minHeight * ratio,
    );
    const maxW = Math.min(8192, 8192 * ratio);
    w = clamp(axis === "height" ? h * ratio : w, minW, maxW);
    h = w / ratio;
  }
  return { ...old, width: w, height: h };
}
/** A Konva object's actual bounds after rotation around its top-left origin. */
export function rotatedBounds(g: Geometry) {
  const angle = g.rotation * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const xs = [g.x, g.x + g.width * c, g.x - g.height * s, g.x + g.width * c - g.height * s];
  const ys = [g.y, g.y + g.width * s, g.y + g.height * c, g.y + g.width * s + g.height * c];
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

export function fitZoom(
  document: { width: number; height: number },
  viewport: { width: number; height: number },
): number {
  return clamp(
    Math.min(
      (viewport.width - 96) / document.width,
      (viewport.height - 140) / document.height,
      1,
    ),
    0.1,
    2,
  );
}
