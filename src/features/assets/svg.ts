import DOMPurify from "dompurify";
const tags = [
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "title",
  "desc",
];
const attributes = [
  "xmlns",
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "transform",
  "id",
  "clip-path",
  "clip-rule",
  "clipPathUnits",
  "gradientUnits",
  "gradientTransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "fx",
  "fy",
  "fr",
  "spreadMethod",
  "preserveAspectRatio",
  "vector-effect",
];
const tagSet = new Set(tags.map((t) => t.toLowerCase())),
  attrSet = new Set(attributes.map((a) => a.toLowerCase()));
export function sanitizeSvg(source: string): {
  svg: string;
  width: number;
  height: number;
  removed: number;
} {
  if (
    source.length > 2 * 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(source)
  )
    throw new Error("svgUnsupported");
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  if (
    parsed.querySelector("parsererror") ||
    parsed.documentElement.localName !== "svg"
  )
    throw new Error("assetDecodeError");
  const root = parsed.documentElement;
  const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
  if (nodes.length > 5000) throw new Error("svgUnsupported");
  let removed = 0;
  for (const node of nodes) {
    if (node.localName.toLowerCase() === "script") {
      node.remove();
      removed++;
      continue;
    }
    if (
      node.namespaceURI !== "http://www.w3.org/2000/svg" ||
      !tagSet.has(node.localName.toLowerCase())
    )
      throw new Error("svgUnsupported");
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      // Unsupported presentation must be re-exported explicitly, not silently lost.
      if (name === "style" || name === "filter" || name === "mask")
        throw new Error("svgUnsupported");
      if (!attrSet.has(name) || name.startsWith("on")) {
        node.removeAttribute(attr.name);
        removed++;
        continue;
      }
      if (
        /url\s*\(/i.test(attr.value) &&
        !/^url\(\s*['"]?#[A-Za-z0-9_-]+['"]?\s*\)$/.test(attr.value)
      ) {
        node.removeAttribute(attr.name);
        removed++;
      }
    }
  }
  const vb = root
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const size = (name: string, fallback: number | undefined) => {
    const v = root.getAttribute(name);
    return v && /^\d+(\.\d+)?(px)?$/.test(v)
      ? Number(v.replace("px", ""))
      : fallback;
  };
  const width = Math.round(size("width", vb?.[2]) ?? 0),
    height = Math.round(size("height", vb?.[3]) ?? 0);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 40_000_000
  )
    throw new Error("assetTooLarge");
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const safe = DOMPurify.sanitize(new XMLSerializer().serializeToString(root), {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: attributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    NAMESPACE: "http://www.w3.org/2000/svg",
    PARSER_MEDIA_TYPE: "application/xhtml+xml",
  });
  if (!safe || !safe.includes("<svg")) throw new Error("assetDecodeError");
  return {
    svg: safe,
    width,
    height,
    removed:
      removed +
      DOMPurify.removed.filter(
        (entry) =>
          !(
            "element" in entry &&
            entry.element?.nodeName.toLowerCase() === "template"
          ),
      ).length,
  };
}
