import type { Asset, Layer, ProjectBundle } from "@/shared/schema/project";
export const productAsset: Asset = {
  id: "asset-form-bottle",
  kind: "bundled-image",
  src: "/assets/form-bottle.svg",
  mimeType: "image/svg+xml",
  width: 360,
  height: 520,
};
const base = (
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
) => ({
  id,
  sourceId: id,
  name,
  geometry: { x, y, width, height, rotation: 0 },
  zIndex,
  role: "decoration" as const,
  priority: 50,
  anchor: "top-left" as const,
  constraints: { preserveAspectRatio: false, minWidth: 8, minHeight: 8 },
  locked: false,
  visible: true,
  layout: { sizing: "fixed" as const, mandatory: false, padding: 0 },
});
export function newLayer(type: "text" | "shape", zIndex: number): Layer {
  const id = crypto.randomUUID();
  return type === "text"
    ? {
        ...base(id, "Text", 80, 80, 420, 90, zIndex),
        type,
        text: "Your next big idea.",
        role: "headline",
        style: {
          fill: "#222823",
          fontFamily: "Inter Variable",
          fontSize: 48,
          fontWeight: "700",
          align: "left",
        },
      }
    : {
        ...base(id, "Shape", 120, 160, 240, 180, zIndex),
        type,
        style: { fill: "#C1EE83", radius: 16 },
      };
}
export function createProject(demo: boolean): ProjectBundle {
  const timestamp = new Date().toISOString();
  const textStyle = {
    fill: "#202820",
    fontFamily: "Inter Variable" as const,
    fontWeight: "400" as const,
    align: "left" as const,
  };
  const demoKit = {
    colors: [
      { id: "brand-forest", name: "Forest / Base", value: "#172820" },
      { id: "brand-cream", name: "Warm White", value: "#F2F6EA" },
      { id: "brand-lime", name: "Lime / Accent", value: "#C1E36C" },
      { id: "brand-sage", name: "Sage / Copy", value: "#D6E4D9" },
    ],
    textStyles: [
      { id: "brand-headline", name: "H1 / Display", fontFamily: "Inter Variable", fontSize: 88, fontWeight: "700" as const, align: "left" as const },
      { id: "brand-body", name: "Body / Regular", fontFamily: "Inter Variable", fontSize: 18, fontWeight: "400" as const, align: "left" as const },
      { id: "brand-cta", name: "CTA / Label", fontFamily: "Inter Variable", fontSize: 16, fontWeight: "600" as const, align: "left" as const },
    ],
  };
  const layers: Layer[] = demo
    ? [
        {
          ...base("shape-field", "Forest canvas", 0, 0, 1200, 1200, 0),
          type: "shape",
          style: { fill: "#172820", radius: 0 },
          role: "background",
          colorStyleId: "brand-forest",
          layout: { sizing: "fixed", mandatory: true, padding: 0 },
        },
        {
          ...base("shape-orbit", "Product spotlight", 644, 218, 520, 520, 1),
          type: "shape",
          style: { fill: "#C1E36C", radius: 260 },
          role: "decoration",
          colorStyleId: "brand-lime",
        },
        {
          ...base("text-brand", "FORM wordmark", 76, 74, 260, 56, 2),
          type: "text",
          text: "FORM®",
          role: "logo",
          layout: { sizing: "fixed", mandatory: true, padding: 0 },
          style: { ...textStyle, fill: "#F2F6EA", fontSize: 48, fontWeight: "700" },
        },
        {
          ...base("text-eyebrow", "Collection label", 82, 290, 460, 26, 3),
          type: "text",
          text: "THE EDIT / OBJECTS FOR EVERY DAY",
          role: "decoration",
          style: { ...textStyle, fill: "#C7D5C9", fontSize: 14, fontWeight: "600" },
        },
        {
          ...base("text-headline", "Headline", 70, 350, 470, 250, 4),
          type: "text",
          text: "BETTER.\nBY",
          role: "headline",
          colorStyleId: "brand-cream",
          textStyleId: "brand-headline",
          priority: 100,
          layout: { sizing: "fixed", mandatory: true, padding: 0 },
          style: { ...textStyle, fill: "#F2F6EA", fontSize: 88, fontWeight: "700" },
        },
        {
          ...base("text-body", "Supporting copy", 82, 750, 360, 62, 5),
          type: "text",
          text: "An everyday essential.\nNothing extra. Everything considered.",
          role: "body",
          colorStyleId: "brand-sage",
          textStyleId: "brand-body",
          style: { ...textStyle, fill: "#D6E4D9", fontSize: 18 },
        },
        {
          ...base("shape-cta", "Button background", 78, 870, 360, 72, 6),
          type: "shape",
          role: "cta",
          colorStyleId: "brand-lime",
          style: { fill: "#C1E36C", radius: 36 },
          layout: { sizing: "fixed", mandatory: true, padding: 0 },
        },
        {
          ...base("text-cta", "Button label", 115, 894, 290, 28, 7),
          type: "text",
          text: "EXPLORE THE EDIT ↗",
          role: "cta",
          textStyleId: "brand-cta",
          layout: { sizing: "fixed", mandatory: true, padding: 0 },
          style: {
            ...textStyle,
            fill: "#183025",
            fontSize: 16,
            fontWeight: "600",
          },
        },
        {
          ...base("image-product", "Everyday bottle", 700, 335, 350, 505.56, 8),
          type: "image",
          assetId: productAsset.id,
          crop: { x: 0, y: 0, width: 1, height: 1 },
          role: "product",
          priority: 100,
          layout: { sizing: "scale", mandatory: true, padding: 0 },
          style: { opacity: 1 },
          geometry: { x: 700, y: 335, width: 350, height: 505.56, rotation: 12 },
          constraints: {
            preserveAspectRatio: true,
            minWidth: 36,
            minHeight: 52,
          },
        },
        {
          ...base("text-detail", "Product detail", 708, 1070, 250, 24, 9),
          type: "text",
          text: "750 ML   /   EDITION Nº 01",
          role: "decoration",
          style: { ...textStyle, fill: "#E9F5E7", fontSize: 12, fontWeight: "600" },
        },
      ]
    : [];
  return {
    format: "smart-resize-studio",
    version: 2,
    assets: demo ? [productAsset] : [],
    project: {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      name: demo ? "FORM · Better by design" : "Untitled project",
      owner: "local",
      createdAt: timestamp,
      updatedAt: timestamp,
      document: {
        id: crypto.randomUUID(),
        width: 1200,
        height: 1200,
        background: "#172820",
        ...(demo ? { backgroundStyleId: "brand-forest" } : {}),
        layers,
      },
      variants: [],
      ...(demo ? { brandKit: demoKit } : {}),
    },
  };
}
