"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Crop as CropIcon, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/preferences";
import {
  FULL_CROP,
  type Asset,
  type AssetBlobs,
  type Crop,
  type Layer,
} from "@/shared/schema/project";
import { useAssetUrl } from "@/features/assets/use-asset-url";
import { constrainCrop } from "./model/crop";

export function CropDialog({
  layer,
  asset,
  blobs,
  close,
  apply,
}: {
  layer: Extract<Layer, { type: "image" }>;
  asset: Extract<Asset, { kind: "bundled-image" | "imported-image" }>;
  blobs: AssetBlobs;
  close: () => void;
  apply: (crop: Crop) => void;
}) {
  const { t } = usePreferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    crop: Crop;
    handle: string;
  } | null>(null);
  const [crop, setCrop] = useState<Crop>(layer.crop);
  const clipId = useId();
  const url = useAssetUrl(asset, blobs);
  const minW = Math.max(
    0.001,
    layer.constraints.minWidth / (layer.geometry.width / layer.crop.width),
  );
  const minH = Math.max(
    0.001,
    layer.constraints.minHeight / (layer.geometry.height / layer.crop.height),
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const imagePoint = (clientX: number, clientY: number) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: point.x / asset.width, y: point.y / asset.height };
  };
  const move = (clientX: number, clientY: number) => {
    const state = drag.current,
      point = imagePoint(clientX, clientY);
    if (!state || !point) return;
    const dx = point.x - state.x,
      dy = point.y - state.y;
    const old = state.crop,
      h = state.handle;
    if (h === "move") {
      setCrop(
        constrainCrop({ ...old, x: old.x + dx, y: old.y + dy }, minW, minH),
      );
      return;
    }
    let left = old.x,
      right = old.x + old.width,
      top = old.y,
      bottom = old.y + old.height;
    if (h.includes("w")) left = Math.min(right - minW, Math.max(0, left + dx));
    if (h.includes("e")) right = Math.max(left + minW, Math.min(1, right + dx));
    if (h.includes("n")) top = Math.min(bottom - minH, Math.max(0, top + dy));
    if (h.includes("s"))
      bottom = Math.max(top + minH, Math.min(1, bottom + dy));
    setCrop(
      constrainCrop(
        { x: left, y: top, width: right - left, height: bottom - top },
        minW,
        minH,
      ),
    );
  };
  const start = (e: React.PointerEvent<SVGElement>, handle: string) => {
    e.preventDefault();
    const point = imagePoint(e.clientX, e.clientY);
    if (!point) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { ...point, crop, handle };
  };
  const px = {
    x: crop.x * asset.width,
    y: crop.y * asset.height,
    width: crop.width * asset.width,
    height: crop.height * asset.height,
  };
  const exceedsLimit =
    (layer.geometry.width / layer.crop.width) * crop.width > 8192 ||
    (layer.geometry.height / layer.crop.height) * crop.height > 8192;
  const handleSize = Math.max(asset.width, asset.height) / 65;
  return (
    <dialog
      ref={dialog}
      className="crop-dialog"
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClose={close}
    >
      <header className="crop-heading">
        <CropIcon size={18} />
        <h2 id="crop-title">{t("cropImage")}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("cancel")}
          onClick={close}
        >
          <X size={18} />
        </Button>
      </header>
      <p className="crop-description">{t("cropDescription")}</p>
      <div className="crop-preview">
        {url && (
          <svg
            ref={svg}
            viewBox={`0 0 ${asset.width} ${asset.height}`}
            style={{ aspectRatio: `${asset.width}/${asset.height}` }}
            aria-label={t("cropBoundary")}
          >
            <defs>
              <clipPath id={clipId}>
                <rect {...px} />
              </clipPath>
            </defs>
            <image
              href={url}
              width={asset.width}
              height={asset.height}
              opacity=".25"
            />
            <image
              href={url}
              width={asset.width}
              height={asset.height}
              clipPath={`url(#${clipId})`}
            />
            <rect
              {...px}
              fill="transparent"
              stroke="#A78BFA"
              strokeWidth={handleSize / 5}
              tabIndex={0}
              role="button"
              aria-label={t("moveCrop")}
              onPointerDown={(e) => start(e, "move")}
              onPointerMove={(e) => move(e.clientX, e.clientY)}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onKeyDown={(e) => {
                if (
                  !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                )
                  return;
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                setCrop(
                  constrainCrop(
                    {
                      ...crop,
                      x:
                        crop.x +
                        (e.key === "ArrowLeft"
                          ? -step
                          : e.key === "ArrowRight"
                            ? step
                            : 0) /
                          asset.width,
                      y:
                        crop.y +
                        (e.key === "ArrowUp"
                          ? -step
                          : e.key === "ArrowDown"
                            ? step
                            : 0) /
                          asset.height,
                    },
                    minW,
                    minH,
                  ),
                );
              }}
            />
            {[
              ["nw", 0, 0],
              ["n", 0.5, 0],
              ["ne", 1, 0],
              ["e", 1, 0.5],
              ["se", 1, 1],
              ["s", 0.5, 1],
              ["sw", 0, 1],
              ["w", 0, 0.5],
            ].map(([handle, x, y]) => (
              <rect
                key={handle}
                data-testid={`crop-handle-${handle}`}
                x={px.x + Number(x) * px.width - handleSize / 2}
                y={px.y + Number(y) * px.height - handleSize / 2}
                width={handleSize}
                height={handleSize}
                fill="#fff"
                stroke="#7155D9"
                strokeWidth={handleSize / 7}
                style={{ cursor: `${handle}-resize` }}
                onPointerDown={(e) => start(e, String(handle))}
                onPointerMove={(e) => move(e.clientX, e.clientY)}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              />
            ))}
          </svg>
        )}
      </div>
      <div className="crop-fields">
        {(
          [
            ["x", t("cropX")],
            ["y", t("cropY")],
            ["width", t("cropWidth")],
            ["height", t("cropHeight")],
          ] as const
        ).map(([key, label]) => (
          <label className="stacked-field" key={key}>
            <span>{label}</span>
            <input
              aria-label={label}
              type="number"
              key={crop[key]}
              defaultValue={Number((crop[key] * 100).toFixed(2))}
              min={key === "width" || key === "height" ? 0.1 : 0}
              max="100"
              step=".1"
              onBlur={(e) => {
                const n = e.currentTarget.valueAsNumber;
                if (Number.isFinite(n))
                  setCrop(
                    constrainCrop({ ...crop, [key]: n / 100 }, minW, minH),
                  );
                else e.currentTarget.value = String(crop[key] * 100);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </label>
        ))}
      </div>
      {exceedsLimit && (
        <p className="crop-description" role="alert">
          {t("cropLimit")}
        </p>
      )}
      <footer className="crop-footer">
        <Button onClick={() => setCrop({ ...FULL_CROP })}>
          <RotateCcw size={14} />
          {t("resetCrop")}
        </Button>
        <span />
        <Button onClick={close}>{t("cancel")}</Button>
        <Button
          variant="primary"
          disabled={exceedsLimit}
          onClick={() => apply(crop)}
        >
          {t("applyCrop")}
        </Button>
      </footer>
    </dialog>
  );
}
