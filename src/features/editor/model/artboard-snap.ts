import type { WorkspaceBoard } from "./workspace-layout";

/** Snap a moving artboard's outer edges and center to neighbouring frames.
 * Threshold is expressed in screen pixels, so the feel is independent of zoom.
 */
export function snapArtboardPosition(
  moving: Pick<WorkspaceBoard, "key" | "document">,
  position: { x: number; y: number },
  others: WorkspaceBoard[], zoom: number, enabled: boolean,
  thresholdPixels = 9,
) {
  if (!enabled) return { x: position.x, y: position.y };
  const tolerance = thresholdPixels / Math.max(.04, zoom);
  const choose = (axis: "x" | "y") => {
    const extent = axis === "x" ? "width" : "height";
    const start = position[axis];
    const length = moving.document[extent];
    const anchors = [start, start + length / 2, start + length];
    let best = 0, distance = tolerance;
    for (const other of others) {
      if (other.key === moving.key) continue;
      const edge = other[axis], size = other.document[extent];
      for (const from of anchors) for (const to of [edge, edge + size / 2, edge + size]) {
        const diff = to - from;
        if (Math.abs(diff) < distance) { best = diff; distance = Math.abs(diff); }
      }
    }
    return start + best;
  };
  return { x: Math.max(0, choose("x")), y: Math.max(0, choose("y")) };
}
