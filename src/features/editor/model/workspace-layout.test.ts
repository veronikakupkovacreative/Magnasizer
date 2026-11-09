import { describe, expect, it } from "vitest";
import { layoutArtboards, fitWorkspace, WORKSPACE_GAP } from "./workspace-layout";
import { createProject } from "@/features/projects/demo";

function sample() {
  const project = createProject(true).project;
  const variant = {
    id: "v1", presetId: "test", presetVersion: 1,
    platform: "meta" as const, name: "Story", status: "synced" as const,
    strategy: "portrait" as const,
    safeZone: { top: 100, right: 0, bottom: 100, left: 0 },
    document: { ...project.document, id: "other", width: 1080, height: 1920 },
  };
  return { ...project, variants: [variant] };
}

describe("workspace layout", () => {
  it("contains master and variants with stable identifiers and real pixel dimensions", () => {
    const result = layoutArtboards(sample());
    expect(result.boards.map((board) => board.key)).toEqual(["master", "v1"]);
    expect(result.boards[0].document.width).toBe(1200);
    expect(result.boards[1].document.height).toBe(1920);
    expect(result.boards[1].x).toBe(1200 + WORKSPACE_GAP);
  });
  it("wraps to new rows without overlaps", () => {
    const project = sample();
    const result = layoutArtboards({ ...project, variants: Array.from({ length: 8 }, (_, index) => ({
      ...project.variants[0], id: `v${index}`, document: { ...project.variants[0].document, id: `d${index}` },
    })) });
    for (const [i, a] of result.boards.entries()) {
      for (const b of result.boards.slice(i + 1)) {
        expect(a.x + a.document.width <= b.x || b.x + b.document.width <= a.x ||
          a.y + a.document.height <= b.y || b.y + b.document.height <= a.y).toBe(true);
      }
    }
  });
  it("preserves moved artboard coordinates without changing master coordinates", () => {
    const p = sample();
    const original = p.document.layers.map(l => l.geometry.x);
    const layout = layoutArtboards({ ...p, workspacePositions: { master: { x: 600, y: 800 }, v1: { x: 2000, y: 300 } } });
    expect(layout.boards[0].x).toBe(600);
    expect(layout.boards[1].y).toBe(300);
    expect(layout.width).toBeGreaterThan(3000);
    expect(p.document.layers.map(l => l.geometry.x)).toEqual(original);
  });
  it("fits large workspaces without losing their geometry", () => {
    const value = fitWorkspace({ width: 6000, height: 4000 }, { width: 1200, height: 850 });
    expect(value).toBeGreaterThan(0.04);
    expect(value).toBeLessThan(0.3);
  });
});
