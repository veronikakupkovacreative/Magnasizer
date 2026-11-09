/** Small standards-compliant ZIP writer (stored entries, UTF-8 filenames, CRC32).
 * No network dependency, no lossy re-encoding, and exact PNG/JPG/WebP bytes.
 */
export type ZipEntry = { name: string; bytes: Uint8Array<ArrayBuffer> };
const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[n] = c >>> 0;
}
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function writer(size: number) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  return { bytes, view };
}
export function makeZip(entries: ZipEntry[]): Blob {
  if (!entries.length || entries.length > 1000) throw new Error("Invalid export count");
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name.replace(/[\\/]/g, "-").slice(0, 180));
    const data = entry.bytes;
    const crc = crc32(data);
    const local = writer(30 + name.length);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, name.length, true);
    local.bytes.set(name, 30);
    const directory = writer(46 + name.length);
    directory.view.setUint32(0, 0x02014b50, true);
    directory.view.setUint16(4, 20, true);
    directory.view.setUint16(6, 20, true);
    directory.view.setUint16(8, 0x0800, true);
    directory.view.setUint32(16, crc, true);
    directory.view.setUint32(20, data.length, true);
    directory.view.setUint32(24, data.length, true);
    directory.view.setUint16(28, name.length, true);
    directory.view.setUint32(42, offset, true);
    directory.bytes.set(name, 46);
    central.push(directory.bytes);
    parts.push(local.bytes, data);
    offset += local.bytes.length + data.length;
  }
  const directorySize = central.reduce((n, bytes) => n + bytes.length, 0);
  const end = writer(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, entries.length, true);
  end.view.setUint16(10, entries.length, true);
  end.view.setUint32(12, directorySize, true);
  end.view.setUint32(16, offset, true);
  // Ensure every BlobPart owns an ArrayBuffer (TS 6 DOM types reject SharedArrayBuffer-backed views).
  const buffers = [...parts, ...central, end.bytes].map((bytes) => Uint8Array.from(bytes).buffer);
  return new Blob(buffers, { type: "application/zip" });
}
