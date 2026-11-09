import { describe, expect, it } from "vitest";
import { crc32, makeZip } from "./zip";

describe("standards-compliant ZIP export", () => {
  it("produces stable CRC32 and uncompressed entries", async () => {
    const payload = new TextEncoder().encode("123456789");
    expect(crc32(payload)).toBe(0xcbf43926);
    const zipped = makeZip([{ name: "banner.png", bytes: payload }]);
    const bytes = await zipped.arrayBuffer();
    const view = new DataView(bytes);
    expect(zipped.type).toBe("application/zip");
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(0xcbf43926);
    expect(view.getUint32(bytes.byteLength - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.byteLength - 12, true)).toBe(1);
  });
  it("supports multiple independent Unicode names and preserves bytes", async () => {
    const entries = [
      { name: "Příběh-1080x1920.webp", bytes: new Uint8Array([0, 33, 255]) },
      { name: "Banner-1200x628.png", bytes: new Uint8Array([3, 5, 7, 9]) },
    ];
    const zipped = makeZip(entries);
    const bytes = new Uint8Array(await zipped.arrayBuffer());
    expect(new DataView(bytes.buffer).getUint16(bytes.length - 12, true)).toBe(2);
    expect(bytes.includes(255)).toBe(true);
    expect(() => makeZip([])).toThrow();
  });
});
