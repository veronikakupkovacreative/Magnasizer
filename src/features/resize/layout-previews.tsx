"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, ImageOff, LoaderCircle } from "lucide-react";
import type { Asset, AssetBlobs, StudioDocument } from "@/shared/schema/project";
import type { FormatPreset } from "@/features/formats/presets";
import { generateVariant, type CompositionMode } from "./engine";
import { usePreferences } from "@/components/preferences";

export const COMPOSITIONS: CompositionMode[] = ["auto", "balanced", "product", "text"];

type Props = {
  master: StudioDocument;
  preset: FormatPreset;
  assets: Asset[];
  blobs: AssetBlobs;
  value: CompositionMode;
  onChange: (mode: CompositionMode) => void;
};

export function LayoutPreviews({ master, preset, assets, blobs, value, onChange }: Props) {
  const { t } = usePreferences();
  const variants = useMemo(() => COMPOSITIONS.map((mode) => ({ mode, document: generateVariant(master, preset, mode).document })), [master, preset]);
  const [result, setResult] = useState<{
    source: typeof variants;
    images: Partial<Record<CompositionMode, string>>;
    error: boolean;
  } | null>(null);
  const current = result?.source === variants ? result : null;
  const images = current?.images ?? {};
  const error = current?.error ?? false;

  useEffect(() => {
    let cancelled = false;
    let urls: string[] = [];
    void import("@/features/export/render").then(({ renderDocuments }) =>
      renderDocuments(variants.map((variant) => ({
        document: variant.document, key: variant.mode, name: variant.mode,
      })), assets, blobs, "png", undefined, 440),
    ).then((files) => {
      if (cancelled) return;
      urls = files.map((file) => URL.createObjectURL(new Blob([file.bytes], { type: "image/png" })));
      setResult({ source: variants, images: Object.fromEntries(files.map((_, index) => [COMPOSITIONS[index], urls[index]])), error: false });
    }).catch(() => { if (!cancelled) setResult({ source: variants, images: {}, error: true }); });
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [variants, assets, blobs]);

  return (
    <div className="composition-preview-grid" role="radiogroup" aria-label={t("layoutMode") }>
      {COMPOSITIONS.map((mode) => (
        <button key={mode} type="button" role="radio" aria-checked={value === mode}
          tabIndex={value === mode ? 0 : -1}
          className={`composition-option ${value === mode ? "is-selected" : ""}`}
          onClick={() => onChange(mode)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
            const next = COMPOSITIONS[(COMPOSITIONS.indexOf(mode) + delta + COMPOSITIONS.length) % COMPOSITIONS.length];
            onChange(next);
            const target = event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-testid="composition-${next}"]`);
            target?.focus();
          }}
          data-testid={`composition-${mode}`}>
          <span className="composition-option-image" style={{ aspectRatio: `${preset.width} / ${preset.height}` }}>
            {images[mode] ? (
              // Blob URLs are generated locally by the same pixel renderer used for ZIP export.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[mode]} alt="" />
            ) : error ? <ImageOff size={17} aria-hidden="true" /> : <LoaderCircle size={17} className="spin" aria-hidden="true" />}
          </span>
          <span className="composition-option-footer">
            <span>{t(`composition_${mode}`)}</span>
            {value === mode && <Check size={13} aria-hidden="true" />}
          </span>
        </button>
      ))}
    </div>
  );
}
