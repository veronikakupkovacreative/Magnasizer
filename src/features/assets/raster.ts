export function rasterInfo(bytes: Uint8Array): {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
} {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (a: number, b: number) =>
    String.fromCharCode(...bytes.slice(a, b));
  if (
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    ascii(1, 4) === "PNG" &&
    ascii(12, 16) === "IHDR"
  )
    return {
      mimeType: "image/png",
      width: v.getUint32(16),
      height: v.getUint32(20),
    };
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    const type = ascii(12, 16);
    let width = 0,
      height = 0;
    if (type === "VP8X") {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (type === "VP8 ") {
      width = v.getUint16(26, true) & 0x3fff;
      height = v.getUint16(28, true) & 0x3fff;
    } else if (type === "VP8L" && bytes[20] === 47) {
      width = 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]);
      height =
        1 +
        (((bytes[24] & 0xf) << 10) |
          (bytes[23] << 2) |
          ((bytes[22] & 0xc0) >> 6));
    } else throw new Error("assetDecodeError");
    return { mimeType: "image/webp", width, height };
  }
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 255) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      if (marker === 255) {
        i++;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += 2;
        continue;
      }
      const length = v.getUint16(i + 2);
      if (length < 2 || i + length + 2 > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return {
          mimeType: "image/jpeg",
          height: v.getUint16(i + 5),
          width: v.getUint16(i + 7),
        };
      i += length + 2;
    }
  }
  throw new Error("unsupportedImage");
}
export function validateDimensions(width: number, height: number) {
  if (
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 40_000_000
  )
    throw new Error("imageDimensions");
}
