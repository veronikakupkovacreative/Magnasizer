import type { Project, SafeZone, StudioDocument } from "@/shared/schema/project";

export type WorkspaceBoard = {
  id: string | null;
  key: string;
  name: string;
  document: StudioDocument;
  safeZone: SafeZone | null;
  status: "master" | "synced" | "customized";
  x: number;
  y: number;
};

export const WORKSPACE_GAP = 168;
export const WORKSPACE_ROW_WIDTH = 3450;

/** Artboards use real document pixels; positions are workspace-only and do not affect export. */
export function layoutArtboards(project: Project, masterLabel = "Master"): {
  boards: WorkspaceBoard[];
  width: number;
  height: number;
} {
  const items = [
    { id: null, key: "master", name: masterLabel, document: project.document, safeZone: null, status: "master" as const },
    ...project.variants.map((variant) => ({
      id: variant.id,
      key: variant.id,
      name: variant.name,
      document: variant.document,
      safeZone: variant.safeZone,
      status: variant.status,
    })),
  ];
  const boards: WorkspaceBoard[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let width = 0;
  for (const item of items) {
    if (x > 0 && x + item.document.width > WORKSPACE_ROW_WIDTH) {
      x = 0;
      y += rowHeight + WORKSPACE_GAP;
      rowHeight = 0;
    }
    const stored = project.workspacePositions?.[item.key];
    const bx = stored?.x ?? x;
    const by = stored?.y ?? y;
    boards.push({ ...item, x: bx, y: by });
    width = Math.max(width, bx + item.document.width);
    rowHeight = Math.max(rowHeight, item.document.height);
    x += item.document.width + WORKSPACE_GAP;
  }
  const height = Math.max(y + rowHeight, ...boards.map((board) => board.y + board.document.height));
  return { boards, width, height };
}

export function fitWorkspace(
  content: { width: number; height: number },
  viewport: { width: number; height: number },
): number {
  if (!viewport.width || !viewport.height) return 0.2;
  return Math.max(
    0.04,
    Math.min(1, (viewport.width - 100) / content.width, (viewport.height - 130) / content.height),
  );
}
