import { describe, expect, it } from "vitest";
import { bundleSchema } from "@/shared/schema/project";
import { createProjectFromFigma, parseFigmaTransfer } from "./bridge";

const demo = JSON.stringify({
  source: "magnasizer-figma", version: 1, name: "Client campaign",
  width: 1200, height: 1200, background: "#14241C",
  nodes: [
    { type: "shape", name: "Brand backdrop", x: 10, y: 10, width: 500, height: 900, rotation: 0, fill: "#DB4444", radius: 0, group: "Design" },
    { type: "text", name: "Headline", x: 42, y: 80, width: 440, height: 180, rotation: 0,
      text: "Work with clarity", fill: "#FFFFFF", fontFamily: "Inter", fontSize: 54,
      fontWeight: "700", align: "left", group: "Design" },
  ],
});

describe("MAGNASIZER Figma Bridge", () => {
  it("validates and imports an editable frame without changing the project schema", async () => {
    const input = parseFigmaTransfer(demo);
    const { bundle, blobs } = await createProjectFromFigma(input);
    expect(bundle.project.name).toBe("Client campaign");
    expect(bundle.project.document.width).toBe(1200);
    expect(bundle.project.document.background).toBe("#14241C");
    expect(bundle.project.document.layers).toHaveLength(2);
    expect(bundle.project.document.layers.map((layer) => layer.type)).toEqual(["shape", "text"]);
    expect(bundle.project.document.layers[0].groupId).toBe(bundle.project.document.layers[1].groupId);
    expect(bundle.project.document.layers[1].role).toBe("headline");
    expect(Object.keys(blobs)).toHaveLength(0);
    expect(bundleSchema.parse(bundle).project.variants).toHaveLength(0);
  });
  it("keeps copy in a 320 x 100 compact frame and does not merge equally named groups", async () => {
    const payload = JSON.parse(demo);
    payload.width = 320;
    payload.height = 100;
    payload.nodes = [
      { type: "text", name: "Copy", x: 12, y: 10, width: 280, height: 65,
        text: "Approved message", fill: "#FFFFFF", fontFamily: "Arial", fontSize: 20,
        fontWeight: "400", align: "left", group: "Items", groupId: "42:1" },
      { type: "shape", name: "Background shape", x: 5, y: 5, width: 30, height: 30,
        fill: "#DB4444", radius: 0, group: "Items", groupId: "42:2" },
    ];
    const { bundle } = await createProjectFromFigma(parseFigmaTransfer(JSON.stringify(payload)));
    const layers = bundle.project.document.layers;
    expect(layers[0].type).toBe("text");
    expect(layers[0].role).toBe("body");
    expect(layers[0].layout.mandatory).toBe(true);
    expect(layers[0].groupId).not.toBe(layers[1].groupId);
  });
  it("rejects malformed and unexpected payloads", () => {
    expect(() => parseFigmaTransfer('{"source":"other"}')).toThrow("figmaTransferInvalid");
    expect(() => parseFigmaTransfer("x".repeat(24 * 1024 * 1024 + 1))).toThrow("figmaTransferTooLarge");
  });
  it("does not accept scripts or executable node properties", () => {
    const bad = JSON.parse(demo);
    bad.nodes[0].onClick = "alert(1)";
    expect(() => parseFigmaTransfer(JSON.stringify(bad))).toThrow("figmaTransferInvalid");
  });
});
