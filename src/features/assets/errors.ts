import type { MessageKey } from "@/lib/i18n/messages";
const keys = new Set([
  "assetTooLarge",
  "projectTooLarge",
  "tooManyFiles",
  "unsupportedImage",
  "invalidImage",
  "imageDimensions",
  "assetDecodeError",
  "svgInvalid",
  "svgUnsupported",
  "missingAsset",
]);
export function importErrorKey(
  error: unknown,
  fallback: MessageKey = "imageImportError",
): MessageKey {
  return error instanceof Error && keys.has(error.message)
    ? (error.message as MessageKey)
    : fallback;
}
