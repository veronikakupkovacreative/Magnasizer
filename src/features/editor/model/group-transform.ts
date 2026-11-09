import type { Geometry, Layer } from "@/shared/schema/project";
import { clamp, resizeGeometry } from "./geometry";

/** All group members are transformed from the same unchanged geometry snapshot. */
export function translateGroup(
  layers: Layer[],
  dx: number,
  dy: number,
): Layer[] {
  return layers.map((layer) => ({
    ...layer,
    geometry: {
      ...layer.geometry,
      x: clamp(layer.geometry.x + dx, -16000, 16000),
      y: clamp(layer.geometry.y + dy, -16000, 16000),
    },
  }));
}

/** Commit the Konva transform as real geometry instead of storing stretched node scales. */
export function commitGroupTransform(
  layer: Layer,
  position: { x: number; y: number; width: number; height: number },
  groupTransform: boolean,
): Layer {
  const old = layer.geometry;
  const scaleX = position.width / old.width;
  const scaleY = position.height / old.height;
  const next: Geometry = resizeGeometry(layer, position.width, position.height);
  next.x = clamp(position.x, -16000, 16000);
  next.y = clamp(position.y, -16000, 16000);
  if (layer.type === "text" && groupTransform) {
    // A group transform scales typography uniformly; glyphs never stretch.
    const uniformScale = Math.max(0.01, Math.sqrt(Math.abs(scaleX * scaleY)));
    return {
      ...layer,
      geometry: next,
      style: {
        ...layer.style,
        fontSize: clamp(layer.style.fontSize * uniformScale, 8, 300),
      },
    };
  }
  return { ...layer, geometry: next };
}

export function selectedGroupBounds(layers: Layer[]): { x: number; y: number; width: number; height: number } | null {
  if (layers.length < 2 || !layers[0].groupId || !layers.every((item) => item.groupId === layers[0].groupId)) return null;
  const x = Math.min(...layers.map((item) => item.geometry.x));
  const y = Math.min(...layers.map((item) => item.geometry.y));
  return {
    x,
    y,
    width: Math.max(...layers.map((item) => item.geometry.x + item.geometry.width)) - x,
    height: Math.max(...layers.map((item) => item.geometry.y + item.geometry.height)) - y,
  };
}
