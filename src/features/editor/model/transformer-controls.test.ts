import { describe, expect, it } from "vitest";
import {
  MIN_TRANSFORM_ZOOM, transformControlsMode, transformHandlePixels, transformerCornerOnly,
} from "./transformer-controls";

describe("workspace transformer controls", () => {
  it("uses only an outline in the zoomed-out campaign overview", () => {
    expect(transformControlsMode(0.04, 1, false)).toBe("outline");
    expect(transformControlsMode(0.12, 1, false)).toBe("outline");
    expect(transformControlsMode(0.24, 3, false)).toBe("outline");
    expect(transformControlsMode(MIN_TRANSFORM_ZOOM - 0.001, 1, false)).toBe("outline");
  });
  it("only offers resize grips at a usable artboard zoom", () => {
    expect(transformControlsMode(MIN_TRANSFORM_ZOOM, 1, false)).toBe("handles");
    expect(transformControlsMode(1, 1, false)).toBe("handles");
    expect(transformControlsMode(2, 2, false)).toBe("handles");
  });
  it("does not show a selection overlay during editing or without selection", () => {
    expect(transformControlsMode(0.12, 0, false)).toBe("none");
    expect(transformControlsMode(1, 0, false)).toBe("none");
    expect(transformControlsMode(1, 1, true)).toBe("none");
    expect(transformControlsMode(0.12, 2, true)).toBe("none");
  });
  it("caps detailed editing handles at six screen pixels", () => {
    expect(transformHandlePixels(0.5)).toBe(6);
    expect(transformHandlePixels(2)).toBe(6);
    expect(transformerCornerOnly(0.4, false)).toBe(true);
    expect(transformerCornerOnly(1, false)).toBe(false);
    expect(transformerCornerOnly(1, true)).toBe(true);
  });
});
