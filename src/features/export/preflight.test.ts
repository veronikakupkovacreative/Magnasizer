import { describe, expect, it } from "vitest";
import { inspectDocument } from "./preflight";
import { createProject } from "@/features/projects/demo";

describe("preflight QA", () => {
  it("flags a rotated layer whose unrotated box fits the artboard", () => {
    const { project, assets } = createProject(true);
    const doc = structuredClone(project.document);
    const layer = doc.layers.find(item => item.type === "text")!;
    layer.geometry = { x: doc.width - 80, y: 100, width: 80, height: 100, rotation: -45 };
    const issues = inspectDocument(doc, null, "master", "Master", assets);
    expect(issues.some(issue => issue.layerId === layer.id && issue.type === "artboard-overflow")).toBe(true);
  });
  it("flags out-of-bounds visual layers without modifying the document", () => {
    const { project, assets } = createProject(true);
    const doc = structuredClone(project.document);
    const headline = doc.layers.find(layer => layer.type === "text")!;
    headline.geometry.x = -30;
    const before = JSON.stringify(doc);
    const issues = inspectDocument(doc, { top: 100, right: 100, bottom: 100, left: 100 }, "v1", "Story", assets);
    expect(issues.some(issue => issue.layerId === headline.id && issue.type === "artboard-overflow")).toBe(true);
    expect(issues.some(issue => issue.layerId === headline.id && issue.type === "safe-zone")).toBe(true);
    expect(JSON.stringify(doc)).toBe(before);
  });
});
