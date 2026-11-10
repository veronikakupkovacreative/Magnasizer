"use client";
import { useMemo, useState } from "react";
import { LayoutGrid, RotateCcw, Trash2, X, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePreferences } from "@/components/preferences";
import { FORMAT_PRESETS, type FormatPreset } from "@/features/formats/presets";
import { LayoutPreviews } from "./layout-previews";
import { FlatImagePreviews } from "./flat-image-previews";
import { flatSource } from "./flat-image";
import { validateVariant, variantCountAfterGeneration, type CompositionMode } from "./engine";
import { MAX_VARIANTS, type Asset, type AssetBlobs, type FlatImageSettings, type Project, type Variant } from "@/shared/schema/project";

type Props = {
  open: boolean;
  project: Project;
  activeVariant: Variant | null;
  assets: Asset[];
  blobs: AssetBlobs;
  close: () => void;
  generate: (presetIds: string[], mode: CompositionMode) => void;
  recompose: (variantId: string, mode: CompositionMode) => void;
  removeVariant: (variantId: string) => void;
  updateFlatImage: (settings: FlatImageSettings) => void;
};

const platformLabels = {
  meta: "Meta", pmax: "Performance Max", gdn: "Google Display",
} as const;

export function ResizePanel({ open, project, activeVariant, assets, blobs, close, generate, recompose, removeVariant, updateFlatImage }: Props) {
  const { t } = usePreferences();
  const flat = flatSource(project.document, project.flatImage);
  const [choice, setChoice] = useState<{ key: string; mode: CompositionMode } | null>(null);
  const modeKey = activeVariant?.id ?? "new";
  const mode = choice?.key === modeKey ? choice.mode : activeVariant ? (activeVariant.composition ?? "balanced") : "auto";
  const setMode = (next: CompositionMode) => setChoice({ key: modeKey, mode: next });
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() =>
    FORMAT_PRESETS.filter((preset) => preset.id !== "meta-square-1200").slice(0, 4).map((preset) => preset.id),
  );
  const warnings = useMemo(() => activeVariant ? validateVariant(activeVariant.document, activeVariant.safeZone) : [], [activeVariant]);
  if (!open) return null;
  const limitExceeded = variantCountAfterGeneration(project.variants, FORMAT_PRESETS.filter(preset => selected.includes(preset.id))) > MAX_VARIANTS;
  const protectedCount = project.variants.filter(
    (variant) => variant.status === "customized" && selected.some((id) =>
      FORMAT_PRESETS.some((preset) => preset.id === id && preset.id === variant.presetId && preset.version === variant.presetVersion),
    ),
  ).length;
  const first = FORMAT_PRESETS.find((preset) => selected.includes(preset.id)) ?? FORMAT_PRESETS[0];
  const previewPreset: FormatPreset = activeVariant ? {
    id: activeVariant.presetId, version: 1,
    platform: activeVariant.platform === "custom" ? "meta" : activeVariant.platform,
    name: activeVariant.name, width: activeVariant.document.width, height: activeVariant.document.height,
    safeZone: activeVariant.safeZone,
  } : first;
  const selectedModeChanged = activeVariant && (flat
    ? JSON.stringify(activeVariant.flatImage) !== JSON.stringify(project.flatImage)
    : (activeVariant.composition ?? "balanced") !== mode);
  const apply = () => {
    if (!activeVariant || !selectedModeChanged) return;
    if (activeVariant.status === "customized") { setReplaceOpen(true); return; }
    recompose(activeVariant.id, flat ? (activeVariant.composition ?? "auto") : mode);
  };
  return (
    <aside className="resize-popover resize-popover-v6" aria-label={t("resizeStudio")}>
      <div className="resize-popover-heading">
        <div><span className="eyebrow">MAGNASIZER · 0.8.2</span><h2>{t("resizeStudio")}</h2></div>
        <Button variant="ghost" size="icon" aria-label={t("dismiss")} onClick={close}><X size={16}/></Button>
      </div>
      <p className="resize-intro">{t("resizeIntroV6")}</p>
      <section className="composition-section" aria-label={t("compositionSection")}>
        <div className="composition-title"><Sparkles size={15}/><strong>{flat ? t("flatFitMode") : t("compositionSection")}</strong><span>{previewPreset.width} × {previewPreset.height}</span></div>
        {flat && project.flatImage ? (
          <>
            <p className="flat-import-hint">{t("flatImportHint")}</p>
            <FlatImagePreviews master={project.document} preset={previewPreset} assets={assets} blobs={blobs}
              settings={project.flatImage} update={updateFlatImage} />
          </>
        ) : (
          <>
            <LayoutPreviews master={project.document} preset={previewPreset} assets={assets} blobs={blobs} value={mode} onChange={setMode}/>
            <p className="composition-caption">{t(`compositionHint_${mode}`)}</p>
          </>
        )}
        {!activeVariant && <p className="composition-scope-note">{t("selectVariantToApply")}</p>}
        {activeVariant && (
          <div className="composition-apply">
            <span className="variant-current-mode">{flat ? t("flatIndividualCrop") : `${t("currentLayout")}: ${t(`composition_${activeVariant.composition ?? "balanced"}`)}`}</span>
            <Button variant="secondary" disabled={!selectedModeChanged} onClick={apply} data-testid="apply-composition">{t("applyLayout")}</Button>
          </div>
        )}
      </section>
      <div className="resize-section-label"><strong>{t("targetFormats")}</strong><span>{selected.length} {t("selectedFormats")}</span></div>
      <div className="resize-groups">
        {(["meta", "pmax", "gdn"] as const).map((platform) => (
          <section key={platform} className="resize-group">
            <h3>{platformLabels[platform]}</h3>
            {FORMAT_PRESETS.filter((preset) => preset.platform === platform).map((preset) => {
              const checked = selected.includes(preset.id);
              const existing = project.variants.find((variant) => variant.presetId === preset.id && variant.presetVersion === preset.version);
              return (
                <label className="format-option" key={preset.id}>
                  <input type="checkbox" checked={checked} onChange={() => setSelected((ids) => checked ? ids.filter((id) => id !== preset.id) : [...ids, preset.id])}/>
                  <span className="format-copy"><strong>{preset.name}</strong><small>{preset.width} × {preset.height}</small></span>
                  {existing && <span className={`variant-state ${existing.status}`}>{t(existing.status === "customized" ? "customized" : "generated")}</span>}
                </label>
              );
            })}
          </section>
        ))}
      </div>
      <div className="resize-actions">
        <Button variant="primary" disabled={!selected.length || limitExceeded} onClick={() => generate(selected, mode)} data-testid="generate-variants">
          <LayoutGrid size={15}/>{project.variants.length ? t("regenerateSelected") : t("generateSelected")}
        </Button>
        <span className="protect-note"><ShieldCheck size={13}/>{t("variantPreserveNote")}</span>
        {limitExceeded && <span role="alert" className="protect-note">{t("artboardLimit")}</span>}
        {protectedCount > 0 && <span className="protected-count" role="status">{protectedCount} {t("protectedVariantsCount")}</span>}
      </div>
      {activeVariant && (
        <section className="active-variant-card">
          <div className="active-variant-title">
            <div><span className="eyebrow">{t("activeVariant")}</span><strong>{activeVariant.name}</strong></div>
            <Button variant="ghost" size="icon" aria-label={t("removeVariant")} title={t("removeVariant")} onClick={() => removeVariant(activeVariant.id)}><Trash2 size={15}/></Button>
          </div>
          <div className="variant-meta-row"><span>{activeVariant.document.width} × {activeVariant.document.height}</span><span>{t(activeVariant.status === "customized" ? "customized" : "synced")}</span></div>
          <div className={`validation-summary ${warnings.length ? "has-warning" : "is-clear"}`}><span>{warnings.length ? `${warnings.length} ${t("warnings")}` : t("noWarnings")}</span><RotateCcw size={14}/></div>
          {!!warnings.length && <ul className="validation-list">{warnings.slice(0, 6).map((warning) => <li key={warning}>{warning}</li>)}</ul>}
        </section>
      )}
      <ConfirmDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        title={t("replaceLayoutTitle")}
        description={t("replaceLayoutDescription")}
        confirm={t("replaceLayoutConfirm")}
        onConfirm={() => { if (activeVariant) recompose(activeVariant.id, mode); }}
      />
    </aside>
  );
}
