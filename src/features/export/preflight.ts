import type { Asset, Project, StudioDocument, SafeZone } from "@/shared/schema/project";
export type PreflightIssue = {
  boardKey: string;
  boardName: string;
  layerId: string;
  layerName: string;
  type: "safe-zone" | "artboard-overflow" | "small-text" | "text-overflow" | "missing-asset";
};

export function inspectDocument(document: StudioDocument, zone: SafeZone | null, boardKey: string, boardName: string, assets: Asset[]): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const keys = new Set(assets.map((a) => a.id));
  const area = zone ? { left: zone.left, top: zone.top, right: document.width - zone.right, bottom: document.height - zone.bottom } : null;
  for (const layer of document.layers) {
    if (!layer.visible || layer.role === "background" || layer.role === "decoration") continue;
    const { x, y, width, height } = layer.geometry;
    const add = (type: PreflightIssue["type"]) => issues.push({ boardKey, boardName, layerId: layer.id, layerName: layer.name, type });
    const external = x < 0 || y < 0 || x + width > document.width || y + height > document.height;
    if (external) add("artboard-overflow");
    if (area && (x < area.left || y < area.top || x + width > area.right || y + height > area.bottom)) add("safe-zone");
    if (layer.type === "image" && !keys.has(layer.assetId)) add("missing-asset");
    if (layer.type === "text") {
      if (layer.style.fontSize < 10) add("small-text");
      if (typeof window !== "undefined") {
        const canvas = documentMeasureCanvas();
        const ctx = canvas?.getContext("2d");
        if (ctx) {
          ctx.font = `${layer.style.fontWeight} ${layer.style.fontSize}px "${layer.style.fontFamily}"`;
          const words = layer.text.split("\n");
          let rows = 0;
          for (const paragraph of words) {
            const tokens = paragraph.split(/(\s+)/);
            let line = "";
            rows++;
            for (const token of tokens) {
              if (ctx.measureText(line + token).width <= width || !line) { line += token; continue; }
              rows++;
              line = token.trimStart();
            }
            if (ctx.measureText(line).width > width + 1) rows++;
          }
          if (rows * layer.style.fontSize * 1.1 > height + 1) add("text-overflow");
        }
      }
    }
  }
  return issues;
}
function documentMeasureCanvas(): HTMLCanvasElement | null { return typeof document === "undefined" ? null : document.createElement("canvas"); }
export function inspectProject(project: Project, assets: Asset[]): PreflightIssue[] {
  return [
    ...inspectDocument(project.document, null, "master", "Master", assets),
    ...project.variants.flatMap((variant) => inspectDocument(variant.document, variant.safeZone, variant.id, variant.name, assets)),
  ];
}
