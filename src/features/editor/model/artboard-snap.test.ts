import { describe, expect, it } from "vitest";
import { snapArtboardPosition } from "./artboard-snap";
import { layoutArtboards } from "./workspace-layout";
import { createProject } from "@/features/projects/demo";

describe("artboard movement", () => {
  it("persists independent workspace coordinates without changing design geometry", () => {
    const project = createProject(true).project;
    const original = JSON.stringify(project.document);
    const layout = layoutArtboards({ ...project, workspacePositions: { master: { x: 425, y: 75 } } });
    expect(layout.boards[0].x).toBe(425);
    expect(layout.boards[0].y).toBe(75);
    expect(JSON.stringify(project.document)).toBe(original);
  });
  it("snaps on artboard edges in screen pixels and supports disabled snapping", () => {
    const project = createProject(true).project;
    const boards = layoutArtboards(project).boards;
    const moving = { key: "other", document: { ...project.document, width: 400, height: 400 } };
    const proposed = { x: 1204, y: 22 };
    expect(snapArtboardPosition(moving, proposed, boards, .5, true)).toEqual({ x: 1200, y: 22 });
    expect(snapArtboardPosition(moving, proposed, boards, .5, false)).toEqual(proposed);
  });
});
