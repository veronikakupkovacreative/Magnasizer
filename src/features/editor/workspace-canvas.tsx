"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import {
  Group, Image as KonvaImage, Layer as KonvaLayer, Line, Rect, Stage, Text, Transformer,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Asset, AssetBlobs, Layer, Project } from "@/shared/schema/project";
import { usePreferences } from "@/components/preferences";
import { ErrorNotice, LoadingState } from "@/components/studio-chrome";
import { Button } from "@/components/ui/button";
import { clamp, resizeGeometry } from "./model/geometry";
import { intersects, layerBounds, snapMove, type Bounds, type Guide } from "./model/snapping";
import { layoutArtboards, fitWorkspace, type WorkspaceBoard } from "./model/workspace-layout";
import { TextEditor } from "./text-editor";
import { snapArtboardPosition } from "./model/artboard-snap";
import { loadProjectFonts } from "@/features/assets/fonts";
import { transformControlsMode, transformHandlePixels, transformerCornerOnly } from "./model/transformer-controls";
import { commitGroupTransform, selectedGroupBounds, translateGroup } from "./model/group-transform";

const MIN_ZOOM = 0.04;
const MAX_ZOOM = 2;

type Props = {
  project: Project;
  activeVariantId: string | null;
  activate: (id: string | null) => void;
  assets: Asset[];
  blobs: AssetBlobs;
  selectedIds: string[];
  select: (id: string | null, toggle?: boolean, individual?: boolean) => void;
  selectMany: (ids: string[]) => void;
  updateMany: (layers: Layer[]) => void;
  snapping: boolean;
  editingId: string | null;
  editText: (id: string | null) => void;
  onDraftDirty: (dirty: boolean) => void;
  viewReset: number;
  focusRequest: { key: string; sequence: number } | null;
  moveArtboard: (key: string, position: { x: number; y: number }) => void;
  groupLayers: (ids: string[]) => void;
  ungroupLayers: (id: string) => void;
  duplicateLayers: (ids: string[]) => void;
  deleteLayers: (ids: string[]) => void;
};

type DragState = { boardKey: string; ids: string[]; source: Layer; initial: Layer[]; dx: number; dy: number };
type MarqueeStart = { boardKey: string; x: number; y: number; ids: string[] };

const nodeId = (board: WorkspaceBoard, layer: Layer) => `layer-${board.key}-${layer.id}`;

export default function WorkspaceCanvas({
  project, activeVariantId, activate, assets, blobs, selectedIds, select,
  selectMany, updateMany, snapping, editingId, editText, onDraftDirty,
  viewReset, focusRequest, moveArtboard, groupLayers, ungroupLayers, duplicateLayers, deleteLayers,
}: Props) {
  const { t, prefs, setPrefs } = usePreferences();
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [resources, setResources] = useState<Record<string, HTMLImageElement> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [space, setSpace] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<{ boardKey: string; rect: Bounds } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; boardKey: string; layerId: string; ids: string[]; groupId?: string;
  } | null>(null);
  const marqueeStart = useRef<MarqueeStart | null>(null);
  const drag = useRef<DragState | null>(null);
  const [boardDraft, setBoardDraft] = useState<{ key: string; x: number; y: number } | null>(null);
  const boardPointer = useRef<{ key: string; startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const baseLayout = useMemo(() => layoutArtboards(project, t("master")), [project, t]);
  const autoLayout = useMemo(() => layoutArtboards({ ...project, workspacePositions: undefined }, t("master")), [project, t]);
  const layout = useMemo(() => {
    if (!boardDraft) return baseLayout;
    const boards = baseLayout.boards.map((board) => board.key === boardDraft.key ? { ...board, x: boardDraft.x, y: boardDraft.y } : board);
    return { boards, width: Math.max(...boards.map((board) => board.x + board.document.width)), height: Math.max(...boards.map((board) => board.y + board.document.height)) };
  }, [baseLayout, boardDraft]);
  const activeKey = activeVariantId ?? "master";
  const activeBoard = layout.boards.find((board) => board.key === activeKey) ?? layout.boards[0];
  const zoom = prefs.zoom ?? fitWorkspace(layout, size);
  const origin = {
    x: Math.round((size.width - autoLayout.width * zoom) / 2),
    y: Math.round((size.height - autoLayout.height * zoom) / 2),
  };
  const selected = activeBoard.document.layers.filter(
    (layer) => selectedIds.includes(layer.id) && layer.visible && !layer.locked,
  );
  const editing = activeBoard.document.layers.find(
    (layer) => layer.id === editingId && layer.type === "text" && layer.visible && !layer.locked,
  );
  const controlsMode = transformControlsMode(zoom, selected.length, Boolean(editing));
  const groupBounds = selectedGroupBounds(selected);

  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) => {
      setSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    const load = async () => {
      await Promise.all(["400", "600", "700"].map((w) => document.fonts.load(`${w} 20px "Inter Variable"`)));
      await loadProjectFonts(assets, blobs);
      const images = await Promise.all(assets.filter((asset) => asset.kind !== "imported-font").map((asset) => new Promise<[string, HTMLImageElement]>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve([asset.id, image]);
        image.onerror = reject;
        if (asset.kind === "bundled-image") image.src = asset.src;
        else {
          const blob = blobs[asset.renderKey];
          if (!blob) { reject(new Error("missingAsset")); return; }
          const url = URL.createObjectURL(blob);
          urls.push(url);
          image.src = url;
        }
      })));
      if (live) { setResources(Object.fromEntries(images)); setLoadError(false); }
    };
    void load().catch(() => { if (live) setLoadError(true); });
    return () => { live = false; urls.forEach(URL.revokeObjectURL); };
  }, [assets, blobs]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && contextMenuRef.current?.contains(event.target)) return;
      setContextMenu(null);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setContextMenu(null); event.stopPropagation(); }
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeEscape, true);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeEscape, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const nodes = editing ? [] : selected.flatMap((layer) => {
      const node = stage.current?.findOne(`#${nodeId(activeBoard, layer)}`);
      return node ? [node] : [];
    });
    transformer.current?.nodes(nodes);
  }, [activeBoard, selected, editing, zoom, resources, size]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, button, dialog, [role="alertdialog"], [contenteditable]'))) {
        event.preventDefault();
        setSpace(true);
      }
    };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpace(false); };
    const blur = () => setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    if (!focusRequest || !size.width || !size.height) return;
    const board = layout.boards.find((item) => item.key === focusRequest.key);
    if (!board) return;
    const nextZoom = clamp(Math.min(
      (size.width - 100) / board.document.width,
      (size.height - 130) / board.document.height,
      1.5,
    ), MIN_ZOOM, MAX_ZOOM);
    const nextOrigin = {
      x: Math.round((size.width - autoLayout.width * nextZoom) / 2),
      y: Math.round((size.height - autoLayout.height * nextZoom) / 2),
    };
    setPan({
      x: size.width / 2 - nextOrigin.x - (board.x + board.document.width / 2) * nextZoom,
      y: size.height / 2 - nextOrigin.y - (board.y + board.document.height / 2) * nextZoom,
    });
    setPrefs({ zoom: nextZoom });
    // Only a user-issued focus request should change viewport; document edits do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.sequence]);

  const localPoint = (board: WorkspaceBoard) => {
    const p = stage.current?.getPointerPosition();
    return p ? {
      x: (p.x - origin.x - pan.x) / zoom - board.x,
      y: (p.y - origin.y - pan.y) / zoom - board.y,
    } : null;
  };

  const startMarquee = (event: KonvaEventObject<MouseEvent | TouchEvent>, board: WorkspaceBoard) => {
    if (space || editingId) return;
    const p = localPoint(board);
    if (!p) return;
    const additive = "shiftKey" in event.evt && (event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey);
    activate(board.id);
    marqueeStart.current = { boardKey: board.key, x: p.x, y: p.y, ids: additive && board.key === activeKey ? selectedIds : [] };
    setMarquee({ boardKey: board.key, rect: { ...p, width: 0, height: 0 } });
    if (!additive) select(null);
  };
  const endMarquee = () => {
    const start = marqueeStart.current;
    if (marquee && start && (marquee.rect.width > 2 / zoom || marquee.rect.height > 2 / zoom)) {
      const board = layout.boards.find((item) => item.key === start.boardKey);
      if (board) {
        selectMany([...new Set([...start.ids, ...board.document.layers.filter(
          (layer) => layer.visible && !layer.locked && intersects(marquee.rect, layerBounds(layer.geometry)),
        ).map((layer) => layer.id)])]);
      }
    }
    marqueeStart.current = null;
    setMarquee(null);
  };

  const zoomAt = (nextZoom: number, pointer?: { x: number; y: number }) => {
    const value = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const p = pointer ?? { x: size.width / 2, y: size.height / 2 };
    const wx = (p.x - origin.x - pan.x) / zoom;
    const wy = (p.y - origin.y - pan.y) / zoom;
    const nextOrigin = {
      x: Math.round((size.width - autoLayout.width * value) / 2),
      y: Math.round((size.height - autoLayout.height * value) / 2),
    };
    setPan({ x: p.x - nextOrigin.x - wx * value, y: p.y - nextOrigin.y - wy * value });
    setPrefs({ zoom: value });
  };
  const fitAll = () => { setPrefs({ zoom: null }); setPan({ x: 0, y: 0 }); };

  const finishTransform = () => {
    const next = selected.map((layer) => {
      const node = stage.current?.findOne(`#${nodeId(activeBoard, layer)}`);
      if (!node) return layer;
      const updated = commitGroupTransform(layer, {
        x: node.x(), y: node.y(),
        width: node.width() * node.scaleX(), height: node.height() * node.scaleY(),
      }, selected.length > 1);
      node.scale({ x: 1, y: 1 });
      node.width(updated.geometry.width);
      node.height(updated.geometry.height);
      return updated;
    });
    if (next.length) updateMany(next);
    transformer.current?.forceUpdate();
  };

  const showLayerMenu = (event: KonvaEventObject<MouseEvent>, board: WorkspaceBoard, layer: Layer) => {
    event.evt.preventDefault();
    event.cancelBubble = true;
    if (layer.locked || !layer.visible || editingId) return;
    const rect = host.current?.getBoundingClientRect();
    if (!rect) return;
    if (board.key !== activeKey) activate(board.id);
    const alreadySelected = board.key === activeKey && selectedIds.includes(layer.id);
    const ids = alreadySelected
      ? selectedIds
      : layer.groupId
        ? board.document.layers.filter((member) => member.groupId === layer.groupId && !member.locked).map((member) => member.id)
        : [layer.id];
    if (!alreadySelected) select(layer.id);
    setContextMenu({
      x: Math.min(Math.max(8, event.evt.clientX - rect.left), Math.max(8, size.width - 230)),
      y: Math.min(Math.max(8, event.evt.clientY - rect.top), Math.max(8, size.height - 275)),
      boardKey: board.key, layerId: layer.id, ids, groupId: layer.groupId,
    });
  };

  return (
    <div
      className={`canvas-host workspace-host ${space ? "is-panning" : ""}`}
      ref={host}
      tabIndex={0}
      aria-label={t("canvasLabel")}
      data-testid="canvas-host"
      data-zoom={zoom}
      data-origin-x={origin.x + pan.x}
      data-origin-y={origin.y + pan.y}
      data-view-reset={viewReset}
      data-artboard-count={layout.boards.length}
      data-transform-controls={controlsMode}
      data-studio-version="0.7.2"
    >
      {loadError ? (
        <ErrorNotice action={<Button onClick={() => window.location.reload()}>{t("reload")}</Button>}>{t("fontError")}</ErrorNotice>
      ) : !resources || !size.width ? <LoadingState canvas /> : <>
        {layout.boards.map((board) => (
          <button
            key={board.key}
            type="button"
            data-testid={`artboard-label-${board.key}`}
            className={`workspace-artboard-label ${board.key === activeKey ? "is-active" : ""}`}
            style={{
              left: origin.x + pan.x + board.x * zoom,
              top: origin.y + pan.y + board.y * zoom - 28,
              maxWidth: Math.max(20, board.document.width * zoom),
            }}
            title={`${board.name} · ${board.document.width} × ${board.document.height}`}
            aria-label={`${board.name} · ${board.document.width} × ${board.document.height}`}
            onPointerDown={(event) => {
              if (event.button !== 0 || editingId || space) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              boardPointer.current = { key: board.key, startX: event.clientX, startY: event.clientY, x: board.x, y: board.y, moved: false };
              activate(board.id);
              if (prefs.zoom === null) setPrefs({ zoom });
            }}
            onPointerMove={(event) => {
              const start = boardPointer.current;
              if (!start || start.key !== board.key) return;
              if (Math.hypot(event.clientX - start.startX, event.clientY - start.startY) > 4) start.moved = true;
              if (!start.moved) return;
              const proposed = { x: Math.max(0, start.x + (event.clientX - start.startX) / zoom),
                y: Math.max(0, start.y + (event.clientY - start.startY) / zoom) };
              const next = snapArtboardPosition(board, proposed, baseLayout.boards, zoom, snapping && !event.altKey);
              setBoardDraft({ key: board.key, x: Math.min(16000, Math.round(next.x)), y: Math.min(16000, Math.round(next.y)) });
            }}
            onPointerUp={(event) => {
              const start = boardPointer.current;
              if (!start || start.key !== board.key) return;
              boardPointer.current = null;
              if (start.moved && boardDraft?.key === board.key) moveArtboard(board.key, boardDraft);
              setBoardDraft(null);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { boardPointer.current = null; setBoardDraft(null); }}
            onClick={() => activate(board.id)}
            onDoubleClick={() => {
              activate(board.id);
              const nextZoom = clamp(Math.min((size.width - 100) / board.document.width,
                (size.height - 130) / board.document.height, 1.5), MIN_ZOOM, MAX_ZOOM);
              const nextOriginX = Math.round((size.width - autoLayout.width * nextZoom) / 2);
              const nextOriginY = Math.round((size.height - autoLayout.height * nextZoom) / 2);
              setPan({
                x: size.width / 2 - nextOriginX - (board.x + board.document.width / 2) * nextZoom,
                y: size.height / 2 - nextOriginY - (board.y + board.document.height / 2) * nextZoom,
              });
              setPrefs({ zoom: nextZoom });
            }}
          >
            <span className={`workspace-status-dot ${board.status}`} />
            <strong>{board.name}</strong>
            {(board.document.width * zoom > 260) &&
              <span>{board.document.width} × {board.document.height}</span>}
          </button>
        ))}
        <Stage
          ref={stage}
          width={size.width}
          height={size.height}
          x={origin.x + pan.x}
          y={origin.y + pan.y}
          scaleX={zoom}
          scaleY={zoom}
          draggable={space && !editingId}
          onDragEnd={(event) => {
            if (event.target === stage.current) {
              setPan({ x: event.target.x() - origin.x, y: event.target.y() - origin.y });
            }
          }}
          onMouseDown={(event) => {
            if (event.target === stage.current && !space) select(null);
            host.current?.focus();
          }}
          onMouseMove={() => {
            const start = marqueeStart.current;
            if (!start) return;
            const board = layout.boards.find((item) => item.key === start.boardKey);
            if (!board) return;
            const p = localPoint(board);
            if (p) setMarquee({ boardKey: board.key, rect: {
              x: Math.min(p.x, start.x), y: Math.min(p.y, start.y),
              width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y),
            } });
          }}
          onMouseUp={endMarquee}
          onTouchEnd={endMarquee}
          onMouseLeave={endMarquee}
          onWheel={(event) => {
            event.evt.preventDefault();
            if (editingId) return;
            if (event.evt.ctrlKey || event.evt.metaKey) {
              zoomAt(zoom * (event.evt.deltaY > 0 ? 0.92 : 1.08), stage.current?.getPointerPosition() ?? undefined);
            } else {
              setPan((previous) => ({ x: previous.x - event.evt.deltaX, y: previous.y - event.evt.deltaY }));
            }
          }}
        >
          <KonvaLayer>
            {layout.boards.map((board) => {
              const doc = board.document;
              const isActive = board.key === activeKey;
              return (
                <Group key={board.key} x={board.x} y={board.y}>
                  <Rect
                    name="artboard"
                    width={doc.width}
                    height={doc.height}
                    fill={doc.background}
                    stroke={isActive ? "#A78BFA" : "#838897"}
                    strokeWidth={(isActive ? 2.5 : 0.6) / zoom}
                    shadowColor="#000"
                    shadowBlur={16 / zoom}
                    shadowOpacity={0.16}
                    shadowOffsetY={7 / zoom}
                    onMouseDown={(event) => startMarquee(event, board)}
                    onTouchStart={(event) => startMarquee(event, board)}
                    onClick={() => activate(board.id)}
                    onTap={() => activate(board.id)}
                  />
                  <Group clipX={0} clipY={0} clipWidth={doc.width} clipHeight={doc.height}>
                    {doc.layers.filter((layer) => layer.visible).map((layer) => {
                      const shared = {
                        id: nodeId(board, layer),
                        ...layer.geometry,
                        draggable: !layer.locked && !space && !editingId,
                        listening: !layer.locked && !editingId,
                        onClick: (event: KonvaEventObject<MouseEvent>) => {
                          if (space) return;
                          // macOS Control-click is the context-menu gesture, not a multi-select toggle.
                          if (event.evt.ctrlKey && !event.evt.metaKey && !event.evt.shiftKey && /Mac|iPad/i.test(navigator.platform)) return;
                          const toggle = board.key === activeKey && (event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey);
                          if (!isActive) activate(board.id);
                          select(layer.id, toggle, event.evt.altKey);
                        },
                        onTap: () => { if (!isActive) activate(board.id); select(layer.id); },
                        onDblClick: (event: KonvaEventObject<MouseEvent>) => {
                          event.cancelBubble = true;
                          if (!isActive) activate(board.id);
                          // Double click drills into a group without relying on a hidden modifier.
                          select(layer.id, false, Boolean(layer.groupId));
                          if (layer.type === "text" && !layer.locked) editText(layer.id);
                        },
                        onDblTap: () => {
                          if (!isActive) activate(board.id);
                          select(layer.id, false, Boolean(layer.groupId));
                          if (layer.type === "text" && !layer.locked) editText(layer.id);
                        },
                        onContextMenu: (event: KonvaEventObject<MouseEvent>) => showLayerMenu(event, board, layer),
                        onDragStart: (event: KonvaEventObject<DragEvent>) => {
                          event.cancelBubble = true;
                          const isIndividualSelection = selectedIds.length === 1 && selectedIds[0] === layer.id;
                          const groupIds = layer.groupId && !isIndividualSelection
                            ? doc.layers.filter((item) => item.groupId === layer.groupId && item.visible && !item.locked).map((item) => item.id)
                            : [layer.id];
                          const ids = isActive && selectedIds.includes(layer.id)
                            ? selected.map((item) => item.id)
                            : groupIds;
                          if (!isActive) activate(board.id);
                          if (!selectedIds.includes(layer.id) || !isActive) select(layer.id);
                          drag.current = {
                            boardKey: board.key, ids, source: layer,
                            initial: doc.layers.filter((item) => ids.includes(item.id)), dx: 0, dy: 0,
                          };
                        },
                        onDragMove: (event: KonvaEventObject<DragEvent>) => {
                          event.cancelBubble = true;
                          const state = drag.current;
                          if (!state || state.boardKey !== board.key) return;
                          let dx = event.target.x() - state.source.geometry.x;
                          let dy = event.target.y() - state.source.geometry.y;
                          if (snapping && !event.evt.altKey) {
                            const result = snapMove(doc, state.ids, dx, dy, zoom);
                            dx = result.dx; dy = result.dy;
                            setGuides(result.guides);
                          } else setGuides([]);
                          state.dx = dx; state.dy = dy;
                          translateGroup(state.initial, dx, dy).forEach((item) => {
                            stage.current?.findOne(`#${nodeId(board, item)}`)?.position({
                              x: item.geometry.x, y: item.geometry.y,
                            });
                            stage.current?.findOne(`#selection-outline-${board.key}-${item.id}`)?.position({
                              x: item.geometry.x, y: item.geometry.y,
                            });
                          });
                          const groupOutline = stage.current?.findOne(`#selection-group-${board.key}`);
                          const initialBounds = selectedGroupBounds(state.initial);
                          if (groupOutline && initialBounds) groupOutline.position({
                            x: initialBounds.x + dx, y: initialBounds.y + dy,
                          });
                        },
                        onDragEnd: (event: KonvaEventObject<DragEvent>) => {
                          event.cancelBubble = true;
                          const state = drag.current;
                          if (!state || state.boardKey !== board.key) return;
                          // Commit the entire group from one immutable starting snapshot.
                          // This avoids child nodes drifting or being overwritten by React renders.
                          updateMany(translateGroup(state.initial, state.dx, state.dy));
                          drag.current = null;
                          setGuides([]);
                        },
                      };
                      if (layer.type === "shape") return (
                        <Rect key={layer.id} {...shared} fill={layer.style.fill} cornerRadius={layer.style.radius} />
                      );
                      if (layer.type === "text") return (
                        <Text
                          key={layer.id} {...shared}
                          visible={!(isActive && editing?.id === layer.id)}
                          text={layer.text}
                          fill={layer.style.fill}
                          fontFamily={layer.style.fontFamily}
                          fontSize={layer.style.fontSize}
                          fontStyle={layer.style.fontWeight}
                          align={layer.style.align}
                          lineHeight={1.1}
                          wrap="word"
                          onTransform={(event) => {
                            if (selected.length > 1) return; // Multi-layer transform is committed together at the end.
                            const node = event.target as Konva.Text;
                            const width = clamp(node.width() * node.scaleX(), layer.constraints.minWidth, 8192);
                            const height = clamp(node.height() * node.scaleY(), layer.constraints.minHeight, 8192);
                            // Resize the text box and wrap lines; never scale the font glyphs.
                            node.scale({ x: 1, y: 1 });
                            node.width(width); node.height(height);
                          }}
                        />
                      );
                      const image = resources[layer.assetId];
                      return (
                        <KonvaImage
                          key={layer.id} {...shared} image={image} opacity={layer.style.opacity}
                          crop={image ? {
                            x: layer.crop.x * image.naturalWidth,
                            y: layer.crop.y * image.naturalHeight,
                            width: layer.crop.width * image.naturalWidth,
                            height: layer.crop.height * image.naturalHeight,
                          } : undefined}
                        />
                      );
                    })}
                  </Group>
                  {isActive && board.safeZone && (
                    <Rect
                      x={board.safeZone.left} y={board.safeZone.top}
                      width={Math.max(0, doc.width - board.safeZone.left - board.safeZone.right)}
                      height={Math.max(0, doc.height - board.safeZone.top - board.safeZone.bottom)}
                      stroke="#F59E0B" strokeWidth={1 / zoom} dash={[8 / zoom, 6 / zoom]}
                      opacity={0.9} listening={false}
                    />
                  )}
                  {isActive && guides.map((guide, index) => (
                    <Line
                      key={index}
                      points={guide.axis === "x"
                        ? [guide.value, -40 / zoom, guide.value, doc.height + 40 / zoom]
                        : [-40 / zoom, guide.value, doc.width + 40 / zoom, guide.value]}
                      stroke="#A78BFA" strokeWidth={1 / zoom}
                      dash={[4 / zoom, 3 / zoom]} listening={false}
                    />
                  ))}
                  {marquee?.boardKey === board.key && <Rect {...marquee.rect}
                    fill="rgba(167,139,250,0.12)" stroke="#A78BFA" strokeWidth={1 / zoom} listening={false} />}
                  {isActive && controlsMode === "outline" && groupBounds && (
                    <Rect
                      id={`selection-group-${board.key}`}
                      {...groupBounds}
                      stroke="#9775ED"
                      strokeWidth={1 / zoom}
                      dash={[4 / zoom, 3 / zoom]}
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                  )}
                  {isActive && controlsMode === "outline" && !groupBounds && selected.map((layer) => (
                    <Rect
                      key={`selection-outline-${layer.id}`}
                      id={`selection-outline-${board.key}-${layer.id}`}
                      x={layer.geometry.x}
                      y={layer.geometry.y}
                      width={layer.geometry.width}
                      height={layer.geometry.height}
                      rotation={layer.geometry.rotation}
                      stroke="#9775ED"
                      strokeWidth={1 / zoom}
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                  ))}
                  {isActive && controlsMode === "handles" && (
                    <Transformer
                      ref={transformer}
                      rotateEnabled={false}
                      flipEnabled={false}
                      keepRatio={selected.length > 1 || !!selected[0]?.constraints.preserveAspectRatio}
                      enabledAnchors={transformerCornerOnly(zoom, selected.length > 1 || !!selected[0]?.constraints.preserveAspectRatio)
                        ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                        : ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]}
                      onTransformEnd={finishTransform}
                      borderStroke="#9775ED" borderStrokeWidth={1 / zoom}
                      anchorFill="#FFFFFF" anchorStroke="#8060D0"
                      anchorSize={transformHandlePixels(zoom) / zoom}
                      anchorStrokeWidth={0.8 / zoom}
                      anchorCornerRadius={0.65 / zoom}
                      boundBoxFunc={(oldBox, nextBox) => {
                        const ratio = Math.min(Math.abs(nextBox.width / oldBox.width), Math.abs(nextBox.height / oldBox.height));
                        return nextBox.width < 8 * zoom || nextBox.height < 8 * zoom ||
                          nextBox.width > 8192 * zoom || nextBox.height > 8192 * zoom ||
                          selected.some((layer) => layer.geometry.width * ratio < layer.constraints.minWidth ||
                            layer.geometry.height * ratio < layer.constraints.minHeight)
                          ? oldBox : nextBox;
                      }}
                    />
                  )}
                </Group>
              );
            })}
          </KonvaLayer>
        </Stage>
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="canvas-context-menu"
            role="menu"
            aria-label={t("contextActions")}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="canvas-menu-heading">{activeBoard.document.layers.find((item) => item.id === contextMenu.layerId)?.name ?? t("layers")}</div>
            <button role="menuitem" onClick={() => { select(contextMenu.layerId, false, true); setContextMenu(null); }}>
              {t("editIndividualLayer")}
            </button>
            {contextMenu.groupId && <button role="menuitem" onClick={() => { select(contextMenu.layerId); setContextMenu(null); }}>{t("selectWholeGroup")}</button>}
            {contextMenu.groupId && <button role="menuitem" onClick={() => { ungroupLayers(contextMenu.layerId); setContextMenu(null); }}>{t("ungroupLayers")}<span>⇧⌘G</span></button>}
            {!contextMenu.groupId && contextMenu.ids.length >= 2 && <button role="menuitem" onClick={() => { groupLayers(contextMenu.ids); setContextMenu(null); }}>{t("groupLayers")}<span>⌘G</span></button>}
            <div className="canvas-menu-divider" />
            <button role="menuitem" onClick={() => { duplicateLayers(contextMenu.ids); setContextMenu(null); }}>{t("duplicate")}</button>
            <button role="menuitem" className="is-danger" onClick={() => { deleteLayers(contextMenu.ids); setContextMenu(null); }}>{t("delete")}</button>
          </div>
        )}
        {groupBounds && !editingId && (
          <div className="group-edit-tip" role="status">
            {t("groupEditingTip")}
          </div>
        )}
        {editing?.type === "text" && <TextEditor
          key={`${activeKey}-${editing.id}`}
          layer={editing}
          zoom={zoom}
          origin={{
            x: origin.x + pan.x + activeBoard.x * zoom,
            y: origin.y + pan.y + activeBoard.y * zoom,
          }}
          onDirty={onDraftDirty}
          cancel={() => { editText(null); host.current?.focus(); }}
          commit={(layer) => { updateMany([layer]); editText(null); host.current?.focus(); }}
        />}
        {layout.boards.length === 1 && activeBoard.document.layers.filter((layer) => layer.visible).length === 0 && (
          <div className="canvas-empty" aria-hidden="true" style={{
            left: origin.x + pan.x + activeBoard.document.width * zoom / 2,
            top: origin.y + pan.y + activeBoard.document.height * zoom / 2,
          }}><strong>{t("emptyCanvas")}</strong><span>{t("emptyCanvasText")}</span></div>
        )}
        <div className="zoom-controls">
          <Button variant="ghost" size="icon" aria-label={t("zoomOut")}
            disabled={zoom <= MIN_ZOOM} onClick={() => zoomAt(zoom / 1.2)}>−</Button>
          <select aria-label={t("zoom")}
            value={prefs.zoom === null ? "fit" : String(zoom)}
            onChange={(event) => event.target.value === "fit" ? fitAll() : zoomAt(Number(event.target.value))}
          >
            {prefs.zoom !== null && ![0.1, 0.25, 0.5, 0.75, 1, 1.5, 2].includes(zoom) &&
              <option value={zoom}>{Math.round(zoom * 100)}%</option>}
            <option value="fit">{t("fit")} ({Math.round(fitWorkspace(layout, size) * 100)}%)</option>
            {[0.1, 0.25, 0.5, 0.75, 1, 1.5, 2].map((value) =>
              <option key={value} value={value}>{value * 100}%</option>)}
          </select>
          <Button variant="ghost" size="icon" aria-label={t("zoomIn")}
            disabled={zoom >= MAX_ZOOM} onClick={() => zoomAt(zoom * 1.2)}>+</Button>
          <span className="toolbar-divider" />
          <Button variant="ghost" onClick={fitAll} aria-label={t("fitCanvas")}>{t("fit")}</Button>
          <Button variant="ghost" onClick={() => zoomAt(1)} aria-label="100%">100%</Button>
        </div>
      </>}
    </div>
  );
}
