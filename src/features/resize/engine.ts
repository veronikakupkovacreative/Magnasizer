import type { Geometry, Layer, SafeZone, StudioDocument, Variant, FlatImageSettings } from "@/shared/schema/project";
import type { FormatPreset } from "@/features/formats/presets";
import { clamp } from "@/features/editor/model/geometry";
import { flatSource, flatPlan } from "./flat-image";

export type LayoutStrategy = Variant["strategy"];
export type CompositionMode = "auto" | "balanced" | "product" | "text";

export function strategyFor(width: number, height: number): LayoutStrategy {
  const ratio = width / height;
  if (height <= 120 || width <= 360) return "compact";
  if (ratio > 1.35) return "landscape";
  if (ratio < 0.8) return "portrait";
  return "square";
}

type Box = { x: number; y: number; width: number; height: number };
const bounds = (g: Geometry) => ({ x: g.x, y: g.y, width: g.width, height: g.height });
const keepWithin = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const nextGeometry = (layer: Layer, box: Box): Geometry => ({
  ...layer.geometry,
  x: Math.round(box.x * 100) / 100,
  y: Math.round(box.y * 100) / 100,
  width: Math.max(layer.constraints.minWidth, Math.round(box.width * 100) / 100),
  height: Math.max(layer.constraints.minHeight, Math.round(box.height * 100) / 100),
});

/** A deterministic, font-independent upper bound used while composing before browser fonts load. */
export function approximateTextLines(text: string, width: number, fontSize: number): number {
  const capacity = Math.max(1, Math.floor(width / (fontSize * 0.54)));
  return text.split("\n").reduce((total, paragraph) => {
    let rows = 1;
    let used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const chars = word.length;
      if (used && used + chars + 1 > capacity) { rows++; used = 0; }
      if (chars > capacity) {
        rows += Math.floor((chars - 1) / capacity);
        used = ((chars - 1) % capacity) + 1;
      } else used += chars + (used ? 1 : 0);
    }
    return total + rows;
  }, 0);
}

export function fitTypography(layer: Extract<Layer, { type: "text" }>, box: Box, preferredSize: number): Layer {
  let fontSize = clamp(preferredSize, 8, 300);
  // Avoid rewriting approved copy. Adjust the container and font size only.
  while (fontSize > 8 && approximateTextLines(layer.text, box.width, fontSize) * fontSize * 1.16 > box.height) {
    fontSize = Math.max(8, fontSize - 1);
  }
  return {
    ...layer,
    geometry: nextGeometry(layer, box),
    style: { ...layer.style, fontSize: Math.round(fontSize * 10) / 10 },
  };
}

function fitImage(layer: Extract<Layer, { type: "image" }>, region: Box, scale = 1): Layer {
  const ratio = layer.geometry.width / layer.geometry.height;
  const maxW = Math.max(8, region.width * scale);
  const maxH = Math.max(8, region.height * scale);
  let width = Math.min(maxW, maxH * ratio);
  let height = width / ratio;
  const minScale = Math.max(1, layer.constraints.minWidth / width, layer.constraints.minHeight / height);
  width *= minScale;
  height *= minScale;
  return { ...layer, geometry: nextGeometry(layer, {
    x: region.x + (region.width - width) / 2,
    y: region.y + (region.height - height) / 2,
    width, height,
  }) };
}

/**
 * Nondestructive center/anchor crop for explicitly fill-sized photographic backgrounds.
 * Products/logos always remain contained. Original binary assets are never changed.
 */
export function fillImageCrop(layer: Extract<Layer, { type: "image" }>, region: Box): Layer {
  const original = layer.crop;
  const sourceRatio = (layer.geometry.width / layer.geometry.height) * (original.height / original.width);
  const targetRatio = region.width / region.height;
  let cropWidth = original.width;
  let cropHeight = original.height;
  if (targetRatio > sourceRatio) cropHeight = Math.min(original.height, original.width * sourceRatio / targetRatio);
  else cropWidth = Math.min(original.width, original.height * targetRatio / sourceRatio);
  const bias = layer.anchor === "top-left" ? 0 : layer.anchor === "bottom-right" ? 1 : .5;
  const crop = {
    x: original.x + (original.width - cropWidth) * bias,
    y: original.y + (original.height - cropHeight) * bias,
    width: cropWidth,
    height: cropHeight,
  };
  // The image geometry and the visible crop have identical aspect ratios.
  return { ...layer, crop, geometry: nextGeometry(layer, region) };
}

function textRole(layer: Layer, text: string): layer is Extract<Layer, { type: "text" }> {
  return layer.type === "text" && layer.role === text;
}

/** 0.8.2 production presets: small GDN formats need actual art direction,
 * not the proportional layout of a 1200px master. All changes affect generated
 * geometry only: the master remains untouched, and no copy is rewritten. */
export function refineCompactLayout(document: StudioDocument, zone: SafeZone, mode: Exclude<CompositionMode, "auto">): StudioDocument {
  const { width, height } = document;
  const wide = height <= 120 && width / height > 2;
  const card = width <= 360 && height > 120 && height <= 360;
  if (!wide && !card) return document;
  const padX = Math.max(zone.left, Math.round(width * 0.035));
  const padY = Math.max(zone.top, Math.round(height * 0.045));
  const region: Box = { x: padX, y: padY,
    width: width - padX - Math.max(padX, zone.right),
    height: height - padY - Math.max(padY, zone.bottom) };
  const layer = (role: Layer["role"], type?: Layer["type"]) =>
    document.layers.find((item) => item.role === role && (type === undefined || item.type === type));
  const image = layer("product", "image") as Extract<Layer, { type: "image" }> | undefined;
  const logoText = layer("logo", "text") as Extract<Layer, { type: "text" }> | undefined;
  const logoImage = layer("logo", "image") as Extract<Layer, { type: "image" }> | undefined;
  const headline = layer("headline", "text") as Extract<Layer, { type: "text" }> | undefined;
  const body = layer("body", "text") as Extract<Layer, { type: "text" }> | undefined;
  const ctaText = layer("cta", "text") as Extract<Layer, { type: "text" }> | undefined;
  const ctaShape = layer("cta", "shape") as Extract<Layer, { type: "shape" }> | undefined;
  const output = new Map<string, Layer>();
  const placeText = (item: Extract<Layer, { type: "text" }> | undefined, box: Box, preferred: number) => {
    if (item) output.set(item.id, fitTypography(item, box, preferred));
  };
  const placeImage = (item: Extract<Layer, { type: "image" }> | undefined, box: Box, scale = 1) => {
    if (item) output.set(item.id, fitImage(item, box, scale));
  };
  let productRegion: Box;
  if (wide) {
    const { x, y, width: w, height: h } = region;
    const gap = Math.max(3, Math.min(10, w * 0.014));
    const logoW = w * (image ? 0.15 : 0.18);
    const productW = image ? w * (mode === "product" ? 0.23 : 0.2) : 0;
    const ctaW = ctaText || ctaShape ? w * .20 : 0;
    const parts = 1 + (ctaW ? 1 : 0) + (productW ? 1 : 0);
    const headlineW = w - logoW - ctaW - productW - gap * parts;
    const headlineX = x + logoW + gap;
    const ctaX = headlineX + headlineW + gap;
    const productX = x + w - productW;
    placeText(logoText, { x, y: y + h * .2, width: logoW, height: h * .45 }, Math.min(17, h * .23));
    placeImage(logoImage, { x, y: y + h * .1, width: logoW, height: h * .65 });
    placeText(headline, { x: headlineX, y: y + h * .08, width: headlineW, height: h * .86 }, Math.min(31, h * (mode === "text" ? .41 : .34)));
    const ctaBox = { x: ctaX, y: y + h * .31, width: ctaW, height: h * .4 };
    if (ctaShape) output.set(ctaShape.id, { ...ctaShape, geometry: nextGeometry(ctaShape, ctaBox), style: { ...ctaShape.style, radius: ctaBox.height / 2 } });
    placeText(ctaText, { x: ctaX + 4, y: ctaBox.y + 3, width: Math.max(8, ctaW - 8), height: Math.max(8, ctaBox.height - 6) }, Math.max(8, Math.min(14, h * .135)));
    productRegion = { x: productX, y, width: productW, height: h };
    placeImage(image, productRegion, .94);
    if (body) output.set(body.id, body.layout.mandatory
      ? fitTypography(body, { x: headlineX, y: y + h * .68, width: headlineW, height: h * .25 }, 8)
      : { ...body, visible: false });
  } else {
    const { x, y, width: w, height: h } = region;
    placeText(logoText, { x, y, width: w * .42, height: h * .12 }, Math.min(18, h * .07));
    placeImage(logoImage, { x, y, width: w * .42, height: h * .12 });
    placeText(headline, { x, y: y + h * .15, width: w * .95, height: h * .32 }, Math.min(34, h * (mode === "text" ? .17 : .145)));
    productRegion = { x: x + w * .46, y: y + h * .47, width: w * .54, height: h * .38 };
    placeImage(image, productRegion, mode === "product" ? 1 : .9);
    const ctaBox = { x, y: y + h * .86, width: Math.max(58, w * .48), height: h * .13 };
    if (ctaShape) output.set(ctaShape.id, { ...ctaShape, geometry: nextGeometry(ctaShape, ctaBox), style: { ...ctaShape.style, radius: ctaBox.height / 2 } });
    placeText(ctaText, { x: ctaBox.x + 6, y: ctaBox.y + 3, width: ctaBox.width - 12, height: ctaBox.height - 6 }, Math.min(12, Math.max(8, h * .055)));
    if (body) output.set(body.id, body.layout.mandatory
      ? fitTypography(body, { x, y: y + h * .52, width: w * .42, height: h * .29 }, 10)
      : { ...body, visible: false });
  }
  for (const item of document.layers) {
    if (item.role === "decoration") {
      if (!item.layout.mandatory && (item.type === "text" || !image)) {
        output.set(item.id, { ...item, visible: false });
      } else if (item.type === "shape" && image) {
        const diameter = Math.max(8, Math.min(productRegion.width, productRegion.height) * .85);
        output.set(item.id, { ...item, geometry: nextGeometry(item, {
          x: productRegion.x + (productRegion.width - diameter) / 2,
          y: productRegion.y + (productRegion.height - diameter) / 2,
          width: diameter, height: diameter,
        }), style: { ...item.style, radius: item.style.radius ? diameter / 2 : 0 } });
      }
    }
  }
  return { ...document, layers: document.layers.map((item) => output.get(item.id) ?? item) };
}

/**
 * Composition plans are source-ID preserving, safe-area aware, and non-destructive.
 * Geometry inside the master is not mutated; backgrounds and decorative layers follow
 * the media area while content roles are placed in purpose-built zones.
 */
export function composeDocument(master: StudioDocument, width: number, height: number, zone: SafeZone, mode: CompositionMode, flatImage?: FlatImageSettings): StudioDocument {
  if (flatSource(master, flatImage)) return flatPlan(master, width, height, flatImage!).document;
  if (mode === "auto") {
    const modes = ["balanced", "product", "text"] as const;
    const candidates = modes.map((candidate) => composeDocument(master, width, height, zone, candidate));
    return candidates.reduce((best, document) =>
      scoreComposition(document, zone) > scoreComposition(best, zone) ? document : best,
    candidates[0]);
  }
  const strategy = strategyFor(width, height);
  const isSmall = strategy === "compact";
  const stacked = strategy === "portrait" || (isSmall && height > width * 1.05);
  const insetX = Math.max(zone.left, Math.round(width * (stacked ? 0.055 : 0.04)));
  const insetY = Math.max(zone.top, Math.round(height * 0.04));
  const usable: Box = {
    x: insetX,
    y: insetY,
    width: width - insetX - Math.max(zone.right, insetX),
    height: height - insetY - Math.max(zone.bottom, insetY),
  };
  const hasContentImage = master.layers.some((layer) => layer.type === "image" && layer.visible && !["background", "logo"].includes(layer.role));
  const split = !hasContentImage ? 1 : stacked
    ? 1
    : strategy === "landscape"
      ? (mode === "product" ? .44 : mode === "text" ? .64 : .54)
      : (mode === "product" ? .47 : mode === "text" ? .61 : .52);
  const gap = Math.min(usable.width * .055, usable.height * .06, strategy === "compact" ? 20 : 52);
  const textHeight = stacked
    ? usable.height * (mode === "text" ? .53 : mode === "product" ? .34 : .43)
    : usable.height;
  const textRegion: Box = stacked
    ? { ...usable, height: textHeight }
    : { x: usable.x, y: usable.y, width: hasContentImage ? Math.max(usable.width * .3, usable.width * split - gap * .5) : usable.width, height: usable.height };
  const mediaRegion: Box = stacked
    ? { x: usable.x, y: textRegion.y + textRegion.height + gap, width: usable.width, height: Math.max(24, usable.height - textRegion.height - gap) }
    : { x: textRegion.x + textRegion.width + gap, y: usable.y, width: Math.max(24, usable.width - textRegion.width - gap), height: usable.height };

  const scale = Math.min(width / master.width, height / master.height);
  const firstImage = master.layers.filter((layer): layer is Extract<Layer, { type: "image" }> => layer.type === "image" && layer.visible && !["background", "logo"].includes(layer.role))
    .sort((a, b) => b.priority - a.priority)[0];
  const imageScale = stacked ? (mode === "product" ? 0.92 : mode === "text" ? 0.78 : 0.86) : (mode === "product" ? 1.02 : mode === "text" ? 0.82 : 0.92);
  const image = firstImage ? fitImage(firstImage, mediaRegion, imageScale) : undefined;
  const remap = new Map<string, Layer>();

  // Recompose actual background shapes; do not stretch product images, logos, or text.
  for (const layer of master.layers) {
    if (layer.role !== "background") continue;
    if (layer.type === "shape") {
      const rightPanel = layer.geometry.x > master.width * .36;
      remap.set(layer.id, { ...layer, geometry: nextGeometry(layer, rightPanel
        ? (isSmall && !stacked && height <= 160
          ? { x: usable.x + usable.width * .75 - gap * .25, y: 0, width: width - (usable.x + usable.width * .75 - gap * .25), height }
          : stacked ? { x: 0, y: mediaRegion.y - gap * .4, width, height: height - mediaRegion.y + gap * .4 }
          : { x: mediaRegion.x - gap * .5, y: 0, width: width - mediaRegion.x + gap * .5, height })
        : { x: 0, y: 0, width, height }), style: { ...layer.style, radius: 0 } });
    } else if (layer.type === "image") {
      remap.set(layer.id, layer.layout.sizing === "fill"
        ? fillImageCrop(layer, { x: 0, y: 0, width, height })
        : fitImage(layer, { x: 0, y: 0, width, height }));
    }
  }
  // Decorative forms follow the product instead of shrinking into the copy.
  for (const layer of master.layers) {
    if (layer.role !== "decoration" || layer.type !== "shape") continue;
    if (!image) continue;
    const backdropArea = isSmall && !stacked && height <= 160
      ? { x: usable.x + usable.width * .75, y: usable.y, width: usable.width * .25, height: usable.height }
      : mediaRegion;
    const size = Math.max(8, Math.min(backdropArea.width, backdropArea.height) * (mode === "product" ? .88 : mode === "text" ? .72 : .8));
    remap.set(layer.id, { ...layer, geometry: nextGeometry(layer, {
      x: backdropArea.x + (backdropArea.width - size) / 2,
      y: backdropArea.y + (backdropArea.height - size) / 2,
      width: size,
      height: size,
    }), style: { ...layer.style, radius: layer.style.radius ? Math.min(1000, size / 2) : 0 } });
  }
  if (image) remap.set(image.id, image);

  const logo = master.layers.find((layer) => textRole(layer, "logo"));
  const logoImage = master.layers.find((layer): layer is Extract<Layer, { type: "image" }> => layer.type === "image" && layer.role === "logo");
  if (logoImage) remap.set(logoImage.id, fitImage(logoImage, {
    x: textRegion.x, y: textRegion.y + textRegion.height * .04,
    width: textRegion.width * .48, height: Math.max(16, textRegion.height * .15),
  }));
  const headline = master.layers.find((layer) => textRole(layer, "headline"));
  const body = master.layers.find((layer) => textRole(layer, "body"));
  const label = master.layers.find((layer) => layer.type === "text" && layer.role === "decoration" && /label|eyebrow|collection/i.test(layer.name));
  const details = master.layers.filter((layer) => layer.type === "text" && layer.role === "decoration" && layer.id !== label?.id);
  const ctaShape = master.layers.find((layer) => layer.role === "cta" && layer.type === "shape");
  const ctaText = master.layers.find((layer) => textRole(layer, "cta"));

  // Compact displays need specific rules rather than blindly scaling a 1200px master.
  if (isSmall && !stacked && height <= 160) {
    const h = usable.height;
    const logoW = usable.width * .20;
    const imageW = usable.width * .25;
    const headlineW = Math.max(22, usable.width - logoW - imageW - gap * 2);
    if (logo) remap.set(logo.id, fitTypography(logo, { x: usable.x, y: usable.y + h * .1, width: logoW, height: h * .28 }, 17 * scale + 9));
    if (headline) remap.set(headline.id, fitTypography(headline, { x: usable.x + logoW + gap / 2, y: usable.y + h * .14, width: headlineW, height: h * .68 }, Math.min(h * .32, 30)));
    if (image) remap.set(image.id, fitImage(firstImage!, { x: usable.x + usable.width - imageW, y: usable.y, width: imageW, height: h }));
    if (ctaShape || ctaText) {
      const box: Box = { x: usable.x, y: usable.y + h * .73, width: Math.max(48, logoW * 1.3), height: Math.max(12, h * .25) };
      if (ctaShape) remap.set(ctaShape.id, { ...ctaShape, geometry: nextGeometry(ctaShape, box), style: { ...ctaShape.style, radius: box.height / 2 } });
      if (ctaText) remap.set(ctaText.id, fitTypography(ctaText, {
        x: box.x + 5, y: box.y + 2, width: box.width - 10, height: box.height - 4,
      }, 8));
    }
    if (body) remap.set(body.id, body.layout.mandatory
      ? fitTypography(body, { x: usable.x + logoW + gap / 2, y: usable.y + h * .64,
        width: headlineW, height: Math.max(10, h * .3) }, 8)
      : { ...body, visible: false });
    if (label) remap.set(label.id, { ...label, visible: false });
  } else {
    const cw = textRegion.width;
    const ch = textRegion.height;
    const offset = isSmall ? .02 : .04;
    let top = textRegion.y + ch * offset;
    const logoH = ch * (stacked ? .11 : .12);
    if (logo) {
      remap.set(logo.id, fitTypography(logo, { x: textRegion.x, y: top, width: cw * .65, height: logoH }, Math.max(10, Math.min(36, 32 * Math.min(width / master.width, 1)))));
      top += logoH + ch * (stacked ? .045 : .06);
    }
    if (label && !isSmall) {
      const labelH = ch * .06;
      remap.set(label.id, fitTypography(label, { x: textRegion.x, y: top, width: cw, height: labelH }, Math.min(17, Math.max(10, width * .014))));
      top += labelH + ch * .05;
    }
    const ctaRoom = ctaShape || ctaText ? ch * (stacked ? .14 : isSmall ? .18 : .16) : 0;
    const bodyRoom = body && !isSmall ? ch * (mode === "text" ? .15 : stacked ? .15 : .18) : 0;
    const titleSpace = Math.max(20, textRegion.y + ch - top - bodyRoom - ctaRoom - ch * (stacked ? .06 : .1));
    if (headline) {
      const preference = Math.max(11, Math.min(125, 76 * Math.max(.45, Math.min(width / master.width, 1.24)) * (mode === "text" ? 1.28 : mode === "product" ? .64 : 1) * (stacked ? .92 : 1)));
      const title = fitTypography(headline, { x: textRegion.x, y: top, width: cw, height: titleSpace }, preference);
      remap.set(headline.id, title);
      top += titleSpace + ch * .03;
    }
    if (body) {
      if (isSmall && !body.layout.mandatory) remap.set(body.id, { ...body, visible: false });
      else {
        const box = { x: textRegion.x, y: top, width: cw * (stacked ? .98 : .95), height: Math.max(16, bodyRoom) };
        remap.set(body.id, fitTypography(body, box, Math.min(23, Math.max(11, width * .019))));
        top += box.height + ch * .03;
      }
    }
    if (ctaShape || ctaText) {
      const ctaH = Math.min(ch * (stacked ? .11 : .14), stacked ? 62 : 70);
      const ctaW = Math.min(cw * (stacked ? .58 : .86), Math.max(64, width * (stacked ? .2 : .25)));
      const ctaY = Math.min(textRegion.y + ch - ctaH, Math.max(top, textRegion.y + ch * (stacked ? .84 : .78)));
      const ctaBox = { x: textRegion.x, y: ctaY, width: ctaW, height: ctaH };
      if (ctaShape) remap.set(ctaShape.id, { ...ctaShape, geometry: nextGeometry(ctaShape, ctaBox), style: { ...ctaShape.style, radius: ctaH / 2 } });
      if (ctaText) remap.set(ctaText.id, fitTypography(ctaText, { x: ctaBox.x + ctaW * .05, y: ctaY + ctaH * .2, width: ctaW * .9, height: ctaH * .65 }, Math.min(17, Math.max(9, ctaH * .31))));
    }
  }

  for (const detail of details) {
    if (!image || (isSmall && !detail.layout.mandatory)) { remap.set(detail.id, { ...detail, visible: detail.visible && detail.layout.mandatory }); continue; }
    remap.set(detail.id, fitTypography(detail, {
      x: mediaRegion.x + mediaRegion.width * .05,
      y: mediaRegion.y + mediaRegion.height * .89,
      width: mediaRegion.width * .9,
      height: Math.max(16, mediaRegion.height * .06),
    }, Math.min(15, Math.max(9, width * .012))));
  }
  // Unrecognized layer types retain independent deterministic placement.
  const generated: StudioDocument = {
    id: crypto.randomUUID(), width, height, background: master.background, backgroundStyleId: master.backgroundStyleId,
    layers: master.layers.map((layer, zIndex) => {
      const planned = remap.get(layer.id);
      if (planned) return { ...planned, zIndex };
      const scaled = Math.min(width / master.width, height / master.height);
      const g = layer.geometry;
      const proportional = layer.type === "image" || layer.constraints.preserveAspectRatio;
      const fallback: Box = {
        x: keepWithin(g.x * width / master.width, 0, Math.max(0, width - 8)),
        y: keepWithin(g.y * height / master.height, 0, Math.max(0, height - 8)),
        width: g.width * (proportional ? scaled : width / master.width),
        height: g.height * (proportional ? scaled : height / master.height),
      };
      if (layer.type === "text") return { ...fitTypography(layer, fallback, layer.style.fontSize * scaled), zIndex, visible: layer.visible && !(isSmall && !layer.layout.mandatory) };
      if (layer.type === "shape") return { ...layer, zIndex, geometry: nextGeometry(layer, fallback), visible: layer.visible && !(isSmall && !layer.layout.mandatory) };
      return { ...fitImage(layer, fallback), zIndex, visible: layer.visible && !(isSmall && !layer.layout.mandatory) };
    }),
  };
  return refineCompactLayout(generated, zone, mode);
}

/** Grade the *rendered* candidate, not just its template. Used by Auto layout. */
export function scoreComposition(document: StudioDocument, zone: SafeZone): number {
  let score = 100;
  const visible = document.layers.filter((layer) => layer.visible);
  for (const layer of document.layers) {
    if (layer.layout.mandatory && !layer.visible) score -= 75;
  }
  const important = visible.filter((layer) => ["logo", "headline", "body", "product", "cta"].includes(layer.role));
  const content = important.filter((layer) => layer.role !== "cta" || layer.type === "text");
  const inset = { x: zone.left, y: zone.top, right: document.width - zone.right, bottom: document.height - zone.bottom };
  for (const layer of important) {
    const g = layer.geometry;
    const right = g.x + g.width;
    const bottom = g.y + g.height;
    if (g.x < 0 || g.y < 0 || right > document.width || bottom > document.height) score -= 40;
    if (layer.role !== "product" && (g.x < inset.x - 1 || g.y < inset.y - 1 || right > inset.right + 1 || bottom > inset.bottom + 1)) score -= 16;
    if (layer.type === "text") {
      const lines = approximateTextLines(layer.text, g.width, layer.style.fontSize);
      if (lines * layer.style.fontSize * 1.16 > g.height * 1.04) score -= 28;
      if (layer.style.fontSize < 10) score -= 18;
      if (document.height >= 200 && layer.style.fontSize < 13 && layer.role === "headline") score -= 18;
      if (layer.role === "headline") score += Math.min(12, layer.style.fontSize * .13);
    }
  }
  const overlaps = (a: Geometry, b: Geometry) => {
    const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return w * h;
  };
  for (let i = 0; i < content.length; i++) {
    for (let j = i + 1; j < content.length; j++) {
      const a = content[i], b = content[j];
      // Text and button backgrounds are intentionally layered; other primary
      // roles must not collide significantly with the product or each other.
      if (a.role === "cta" && b.role === "cta") continue;
      const area = overlaps(a.geometry, b.geometry);
      const smaller = Math.min(a.geometry.width * a.geometry.height, b.geometry.width * b.geometry.height);
      if (smaller > 0 && area / smaller > .035) score -= 35 * Math.min(1, area / smaller);
    }
  }
  return Math.round(score * 100) / 100;
}

export function generateVariant(master: StudioDocument, preset: FormatPreset, composition: CompositionMode = "auto", flatImage?: FlatImageSettings): Variant {
  return {
    id: crypto.randomUUID(), presetId: preset.id, presetVersion: preset.version,
    platform: preset.platform, name: preset.name, status: "synced",
    strategy: strategyFor(preset.width, preset.height), composition,
    ...(flatSource(master, flatImage) ? { flatImage } : {}),
    safeZone: preset.safeZone,
    document: composeDocument(master, preset.width, preset.height, preset.safeZone, composition, flatImage),
  };
}

export function recomposeVariant(master: StudioDocument, variant: Variant, composition: CompositionMode, flatImage?: FlatImageSettings): Variant {
  return {
    ...variant, composition, status: "synced",
    flatImage: flatSource(master, flatImage) ? flatImage : undefined,
    document: composeDocument(master, variant.document.width, variant.document.height, variant.safeZone, composition, flatImage),
  };
}

export function mergeGeneratedVariants(master: StudioDocument, presets: FormatPreset[], existing: Variant[], composition: CompositionMode = "auto", flatImage?: FlatImageSettings): Variant[] {
  return presets.map((preset) => {
    const current = existing.find((variant) => variant.presetId === preset.id && variant.presetVersion === preset.version);
    // User-customized variants are immutable until the user explicitly approves replacement.
    return current?.status === "customized" ? current : { ...generateVariant(master, preset, composition, flatImage), ...(current ? { id: current.id } : {}) };
  });
}

export function validateVariant(document: StudioDocument, safeZone: SafeZone) {
  const inner = {
    left: safeZone.left, top: safeZone.top,
    right: document.width - safeZone.right, bottom: document.height - safeZone.bottom,
  };
  return document.layers.flatMap((layer) => {
    if (!layer.visible || layer.role === "background" || layer.role === "decoration") return [];
    const { x, y, width, height } = layer.geometry;
    const warnings: string[] = [];
    if (x < inner.left || y < inner.top || x + width > inner.right || y + height > inner.bottom)
      warnings.push(`${layer.name}: outside safe zone`);
    if (layer.type === "text" && layer.style.fontSize < 10) warnings.push(`${layer.name}: text below 10 px`);
    return warnings;
  });
}
