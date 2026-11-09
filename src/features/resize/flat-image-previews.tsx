"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ImageOff, LoaderCircle } from "lucide-react";
import type { Asset, AssetBlobs, FlatImageSettings, StudioDocument } from "@/shared/schema/project";
import type { FormatPreset } from "@/features/formats/presets";
import { flatPlan, type FlatImageOutcome } from "./flat-image";
import { usePreferences } from "@/components/preferences";

export const FIT_MODES = ["smart", "contain", "cover"] as const;
export type FlatFitMode = typeof FIT_MODES[number];

type Props = {
  master: StudioDocument;
  preset: FormatPreset;
  settings: FlatImageSettings;
  assets: Asset[];
  blobs: AssetBlobs;
  update: (settings: FlatImageSettings) => void;
};

export function FlatImagePreviews({ master, preset, settings, assets, blobs, update }: Props) {
  const { t } = usePreferences();
  const plans = useMemo(() => FIT_MODES.map((fitMode) => ({
    fitMode,
    ...flatPlan(master, preset.width, preset.height, { ...settings, fitMode }),
  })), [master, preset, settings]);
  const [result, setResult] = useState<{ source: typeof plans; urls: string[]; error: boolean } | null>(null);
  const images = result?.source === plans ? result.urls : [];
  const error = result?.source === plans && result.error;
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void import("@/features/export/render").then(({ renderDocuments }) => renderDocuments(
      plans.map((plan) => ({ document: plan.document, key: plan.fitMode, name: plan.fitMode })),
      assets, blobs, "png", undefined, 420,
    )).then((files) => {
      if (cancelled) return;
      files.forEach((file) => urls.push(URL.createObjectURL(new Blob([file.bytes], { type: "image/png" }))));
      setResult({ source: plans, urls: [...urls], error: false });
    }).catch(() => { if (!cancelled) setResult({ source: plans, urls: [], error: true }); });
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [plans, assets, blobs]);
  const currentPlan = plans.find((plan) => plan.fitMode === settings.fitMode);
  return (
    <>
      <div className="composition-preview-grid flat-preview-grid" role="radiogroup" aria-label={t("flatFitMode")}>
        {plans.map((plan, index) => (
          <button type="button" key={plan.fitMode} role="radio" aria-checked={plan.fitMode === settings.fitMode}
            tabIndex={plan.fitMode === settings.fitMode ? 0 : -1}
            data-testid={`flat-mode-${plan.fitMode}`}
            className={`composition-option ${plan.fitMode === settings.fitMode ? "is-selected" : ""}`}
            onClick={() => update({ ...settings, fitMode: plan.fitMode })}>
            <span className="composition-option-image" style={{ aspectRatio: `${preset.width} / ${preset.height}` }}>
              {images[index] ? (
                // Generated image previews use the same renderer as production exports.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[index]} alt="" />
              ) : error ? <ImageOff size={18} aria-hidden="true" /> : <LoaderCircle size={18} className="spin" aria-hidden="true" />}
            </span>
            <span className="composition-option-footer"><span>{t(`flatMode_${plan.fitMode}`)}</span>
              {plan.fitMode === settings.fitMode && <Check size={13} aria-hidden="true" />}
            </span>
            {plan.fitMode === "smart" && <small className="flat-mode-note">{t(plan.outcome === "contain" ? "flatSmartContain" : "flatSmartCover")}</small>}
          </button>
        ))}
      </div>
      <p className="composition-caption" role="status">{t(`flatHint_${settings.fitMode}`)} {settings.fitMode === "smart" && currentPlan?.outcome === "contain" ? t("flatSafeFallback") : ""}</p>
      <div className="flat-focus-controls">
        {(["focalX", "focalY", "protectedArea"] as const).map((key) => (
          <label key={key} className="flat-focus-control">
            <span>{t(`flat_${key}`)} <b>{Math.round(settings[key] * 100)}%</b></span>
            <input type="range" min={key === "protectedArea" ? 10 : 0} max="100" step="1"
              value={Math.round(settings[key] * 100)}
              onChange={(event) => update({ ...settings, [key]: Number(event.currentTarget.value) / 100 })}
              aria-label={t(`flat_${key}`)} />
          </label>
        ))}
      </div>
    </>
  );
}
