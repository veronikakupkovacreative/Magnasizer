import { describe, expect, it } from "vitest";
import { importFontFile } from "./fonts";

const fontFile = (name: string, magic: number[] | string) => new File(
  [typeof magic === "string" ? new TextEncoder().encode(magic) : new Uint8Array(magic)],
  name,
);

describe("custom font file validation", () => {
  it("rejects unsupported formats and incorrect file signatures", async () => {
    await expect(importFontFile(fontFile("image.png", "OTTO"))).rejects.toThrow("unsupportedFont");
    await expect(importFontFile(fontFile("fake.ttf", "fake"))).rejects.toThrow("invalidFont");
    await expect(importFontFile(fontFile("fake.woff2", "OTTO"))).rejects.toThrow("invalidFont");
  });
  it("recognizes TrueType, OpenType and WOFF2 headers without loading font bytes", async () => {
    const fonts = [
      fontFile("Headline.ttf", [0, 1, 0, 0]),
      fontFile("Legacy.ttf", "true"),
      fontFile("Headline.otf", "OTTO"),
      fontFile("Headline.woff2", "wOF2"),
    ];
    for (const file of fonts) {
      const imported = await importFontFile(file);
      expect(imported.asset.kind).toBe("imported-font");
      expect(imported.asset.name).toBe(file.name);
      expect(imported.asset.fontFamily).toContain("SRS ");
    }
  });
});
