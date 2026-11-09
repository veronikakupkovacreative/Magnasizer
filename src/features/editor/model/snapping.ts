import type { Geometry, Layer, StudioDocument } from "@/shared/schema/project";
export type Bounds = { x: number; y: number; width: number; height: number };
export type Guide = { axis: "x" | "y"; value: number };
export function layerBounds(g: Geometry): Bounds {
  const r = (g.rotation * Math.PI) / 180;
  const pts = [
    [0, 0],
    [g.width, 0],
    [0, g.height],
    [g.width, g.height],
  ].map(([x, y]) => ({
    x: g.x + x * Math.cos(r) - y * Math.sin(r),
    y: g.y + x * Math.sin(r) + y * Math.cos(r),
  }));
  const x = Math.min(...pts.map((p) => p.x)),
    y = Math.min(...pts.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...pts.map((p) => p.x)) - x,
    height: Math.max(...pts.map((p) => p.y)) - y,
  };
}
export function unionBounds(layers: Layer[]): Bounds {
  const b = layers.map((l) => layerBounds(l.geometry));
  if (!b.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...b.map((a) => a.x)),
    y = Math.min(...b.map((a) => a.y));
  return {
    x,
    y,
    width: Math.max(...b.map((a) => a.x + a.width)) - x,
    height: Math.max(...b.map((a) => a.y + a.height)) - y,
  };
}
export function snapMove(
  doc: StudioDocument,
  ids: string[],
  dx: number,
  dy: number,
  zoom: number,
): { dx: number; dy: number; guides: Guide[] } {
  const selected = doc.layers.filter(
    (l) => ids.includes(l.id) && !l.locked && l.visible,
  );
  if (!selected.length) return { dx, dy, guides: [] };
  const box = unionBounds(selected),
    others = doc.layers
      .filter((l) => !ids.includes(l.id) && l.visible)
      .map((l) => layerBounds(l.geometry));
  const guides: Guide[] = [];
  for (const axis of ["x", "y"] as const) {
    const length = axis === "x" ? "width" : "height",
      delta = axis === "x" ? dx : dy;
    const edges = [
      box[axis],
      box[axis] + box[length] / 2,
      box[axis] + box[length],
    ].map((n) => n + delta);
    const targets = [
      0,
      doc[length] / 2,
      doc[length],
      ...others.flatMap((b) => [
        b[axis],
        b[axis] + b[length] / 2,
        b[axis] + b[length],
      ]),
    ];
    let best: { distance: number; target: number } | null = null;
    for (const target of targets)
      for (const edge of edges) {
        const distance = target - edge;
        if (
          Math.abs(distance) <= 6 / zoom &&
          (!best || Math.abs(distance) < Math.abs(best.distance))
        )
          best = { distance, target };
      }
    if (best) {
      if (axis === "x") dx += best.distance;
      else dy += best.distance;
      guides.push({ axis, value: best.target });
    }
  }
  return { dx, dy, guides };
}
export function intersects(a: Bounds, b: Bounds) {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}
