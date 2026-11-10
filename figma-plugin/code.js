/* MAGNASIZER Bridge 0.1.3 — Figma-side exporter.
 * Works entirely locally. Large PNGs are chunked for reliable plugin-to-UI transfer. */
figma.showUI(__html__, { width: 410, height: 560, title: "MAGNASIZER Bridge", themeColors: true });

const MAX_NODES = 180;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// 17 MB binary becomes at most ~22.7 MB in base64, below MAGNASIZER's 24 MB JSON limit.
const MAX_TOTAL_IMAGE_BYTES = 17 * 1024 * 1024;
const BYTE_CHUNK = 384 * 1024; // divisible by 3 for concatenated base64 chunks
const supportedRootTypes = ["FRAME", "COMPONENT", "INSTANCE"];
const SUPPORTED_EDITABLE_FONTS = new Set(["inter", "inter variable", "arial", "helvetica", "georgia", "verdana", "times new roman", "courier new"]);
const SUPPORTED_TEXT_WEIGHTS = { regular: "400", normal: "400", book: "400", semibold: "600", "semi bold": "600", demibold: "600", "demi bold": "600", bold: "700" };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const hex = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");
const toHex = (rgb) => `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`.toUpperCase();
const safe = (value, fallback = "Layer") => String(value || fallback).trim().slice(0, 100) || fallback;
const solid = (paints) => {
  if (!Array.isArray(paints)) return null;
  const visible = paints.filter((p) => p.visible !== false);
  if (visible.length !== 1 || visible[0].type !== "SOLID" || (visible[0].opacity ?? 1) < 1) return null;
  return toHex(visible[0].color);
};
const selected = () => {
  const nodes = figma.currentPage.selection;
  return nodes.length === 1 && supportedRootTypes.includes(nodes[0].type) ? nodes[0] : null;
};
const send = (message) => figma.ui.postMessage(message);
const info = () => {
  const root = selected();
  send({ type: "selection", name: root?.name || "", valid: !!root, id: root?.id || "",
    count: root && "children" in root ? root.children.length : 0 });
};
figma.on("selectionchange", info);

function rectOf(node, root) {
  const bounds = node.absoluteBoundingBox;
  const origin = root.absoluteBoundingBox;
  if (!bounds || !origin) return null;
  const x = bounds.x - origin.x;
  const y = bounds.y - origin.y;
  const width = bounds.width;
  const height = bounds.height;
  if (![x, y, width, height].every(Number.isFinite) || width < 8 || height < 8 || width > 8192 || height > 8192) return null;
  if (x < -16000 || x > 16000 || y < -16000 || y > 16000) return null;
  return { x: +x.toFixed(2), y: +y.toFixed(2), width: +width.toFixed(2), height: +height.toFixed(2), rotation: 0 };
}

async function serialize(root, flatten, progress) {
  if (root.rotation || root.width < 64 || root.height < 64 || root.width > 8192 || root.height > 8192) {
    throw new Error("Select an unrotated frame between 64 and 8192 px per side.");
  }
  const payload = {
    source: "magnasizer-figma", version: 1, name: safe(root.name, "Figma frame"),
    width: Math.round(root.width), height: Math.round(root.height),
    background: solid(root.fills) || "#FFFFFF", nodes: [], warnings: [],
  };
  let imageBytes = 0;
  let visited = 0;
  const addWarning = (message) => { if (payload.warnings.length < 100) payload.warnings.push(message.slice(0, 300)); };
  const groupFields = (group) => group ? { group: group.name, groupId: group.id } : {};
  async function raster(node, bounds, group, reason) {
    if (reason) addWarning(`${safe(node.name)}: exported as a raster image (${reason}); not editable.`);
    progress(`Rendering image: ${safe(node.name)}`);
    const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 } });
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`The layer "${safe(node.name)}" exceeds 8 MB. Simplify it or export a smaller frame.`);
    }
    if (bytes.length + imageBytes > MAX_TOTAL_IMAGE_BYTES) {
      throw new Error("Too many large image layers. Try Flatten entire frame, or use fewer layers.");
    }
    imageBytes += bytes.length;
    payload.nodes.push({ type: "image", name: safe(node.name), ...bounds, ...groupFields(group),
      ...(node.type === "TEXT" ? { contentRole: "text" } : {}), pngBytes: bytes });
  }
  const base = (node, bounds, group) => ({ name: safe(node.name), ...bounds, ...groupFields(group) });
  async function visit(node, group) {
    if (!node.visible) return;
    visited++;
    if (visited % 8 === 0) progress(`Reading ${visited} Figma layers…`);
    if (payload.nodes.length >= MAX_NODES || visited > MAX_NODES * 4) {
      throw new Error("Frame too complex for this version (maximum 180 exported layers). Try Flatten entire frame.");
    }
    const bounds = rectOf(node, root);
    if (!bounds) {
      if (payload.warnings.length < 50) payload.warnings.push(`Skipped tiny or unsupported layer: ${safe(node.name)}`);
      return;
    }
    if (node.rotation && Math.abs(node.rotation) > 0.01) { await raster(node, bounds, group, "rotated source layer"); return; }
    if (node.opacity !== undefined && node.opacity < 0.999) { await raster(node, bounds, group, "layer opacity"); return; }
    if (node.type === "TEXT") {
      const font = node.fontName;
      const size = node.fontSize;
      const color = solid(node.fills);
      const family = font && font !== figma.mixed ? String(font.family || "") : "";
      const style = font && font !== figma.mixed ? String(font.style || "").toLowerCase().trim() : "";
      const weight = SUPPORTED_TEXT_WEIGHTS[style];
      const spacing = node.letterSpacing;
      const lineHeight = node.lineHeight;
      const unsupportedTypography = !color || !weight || !SUPPORTED_EDITABLE_FONTS.has(family.toLowerCase()) ||
        size === figma.mixed || typeof size !== "number" || size < 8 || size > 300 ||
        spacing === figma.mixed || (spacing && Math.abs(spacing.value || 0) > 0.001) ||
        lineHeight === figma.mixed || (lineHeight && lineHeight.unit !== "AUTO") ||
        (node.effects && node.effects.length > 0) ||
        (node.strokes && node.strokes.length > 0) ||
        (node.textDecoration && node.textDecoration !== "NONE") ||
        (node.textCase && node.textCase !== "ORIGINAL") ||
        (node.textAlignVertical && node.textAlignVertical !== "TOP") ||
        (node.paragraphSpacing && Math.abs(node.paragraphSpacing) > 0.001) ||
        (node.paragraphIndent && Math.abs(node.paragraphIndent) > 0.001);
      if (node.characters.length > 4000 || unsupportedTypography) {
        await raster(node, bounds, group, node.characters.length > 4000
          ? "text exceeds the 4,000-character editable limit"
          : "unsupported font or typography; appearance preserved");
        return;
      }
      const align = node.textAlignHorizontal === "CENTER" ? "center" : node.textAlignHorizontal === "RIGHT" ? "right" : "left";
      payload.nodes.push({ type: "text", ...base(node, bounds, group), text: node.characters,
        fill: color, fontFamily: family.toLowerCase() === "inter" ? "Inter Variable" : family,
        fontSize: size, fontWeight: weight, align });
      return;
    }
    if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
      const fill = solid(node.fills);
      if (!fill || (node.effects && node.effects.length) || (node.strokes && node.strokes.length) || (node.type === "ELLIPSE" && Math.abs(bounds.width - bounds.height) > 1)) {
        await raster(node, bounds, group); return;
      }
      const radius = node.type === "ELLIPSE" ? bounds.width / 2 : typeof node.cornerRadius === "number" ? node.cornerRadius : 0;
      payload.nodes.push({ type: "shape", ...base(node, bounds, group), fill, radius: clamp(radius, 0, 1000) });
      return;
    }
    if ("children" in node && Array.isArray(node.children)) {
      const nextGroup = node.type === "GROUP" ? { id: String(node.id), name: safe(node.name, "Group") } : group;
      if (node.clipsContent || (node.effects && node.effects.length) || node.type === "INSTANCE") {
        await raster(node, bounds, group, "clipping, effects or component instance"); return;
      }
      if (node.type === "FRAME" && solid(node.fills)) {
        payload.nodes.push({ type: "shape", ...base(node, bounds, group), name: safe(node.name, "Frame background"),
          fill: solid(node.fills), radius: 0 });
      }
      for (const child of node.children) await visit(child, nextGroup);
      return;
    }
    await raster(node, bounds, group);
  }
  if (flatten) {
    addWarning("Entire frame was flattened into one image; text is not editable.");
    await raster(root, { x: 0, y: 0, width: Math.round(root.width), height: Math.round(root.height), rotation: 0 });
  } else {
    for (const child of root.children) await visit(child, undefined);
    if (payload.nodes.length === 0) {
      payload.warnings.push("No supported visible layers; exported the entire frame as one image.");
      await raster(root, { x: 0, y: 0, width: Math.round(root.width), height: Math.round(root.height), rotation: 0 });
    }
  }
  return payload;
}

// Never post a whole large image-containing frame as one giant message.
function sendTransfer(payload, requestId) {
  const { nodes, ...header } = payload;
  send({ type: "transfer-start", requestId, header, count: nodes.length });
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node.type !== "image") {
      send({ type: "transfer-node", requestId, index, node });
    } else {
      const { pngBytes, ...rest } = node;
      send({ type: "transfer-image-start", requestId, index, node: rest });
      for (let offset = 0; offset < pngBytes.length; offset += BYTE_CHUNK) {
        send({ type: "transfer-image-chunk", requestId, index,
          bytes: pngBytes.slice(offset, offset + BYTE_CHUNK) });
      }
      send({ type: "transfer-image-end", requestId, index });
    }
  }
  send({ type: "transfer-end", requestId });
}

let exporting = false;
figma.ui.onmessage = async (message) => {
  if (!message) return;
  if (message.type === "ready" || message.type === "refresh-selection") { info(); return; }
  if (message.type !== "export") return;
  if (exporting) { send({ type: "error", requestId: message.requestId, message: "An export is already running." }); return; }
  const root = selected();
  if (!root) { send({ type: "error", requestId: message.requestId, message: "Select exactly one frame in Figma." }); return; }
  exporting = true;
  const requestId = message.requestId;
  send({ type: "busy", requestId, message: `Preparing ${safe(root.name)}…` });
  try {
    const payload = await serialize(root, !!message.flatten,
      (text) => send({ type: "progress", requestId, message: text }));
    send({ type: "progress", requestId, message: "Sending prepared layers to the plugin panel…" });
    sendTransfer(payload, requestId);
  } catch (error) {
    send({ type: "error", requestId, message: error instanceof Error ? error.message : "Frame export failed." });
  } finally {
    exporting = false;
  }
};
// UI requests selection once its listener is attached; no startup race.
