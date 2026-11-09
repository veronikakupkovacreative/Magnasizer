import { describe, expect, it } from "vitest";
import { createProject } from "@/features/projects/demo";
import { commitGroupTransform, selectedGroupBounds, translateGroup } from "./group-transform";

const fixture = () => createProject(true).project.document.layers;

describe("0.7.2 group canvas transforms", () => {
  it("moves all members from original coordinates without modifying source layers", () => {
    const [one, two] = fixture().slice(2, 4);
    const before = structuredClone([one, two]);
    const moved = translateGroup([one, two], 40, -15);
    moved.forEach((member, i) => {
      expect(member.geometry.x).toBe(before[i].geometry.x + 40);
      expect(member.geometry.y).toBe(before[i].geometry.y - 15);
    });
    expect([one, two]).toEqual(before);
  });
  it("keeps image proportions and scales group text uniformly", () => {
    const text = fixture().find((layer) => layer.id === "text-headline")!;
    const product = fixture().find((layer) => layer.id === "image-product")!;
    const resized = commitGroupTransform(text, {
      x: 130, y: 160, width: text.geometry.width * 2, height: text.geometry.height * 2,
    }, true);
    expect(resized.type).toBe("text");
    if (resized.type === "text" && text.type === "text") expect(resized.style.fontSize).toBe(text.style.fontSize * 2);
    const transformedImage = commitGroupTransform(product, {
      x: 100, y: 50, width: product.geometry.width / 2, height: product.geometry.height / 2,
    }, true);
    expect(transformedImage.geometry.width / transformedImage.geometry.height).toBeCloseTo(product.geometry.width / product.geometry.height, 4);
  });
  it("only computes group outline for a complete grouped selection", () => {
    const items = fixture().slice(2, 4).map((l) => ({ ...l, groupId: "g" }));
    expect(selectedGroupBounds(items)?.width).toBeGreaterThan(0);
    expect(selectedGroupBounds([items[0]])).toBeNull();
    expect(selectedGroupBounds([items[0], { ...items[1], groupId: "other" }])).toBeNull();
  });
});
