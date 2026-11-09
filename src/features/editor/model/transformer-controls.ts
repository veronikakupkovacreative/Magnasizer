/** When the whole campaign is visible, resize grips would obscure tiny artboards.
 * At overview zoom we render a one-pixel, non-interactive selection outline
 * instead of Konva Transformer anchors. Users can still select/drag layers.
 */
export const MIN_TRANSFORM_ZOOM = 0.4;

export type TransformControlsMode = "none" | "outline" | "handles";

export function transformControlsMode(
  zoom: number,
  selectedCount: number,
  editing: boolean,
): TransformControlsMode {
  if (editing || selectedCount === 0) return "none";
  return zoom < MIN_TRANSFORM_ZOOM ? "outline" : "handles";
}

/** Target handle diameter in on-screen CSS pixels at detailed zoom. */
export function transformHandlePixels(zoom: number): number {
  return Math.min(6, Math.max(3, zoom * 20));
}

export function transformerCornerOnly(zoom: number, constrained: boolean): boolean {
  return zoom < 0.55 || constrained;
}
