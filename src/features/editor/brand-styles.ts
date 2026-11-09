import type { BrandKit, Layer, Project, StudioDocument } from "@/shared/schema/project";

export const emptyBrandKit = (): BrandKit => ({ colors: [], textStyles: [] });
const kit = (project: Project) => project.brandKit ?? emptyBrandKit();

function mapDocuments(project: Project, fn: (document: StudioDocument, isMaster: boolean) => StudioDocument): Project {
  return {
    ...project,
    document: fn(project.document, true),
    variants: project.variants.map((variant) => ({
      ...variant,
      document: fn(variant.document, false),
    })),
  };
}

export function addBrandColor(project: Project, item: BrandKit["colors"][number]): Project {
  const current = kit(project);
  if (current.colors.some((color) => color.id === item.id) || current.colors.length >= 60) return project;
  return { ...project, brandKit: { ...current, colors: [...current.colors, item] } };
}

export function addBrandTextStyle(project: Project, item: BrandKit["textStyles"][number]): Project {
  const current = kit(project);
  if (current.textStyles.some((style) => style.id === item.id) || current.textStyles.length >= 40) return project;
  return { ...project, brandKit: { ...current, textStyles: [...current.textStyles, item] } };
}

export function updateBrandColor(project: Project, id: string, value: string, name: string): Project {
  const current = kit(project);
  if (!current.colors.some((color) => color.id === id)) return project;
  const updated: Project = { ...project, brandKit: {
    ...current, colors: current.colors.map((color) => color.id === id ? { ...color, name, value } : color),
  }};
  return mapDocuments(updated, (document) => ({
    ...document,
    background: document.backgroundStyleId === id ? value : document.background,
    layers: document.layers.map((layer): Layer => {
      if (layer.colorStyleId !== id || layer.type === "image") return layer;
      return { ...layer, style: { ...layer.style, fill: value } };
    }),
  }));
}

export function updateBrandTextStyle(project: Project, id: string, next: BrandKit["textStyles"][number]): Project {
  const current = kit(project);
  const previous = current.textStyles.find((style) => style.id === id);
  if (!previous) return project;
  const updated: Project = { ...project, brandKit: {
    ...current, textStyles: current.textStyles.map((style) => style.id === id ? next : style),
  }};
  return mapDocuments(updated, (document, isMaster) => ({
    ...document,
    layers: document.layers.map((layer): Layer => {
      if (layer.type !== "text" || layer.textStyleId !== id) return layer;
      const relativeSize = isMaster ? next.fontSize : Math.min(300, Math.max(8, layer.style.fontSize * next.fontSize / previous.fontSize));
      return { ...layer, style: { ...layer.style, fontFamily: next.fontFamily, fontWeight: next.fontWeight, align: next.align, fontSize: Math.round(relativeSize * 100) / 100 } };
    }),
  }));
}

export function deleteBrandColor(project: Project, id: string): Project {
  const current = kit(project);
  return mapDocuments({ ...project, brandKit: { ...current, colors: current.colors.filter((color) => color.id !== id) } }, (document) => ({
    ...document,
    backgroundStyleId: document.backgroundStyleId === id ? undefined : document.backgroundStyleId,
    layers: document.layers.map((layer): Layer => layer.colorStyleId === id ? { ...layer, colorStyleId: undefined } : layer),
  }));
}

export function deleteBrandTextStyle(project: Project, id: string): Project {
  const current = kit(project);
  return mapDocuments({ ...project, brandKit: { ...current, textStyles: current.textStyles.filter((style) => style.id !== id) } }, (document) => ({
    ...document,
    layers: document.layers.map((layer): Layer => layer.type === "text" && layer.textStyleId === id ? { ...layer, textStyleId: undefined } : layer),
  }));
}

export function applyColorStyle(project: Project, variantId: string | null, layerId: string | null, styleId: string | null): Project {
  const color = kit(project).colors.find((style) => style.id === styleId);
  if (styleId && !color) return project;
  const mapDoc = (document: StudioDocument): StudioDocument => {
    if (!layerId) return { ...document, backgroundStyleId: styleId ?? undefined, background: color?.value ?? document.background };
    return { ...document, layers: document.layers.map((layer): Layer => {
      if (layer.id !== layerId || layer.type === "image") return layer;
      return { ...layer, colorStyleId: styleId ?? undefined, style: { ...layer.style, fill: color?.value ?? layer.style.fill } };
    }) };
  };
  if (!variantId) return { ...project, document: mapDoc(project.document) };
  return { ...project, variants: project.variants.map((v) => v.id === variantId ? { ...v, status: "customized" as const, document: mapDoc(v.document) } : v) };
}

export function applyTextStyle(project: Project, variantId: string | null, layerId: string, styleId: string | null): Project {
  const style = kit(project).textStyles.find((item) => item.id === styleId);
  if (styleId && !style) return project;
  const mapDoc = (document: StudioDocument): StudioDocument => ({
    ...document,
    layers: document.layers.map((layer): Layer => {
      if (layer.id !== layerId || layer.type !== "text") return layer;
      return { ...layer, textStyleId: styleId ?? undefined, style: style ? {
        ...layer.style, fontFamily: style.fontFamily, fontWeight: style.fontWeight,
        fontSize: style.fontSize, align: style.align,
      } : layer.style };
    }),
  });
  if (!variantId) return { ...project, document: mapDoc(project.document) };
  return { ...project, variants: project.variants.map((v) => v.id === variantId ? { ...v, status: "customized" as const, document: mapDoc(v.document) } : v) };
}
