"use client";
import { useEffect, useRef, useState } from "react";
import Konva from "konva";
import {
  Group,
  Image as KonvaImage,
  Layer as KonvaLayer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type {
  Asset,
  AssetBlobs,
  Layer,
  SafeZone,
  StudioDocument,
} from "@/shared/schema/project";
import { usePreferences } from "@/components/preferences";
import { ErrorNotice, LoadingState } from "@/components/studio-chrome";
import { Button } from "@/components/ui/button";
import { clamp, fitZoom, resizeGeometry } from "./model/geometry";
import {
  intersects,
  layerBounds,
  snapMove,
  type Bounds,
  type Guide,
} from "./model/snapping";
import { TextEditor } from "./text-editor";

type Props = {
  document: StudioDocument;
  assets: Asset[];
  blobs: AssetBlobs;
  selectedIds: string[];
  select: (id: string | null, toggle?: boolean) => void;
  selectMany: (ids: string[]) => void;
  updateMany: (layers: Layer[]) => void;
  viewReset: number;
  snapping: boolean;
  editingId: string | null;
  editText: (id: string | null) => void;
  onDraftDirty: (dirty: boolean) => void;
  label?: string;
  safeZone?: SafeZone | null;
};
export default function Canvas({
  document: doc,
  assets,
  blobs,
  selectedIds,
  select,
  selectMany,
  updateMany,
  viewReset,
  snapping,
  editingId,
  editText,
  onDraftDirty,
  label,
  safeZone,
}: Props) {
  const { prefs, setPrefs, t } = usePreferences();
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [resources, setResources] = useState<Record<
    string,
    HTMLImageElement
  > | null>(null);
  const [error, setError] = useState(false);
  const [space, setSpace] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const marqueeStart = useRef<{ x: number; y: number; ids: string[] } | null>(
    null,
  );
  const drag = useRef<{ ids: string[]; source: Layer } | null>(null);
  const zoom = prefs.zoom ?? fitZoom(doc, size);
  const selected = doc.layers.filter(
    (l) => selectedIds.includes(l.id) && l.visible && !l.locked,
  );
  const editing = doc.layers.find(
    (l) => l.id === editingId && l.type === "text" && !l.locked && l.visible,
  );
  const origin = {
    x: Math.round((size.width - doc.width * zoom) / 2),
    y: Math.round((size.height - doc.height * zoom) / 2),
  };
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) =>
      setSize({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height,
      }),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    const load = async () => {
      await Promise.all(
        ["400", "600", "700"].map((weight) =>
          document.fonts.load(`${weight} 20px "Inter Variable"`),
        ),
      );
      const entries = await Promise.all(
        assets.filter((asset) => asset.kind !== "imported-font").map(
          (asset) =>
            new Promise<[string, HTMLImageElement]>((resolve, reject) => {
              const image = new window.Image();
              image.onload = () => resolve([asset.id, image]);
              image.onerror = reject;
              if (asset.kind === "bundled-image") image.src = asset.src;
              else {
                if (!blobs[asset.renderKey]) {
                  reject(new Error("missingAsset"));
                  return;
                }
                const url = URL.createObjectURL(blobs[asset.renderKey]);
                urls.push(url);
                image.src = url;
              }
            }),
        ),
      );
      if (active) {
        setResources(Object.fromEntries(entries));
        setError(false);
      }
    };
    void load().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [assets, blobs]);
  useEffect(() => {
    const nodes = editing
      ? []
      : selected.flatMap((layer) => {
          const node = stage.current?.findOne(`#${layer.id}`);
          return node ? [node] : [];
        });
    transformer.current?.nodes(nodes);
  }, [selected, resources, zoom, size, editing]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest(
            'input, textarea, select, button, dialog, [role="alertdialog"], [contenteditable]',
          )
        )
      ) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
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
  const point = () => {
    const p = stage.current?.getPointerPosition();
    return p
      ? {
          x: (p.x - pan.x - origin.x) / zoom,
          y: (p.y - pan.y - origin.y) / zoom,
        }
      : null;
  };
  const startMarquee = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (space || editing) return;
    if (e.target !== stage.current && e.target.name() !== "artboard") return;
    const p = point();
    if (!p) return;
    const additive =
      "shiftKey" in e.evt && (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey);
    marqueeStart.current = { ...p, ids: additive ? selectedIds : [] };
    setMarquee({ ...p, width: 0, height: 0 });
    if (!additive) select(null);
  };
  const endMarquee = () => {
    if (
      marquee &&
      marqueeStart.current &&
      (marquee.width > 2 / zoom || marquee.height > 2 / zoom)
    ) {
      selectMany([
        ...new Set([
          ...marqueeStart.current.ids,
          ...doc.layers
            .filter(
              (l) =>
                l.visible &&
                !l.locked &&
                intersects(marquee, layerBounds(l.geometry)),
            )
            .map((l) => l.id),
        ]),
      ]);
    }
    marqueeStart.current = null;
    setMarquee(null);
  };
  const normalizeTextTransform = (
    node: Konva.Text,
    layer: Extract<Layer, { type: "text" }>,
  ) => {
    const width = clamp(
      node.width() * node.scaleX(),
      layer.constraints.minWidth,
      8192,
    );
    const height = clamp(
      node.height() * node.scaleY(),
      layer.constraints.minHeight,
      8192,
    );
    // A text transform changes only the text box. Font metrics stay at their
    // real size so resizing reflows text instead of stretching glyphs.
    node.scale({ x: 1, y: 1 });
    node.width(width);
    node.height(height);
  };
  const finishTransform = () => {
    const next = selected.map((layer) => {
      const node = stage.current?.findOne(`#${layer.id}`);
      if (!node) return layer;
      const geometry = resizeGeometry(
        layer,
        node.width() * node.scaleX(),
        node.height() * node.scaleY(),
      );
      geometry.x = clamp(node.x(), -16000, 16000);
      geometry.y = clamp(node.y(), -16000, 16000);
      node.scale({ x: 1, y: 1 });
      node.width(geometry.width);
      node.height(geometry.height);
      return { ...layer, geometry };
    });
    updateMany(next);
  };
  return (
    <div
      className={`canvas-host ${space ? "is-panning" : ""}`}
      ref={host}
      tabIndex={0}
      aria-label={t("canvasLabel")}
      data-testid="canvas-host"
      data-zoom={zoom}
      data-origin-x={origin.x + pan.x}
      data-origin-y={origin.y + pan.y}
      data-view-reset={viewReset}
    >
      {error ? (
        <ErrorNotice
          action={
            <Button onClick={() => window.location.reload()}>
              {t("reload")}
            </Button>
          }
        >
          {t("fontError")}
        </ErrorNotice>
      ) : !resources || !size.width ? (
        <LoadingState canvas />
      ) : (
        <>
          <div
            className="artboard-caption"
            style={{ left: origin.x + pan.x, top: origin.y + pan.y - 28 }}
          >
            <strong>{label ?? t("master")}</strong>
            <span>
              {doc.width} × {doc.height}
            </span>
          </div>
          <Stage
            ref={stage}
            width={size.width}
            height={size.height}
            x={pan.x}
            y={pan.y}
            draggable={space && !editing}
            onDragEnd={(e) => {
              if (e.target === stage.current)
                setPan({ x: e.target.x(), y: e.target.y() });
            }}
            onMouseDown={(e) => {
              host.current?.focus();
              startMarquee(e);
            }}
            onTouchStart={startMarquee}
            onMouseMove={() => {
              const p = point(),
                start = marqueeStart.current;
              if (p && start)
                setMarquee({
                  x: Math.min(p.x, start.x),
                  y: Math.min(p.y, start.y),
                  width: Math.abs(p.x - start.x),
                  height: Math.abs(p.y - start.y),
                });
            }}
            onMouseUp={endMarquee}
            onTouchEnd={endMarquee}
            onMouseLeave={endMarquee}
            onWheel={(e) => {
              e.evt.preventDefault();
              if (editing) return;
              if (e.evt.ctrlKey || e.evt.metaKey)
                setPrefs({
                  zoom: clamp(zoom * (e.evt.deltaY > 0 ? 0.92 : 1.08), 0.1, 2),
                });
              else
                setPan((p) => ({
                  x: p.x - e.evt.deltaX,
                  y: p.y - e.evt.deltaY,
                }));
            }}
          >
            <KonvaLayer>
              <Group x={origin.x} y={origin.y} scaleX={zoom} scaleY={zoom}>
                <Rect
                  name="artboard"
                  width={doc.width}
                  height={doc.height}
                  fill={doc.background}
                  shadowColor="#000"
                  shadowBlur={30}
                  shadowOpacity={0.18}
                  shadowOffsetY={8}
                />
                {safeZone && (
                  <Rect
                    x={safeZone.left}
                    y={safeZone.top}
                    width={Math.max(0, doc.width - safeZone.left - safeZone.right)}
                    height={Math.max(0, doc.height - safeZone.top - safeZone.bottom)}
                    stroke="#F59E0B"
                    strokeWidth={1 / zoom}
                    dash={[8 / zoom, 6 / zoom]}
                    opacity={0.9}
                    listening={false}
                  />
                )}
                <Group
                  clipX={0}
                  clipY={0}
                  clipWidth={doc.width}
                  clipHeight={doc.height}
                >
                  {doc.layers
                    .filter((l) => l.visible)
                    .map((layer) => {
                      const shared = {
                        id: layer.id,
                        ...layer.geometry,
                        draggable: !layer.locked && !space && !editing,
                        listening: !layer.locked && !editing,
                        onClick: (e: KonvaEventObject<MouseEvent>) => {
                          if (!space)
                            select(
                              layer.id,
                              e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey,
                            );
                        },
                        onTap: () => select(layer.id),
                        onDblClick: () => {
                          if (layer.type === "text" && !layer.locked) {
                            select(layer.id);
                            editText(layer.id);
                          }
                        },
                        onDblTap: () => {
                          if (layer.type === "text" && !layer.locked) {
                            select(layer.id);
                            editText(layer.id);
                          }
                        },
                        onDragStart: (e: KonvaEventObject<DragEvent>) => {
                          e.cancelBubble = true;
                          const ids = selectedIds.includes(layer.id)
                            ? selected.map((l) => l.id)
                            : [layer.id];
                          if (!selectedIds.includes(layer.id)) select(layer.id);
                          drag.current = { ids, source: layer };
                        },
                        onDragMove: (e: KonvaEventObject<DragEvent>) => {
                          e.cancelBubble = true;
                          const state = drag.current;
                          if (!state) return;
                          let dx = e.target.x() - state.source.geometry.x,
                            dy = e.target.y() - state.source.geometry.y;
                          if (snapping && !e.evt.altKey) {
                            const result = snapMove(
                              doc,
                              state.ids,
                              dx,
                              dy,
                              zoom,
                            );
                            dx = result.dx;
                            dy = result.dy;
                            setGuides(result.guides);
                          } else setGuides([]);
                          doc.layers
                            .filter((l) => state.ids.includes(l.id))
                            .forEach((l) =>
                              stage.current?.findOne(`#${l.id}`)?.position({
                                x: clamp(l.geometry.x + dx, -16000, 16000),
                                y: clamp(l.geometry.y + dy, -16000, 16000),
                              }),
                            );
                        },
                        onDragEnd: (e: KonvaEventObject<DragEvent>) => {
                          e.cancelBubble = true;
                          const state = drag.current;
                          if (!state) return;
                          updateMany(
                            doc.layers
                              .filter((l) => state.ids.includes(l.id))
                              .map((l) => {
                                const node = stage.current?.findOne(`#${l.id}`);
                                return node
                                  ? {
                                      ...l,
                                      geometry: {
                                        ...l.geometry,
                                        x: clamp(node.x(), -16000, 16000),
                                        y: clamp(node.y(), -16000, 16000),
                                      },
                                    }
                                  : l;
                              }),
                          );
                          drag.current = null;
                          setGuides([]);
                        },
                      };
                      if (layer.type === "shape")
                        return (
                          <Rect
                            key={layer.id}
                            {...shared}
                            fill={layer.style.fill}
                            cornerRadius={layer.style.radius}
                          />
                        );
                      if (layer.type === "text")
                        return (
                          <Text
                            key={layer.id}
                            {...shared}
                            visible={editing?.id !== layer.id}
                            text={layer.text}
                            fill={layer.style.fill}
                            fontFamily={layer.style.fontFamily}
                            fontSize={layer.style.fontSize}
                            fontStyle={layer.style.fontWeight}
                            align={layer.style.align}
                            lineHeight={1.1}
                            wrap="word"
                            onTransform={(e) =>
                              normalizeTextTransform(
                                e.target as Konva.Text,
                                layer,
                              )
                            }
                          />
                        );
                      const image = resources[layer.assetId];
                      return (
                        <KonvaImage
                          key={layer.id}
                          {...shared}
                          image={image}
                          opacity={layer.style.opacity}
                          crop={
                            image
                              ? {
                                  x: layer.crop.x * image.naturalWidth,
                                  y: layer.crop.y * image.naturalHeight,
                                  width: layer.crop.width * image.naturalWidth,
                                  height:
                                    layer.crop.height * image.naturalHeight,
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                </Group>
                {guides.map((g, i) => (
                  <Line
                    key={i}
                    points={
                      g.axis === "x"
                        ? [g.value, -40 / zoom, g.value, doc.height + 40 / zoom]
                        : [-40 / zoom, g.value, doc.width + 40 / zoom, g.value]
                    }
                    stroke="#A78BFA"
                    strokeWidth={1 / zoom}
                    dash={[4 / zoom, 3 / zoom]}
                    listening={false}
                  />
                ))}
                {marquee && (
                  <Rect
                    {...marquee}
                    fill="rgba(167,139,250,0.12)"
                    stroke="#A78BFA"
                    strokeWidth={1 / zoom}
                    listening={false}
                  />
                )}
                <Transformer
                  ref={transformer}
                  rotateEnabled={false}
                  flipEnabled={false}
                  keepRatio={
                    selected.length > 1 ||
                    !!selected[0]?.constraints.preserveAspectRatio
                  }
                  enabledAnchors={
                    selected.length > 1 ||
                    selected[0]?.constraints.preserveAspectRatio
                      ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                      : [
                          "top-left",
                          "top-center",
                          "top-right",
                          "middle-left",
                          "middle-right",
                          "bottom-left",
                          "bottom-center",
                          "bottom-right",
                        ]
                  }
                  onTransformEnd={finishTransform}
                  borderStroke="#9775ED"
                  borderStrokeWidth={1 / zoom}
                  anchorFill="#FFFFFF"
                  anchorStroke="#8060D0"
                  anchorSize={7}
                  anchorCornerRadius={1}
                  boundBoxFunc={(oldBox, nextBox) => {
                    const ratio = Math.min(
                      Math.abs(nextBox.width / oldBox.width),
                      Math.abs(nextBox.height / oldBox.height),
                    );
                    return nextBox.width < 8 * zoom ||
                      nextBox.height < 8 * zoom ||
                      nextBox.width > 8192 * zoom ||
                      nextBox.height > 8192 * zoom ||
                      selected.some(
                        (l) =>
                          l.geometry.width * ratio < l.constraints.minWidth ||
                          l.geometry.height * ratio < l.constraints.minHeight,
                      )
                      ? oldBox
                      : nextBox;
                  }}
                />
              </Group>
            </KonvaLayer>
          </Stage>
          {editing?.type === "text" && (
            <TextEditor
              key={editing.id}
              layer={editing}
              zoom={zoom}
              origin={{ x: origin.x + pan.x, y: origin.y + pan.y }}
              onDirty={onDraftDirty}
              cancel={() => {
                editText(null);
                host.current?.focus();
              }}
              commit={(layer) => {
                updateMany([layer]);
                editText(null);
                host.current?.focus();
              }}
            />
          )}
          {doc.layers.filter((l) => l.visible).length === 0 && (
            <div
              className="canvas-empty"
              aria-hidden="true"
              style={{
                left: origin.x + pan.x + (doc.width * zoom) / 2,
                top: origin.y + pan.y + (doc.height * zoom) / 2,
              }}
            >
              <strong>{t("emptyCanvas")}</strong>
              <span>{t("emptyCanvasText")}</span>
            </div>
          )}
          <div className="zoom-controls">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("zoomOut")}
              disabled={zoom <= 0.1}
              onClick={() => setPrefs({ zoom: clamp(zoom - 0.1, 0.1, 2) })}
            >
              −
            </Button>
            <select
              aria-label={t("zoom")}
              value={prefs.zoom === null ? "fit" : String(zoom)}
              onChange={(e) =>
                setPrefs({
                  zoom:
                    e.target.value === "fit" ? null : Number(e.target.value),
                })
              }
            >
              {![0.25, 0.5, 0.75, 1, 1.5, 2].includes(zoom) &&
                prefs.zoom !== null && (
                  <option value={zoom}>{Math.round(zoom * 100)}%</option>
                )}
              <option value="fit">
                {t("fit")} ({Math.round(fitZoom(doc, size) * 100)}%)
              </option>
              {[0.25, 0.5, 0.75, 1, 1.5, 2].map((n) => (
                <option key={n} value={n}>
                  {n * 100}%
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("zoomIn")}
              disabled={zoom >= 2}
              onClick={() => setPrefs({ zoom: clamp(zoom + 0.1, 0.1, 2) })}
            >
              +
            </Button>
            <span className="toolbar-divider" />
            <Button
              variant="ghost"
              onClick={() => {
                setPrefs({ zoom: null });
                setPan({ x: 0, y: 0 });
              }}
              aria-label={t("fitCanvas")}
            >
              {t("fit")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
