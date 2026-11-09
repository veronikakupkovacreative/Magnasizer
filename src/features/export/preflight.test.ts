import { describe, expect, it } from "vitest";
import { inspectDocument } from "./preflight";
import { createProject } from "@/features/projects/demo";

describe("preflight QA", () => {
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
