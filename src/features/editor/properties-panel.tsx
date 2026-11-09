"use client";
import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  LockKeyhole,
  MousePointer2,
  PanelRightClose,
  Ratio,
  Trash2,
  Crop,
  TextCursorInput,
  EyeOff,
  Eye,
  UnlockKeyhole,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/preferences";
import type { Asset, Geometry, Layer, StudioDocument } from "@/shared/schema/project";
import { FONT_ACCEPT } from "@/features/assets/fonts";
import { BrandKitPanel, type BrandKitControls } from "./brand-kit-panel";
import { resizeGeometry } from "./model/geometry";

function NumberField({
  label,
  value,
  min = -16000,
  max = 16000,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const { t } = usePreferences();
  const [error, setError] = useState(false);
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        key={value}
        aria-label={label}
        type="number"
        defaultValue={Number(value.toFixed(2))}
        step="any"
        min={min}
        max={max}
        disabled={disabled}
        aria-invalid={error}
        onChange={() => setError(false)}
        onBlur={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (!Number.isFinite(n) || n < min || n > max) {
            e.currentTarget.value = String(Number(value.toFixed(2)));
            setError(true);
            return;
          }
          onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = String(value);
            e.currentTarget.blur();
          }
        }}
      />
      {error && (
        <span className="field-error" role="alert">
          {t("invalidNumber")}
        </span>
      )}
    </label>
  );
}
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="color-field">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="hex-input"
        type="text"
        aria-label={`${label} HEX`}
        key={value}
        defaultValue={value.toUpperCase()}
        maxLength={7}
        pattern="#[0-9a-fA-F]{6}"
        spellCheck={false}
        onBlur={(e) => {
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
            onChange(e.target.value);
          else e.target.value = value.toUpperCase();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = value.toUpperCase();
            e.currentTarget.blur();
          }
        }}
      />
      <span className="color-alpha">100%</span>
    </div>
  );
}
export function PropertiesPanel({
  selected,
  document,
  update,
  changeBackground,
  duplicate,
  remove,
  reorder,
  unlock,
  selection,
  editText,
  crop,
  metadata,
  setLocked,
  setVisible,
  assets, importFont,
  ...brandControls
}: BrandKitControls & {
  selected: Layer | null;
  assets: Asset[];
  importFont: (file: File) => Promise<Extract<Asset, { kind: "imported-font" }>>;
  selection: Layer[];
  editText: () => void;
  crop: () => void;
  metadata: (layer: Layer) => void;
  setLocked: (locked: boolean) => void;
  setVisible: (visible: boolean) => void;
  document: StudioDocument;
  update: (layer: Layer) => void;
  changeBackground: (color: string) => void;
  duplicate: () => void;
  remove: () => void;
  reorder: (direction: "up" | "down" | "front" | "back") => void;
  unlock: () => void;
}) {
  const { t, setPrefs } = usePreferences();
  const layer = selected;
  const [fontBusy, setFontBusy] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const [fontNotice, setFontNotice] = useState<string | null>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const uploadFont = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setFontError(null);
    setFontNotice(null);
    setFontBusy(true);
    try {
      const asset = await importFont(file);
      if (layer?.type === "text" && !layer.locked) {
        update({ ...layer, textStyleId: undefined, style: { ...layer.style, fontFamily: asset.fontFamily } });
        setFontNotice(t("fontImportApplied"));
      } else {
        setFontNotice(t("fontImportAdded"));
      }
    } catch (error) {
      const key = error instanceof Error ? error.message : "invalidFont";
      const keys = ["fontAlreadyAdded", "fontTooLarge", "unsupportedFont", "invalidFont", "fontDecodeError", "projectTooLarge"] as const;
      setFontError(keys.find(item => item === key) ? t(key as typeof keys[number]) : t("invalidFont"));
    } finally {
      setFontBusy(false);
    }
  };
  const geometry = (key: keyof Geometry, value: number) => {
    if (!layer) return;
    const next =
      key === "width" || key === "height"
        ? resizeGeometry(
            layer,
            key === "width" ? value : layer.geometry.width,
            key === "height" ? value : layer.geometry.height,
            key,
          )
        : { ...layer.geometry, [key]: value };
    update({ ...layer, geometry: next });
  };
  return (
    <aside className="properties-panel panel" aria-label={t("properties")}>
      <div className="panel-heading">
        <h2>{t("properties")}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("hideProperties")}
          onClick={() => setPrefs({ rightOpen: false })}
        >
          <PanelRightClose size={16} />
        </Button>
      </div>
      <div className="inspector-scroll">
        {selection.length > 1 ? (
          <>
            <section className="inspector-section">
              <h3>
                {selection.length} {t("selectedLayers")}
              </h3>
              <p className="inspector-help">{t("multiHint")}</p>
            </section>
            <section className="inspector-section multi-actions">
              <Button
                onClick={() => reorder("front")}
                disabled={!selection.some((l) => !l.locked)}
              >
                <ArrowUp size={16} />
                {t("bringFront")}
              </Button>
              <Button
                onClick={() => reorder("back")}
                disabled={!selection.some((l) => !l.locked)}
              >
                <ArrowDown size={16} />
                {t("sendBack")}
              </Button>
              <Button
                onClick={() => setLocked(!selection.every((l) => l.locked))}
              >
                {selection.every((l) => l.locked) ? (
                  <UnlockKeyhole size={16} />
                ) : (
                  <LockKeyhole size={16} />
                )}{" "}
                {t(
                  selection.every((l) => l.locked)
                    ? "unlockSelected"
                    : "lockSelected",
                )}
              </Button>
              <Button
                onClick={() => setVisible(!selection.every((l) => l.visible))}
              >
                {selection.every((l) => l.visible) ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}{" "}
                {t(
                  selection.every((l) => l.visible)
                    ? "hideSelected"
                    : "showSelected",
                )}
              </Button>
              <Button
                onClick={duplicate}
                disabled={
                  !selection.some((l) => !l.locked) ||
                  document.layers.length +
                    selection.filter((l) => !l.locked).length >
                    200
                }
              >
                <Copy size={16} />
                {t("duplicateSelected")}
              </Button>
              <Button
                className="danger-text"
                onClick={remove}
                disabled={!selection.some((l) => !l.locked)}
              >
                <Trash2 size={16} />
                {t("deleteSelected")}
              </Button>
            </section>
          </>
        ) : layer ? (
          <>
            <section className="inspector-section layer-overview">
              <div className="section-heading">
                <span className="type-badge">{t(layer.type)}</span>
                <span className="muted">
                  #{String(layer.zIndex + 1).padStart(2, "0")}
                </span>
              </div>
              <input
                className="layer-name-input"
                aria-label={t("layerName")}
                key={`${layer.id}:${layer.name}`}
                defaultValue={layer.name}
                maxLength={100}
                disabled={layer.locked}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name) update({ ...layer, name });
                  else e.target.value = layer.name;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    e.currentTarget.value = layer.name;
                    e.currentTarget.blur();
                  }
                }}
              />
              {layer.locked && (
                <div className="locked-notice">
                  <LockKeyhole size={15} />
                  <p>{t("unlockHint")}</p>
                  <Button onClick={unlock}>{t("unlock")}</Button>
                </div>
              )}
            </section>
            <fieldset disabled={layer.locked} className="inspector-fields">
              <section className="inspector-section">
                <h3>{t("positionSize")}</h3>
                <div className="number-grid">
                  <NumberField
                    label="X"
                    value={layer.geometry.x}
                    onCommit={(n) => geometry("x", n)}
                  />
                  <NumberField
                    label="Y"
                    value={layer.geometry.y}
                    onCommit={(n) => geometry("y", n)}
                  />
                  <NumberField
                    label={t("width")}
                    value={layer.geometry.width}
                    min={layer.constraints.minWidth}
                    max={8192}
                    onCommit={(n) => geometry("width", n)}
                  />
                  <NumberField
                    label={t("height")}
                    value={layer.geometry.height}
                    min={layer.constraints.minHeight}
                    max={8192}
                    onCommit={(n) => geometry("height", n)}
                  />
                  <NumberField
                    label={t("rotation")}
                    value={layer.geometry.rotation}
                    min={-360}
                    max={360}
                    onCommit={(n) => geometry("rotation", n)}
                  />
                </div>
                {layer.type === "image" && (
                  <p className="aspect-note">
                    <Ratio size={14} />
                    {t("aspectProtected")}
                  </p>
                )}
              </section>
              {layer.type === "text" && (
                <>
                  <section className="inspector-section">
                    <Button onClick={editText} disabled={!layer.visible}>
                      <TextCursorInput size={16} />
                      {t("editTextCanvas")}
                    </Button>
                    <p className="inspector-help">{t("textEditHint")}</p>
                  </section>
                  <section className="inspector-section">
                    <h3>{t("typography")}</h3>
                    <div className="font-family-select-row">
                    <label className="stacked-field">
                      <span>{t("fontFamily")}</span>
                      <select aria-label={t("fontFamily")} value={layer.style.fontFamily}
                        onChange={(event) => update({ ...layer, textStyleId: undefined, style: { ...layer.style, fontFamily: event.target.value } })}>
                        {["Inter Variable", "Arial", "Helvetica", "Georgia", "Verdana", "Times New Roman", "Courier New",
                          ...assets.filter(asset => asset.kind === "imported-font").map(asset => asset.fontFamily),
                          ...(layer.style.fontFamily && !["Inter Variable", "Arial", "Helvetica", "Georgia", "Verdana", "Times New Roman", "Courier New", ...assets.filter(asset => asset.kind === "imported-font").map(asset => asset.fontFamily)].includes(layer.style.fontFamily) ? [layer.style.fontFamily] : []),
                        ].map(font => <option key={font} value={font}>{font.startsWith("SRS ") ? font.replace(/^SRS /, "").replace(/ [a-f0-9]{6}$/, "") : font}</option>)}
                      </select>
                    </label>
                    <Button type="button" size="icon" variant="secondary"
                      aria-label={t("uploadFont")} title={t("uploadFont")}
                      disabled={fontBusy} onClick={() => fontInput.current?.click()}>
                      <Upload size={15}/>
                    </Button>
                    </div>
                    <div className="number-grid">
                      <NumberField
                        label={t("fontSize")}
                        value={layer.style.fontSize}
                        min={8}
                        max={300}
                        onCommit={(n) =>
                          update({
                            ...layer,
                            textStyleId: undefined,
                            style: { ...layer.style, fontSize: n },
                          })
                        }
                      />
                      <label className="stacked-field">
                        <span>{t("fontWeight")}</span>
                        <select
                          aria-label={t("fontWeight")}
                          value={layer.style.fontWeight}
                          onChange={(e) =>
                            update({
                              ...layer,
                              textStyleId: undefined,
                              style: {
                                ...layer.style,
                                fontWeight: e.target.value as
                                  "400" | "600" | "700",
                              },
                            })
                          }
                        >
                          <option value="400">{t("regular")}</option>
                          <option value="600">{t("semibold")}</option>
                          <option value="700">{t("bold")}</option>
                        </select>
                      </label>
                    </div>
                    <label className="stacked-field">
                      <span>{t("align")}</span>
                      <select
                        aria-label={t("align")}
                        value={layer.style.align}
                        onChange={(e) =>
                          update({
                            ...layer,
                            style: {
                              ...layer.style,
                              align: e.target.value as
                                "left" | "center" | "right",
                            },
                          })
                        }
                      >
                        <option value="left">{t("alignLeft")}</option>
                        <option value="center">{t("alignCenter")}</option>
                        <option value="right">{t("alignRight")}</option>
                      </select>
                    </label>
                  </section>
                </>
              )}
              <section className="inspector-section">
                <h3>{t("appearance")}</h3>
                {layer.type === "image" ? (
                  <NumberField
                    label={t("opacity")}
                    value={layer.style.opacity * 100}
                    min={0}
                    max={100}
                    onCommit={(n) =>
                      update({ ...layer, style: { opacity: n / 100 } })
                    }
                  />
                ) : (
                  <ColorField
                    label={t("fill")}
                    value={layer.style.fill}
                    onChange={(fill) => {
                      if (layer.type === "text")
                        update({ ...layer, colorStyleId: undefined, style: { ...layer.style, fill } });
                      else if (layer.type === "shape")
                        update({ ...layer, colorStyleId: undefined, style: { ...layer.style, fill } });
                    }}
                  />
                )}
                {layer.type === "shape" && (
                  <NumberField
                    label={t("cornerRadius")}
                    value={layer.style.radius}
                    min={0}
                    max={1000}
                    onCommit={(radius) =>
                      update({ ...layer, style: { ...layer.style, radius } })
                    }
                  />
                )}
              </section>
              {layer.type === "image" && (
                <section className="inspector-section">
                  <Button onClick={crop}>
                    <Crop size={16} />
                    {t("cropImage")}
                  </Button>
                  <p className="inspector-help">{t("cropHint")}</p>
                </section>
              )}
              <section className="inspector-section resize-metadata">
                <h3>{t("resizeMetadata")}</h3>
                <p className="inspector-help">{t("metadataHint")}</p>
                <label className="stacked-field">
                  <span>{t("layerRole")}</span>
                  <select
                    aria-label={t("layerRole")}
                    value={layer.role}
                    onChange={(e) =>
                      metadata({
                        ...layer,
                        role: e.target.value as Layer["role"],
                      })
                    }
                  >
                    {(
                      [
                        "background",
                        "headline",
                        "body",
                        "product",
                        "logo",
                        "cta",
                        "decoration",
                      ] as const
                    ).map((role) => (
                      <option key={role} value={role}>
                        {t(`role_${role}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label={t("priority")}
                  value={layer.priority}
                  min={0}
                  max={100}
                  onCommit={(n) =>
                    metadata({ ...layer, priority: Math.round(n) })
                  }
                />
                <label className="stacked-field">
                  <span>{t("anchor")}</span>
                  <select
                    aria-label={t("anchor")}
                    value={layer.anchor}
                    onChange={(e) =>
                      metadata({
                        ...layer,
                        anchor: e.target.value as Layer["anchor"],
                      })
                    }
                  >
                    {(["top-left", "center", "bottom-right"] as const).map(
                      (anchor) => (
                        <option key={anchor} value={anchor}>
                          {t(`anchor_${anchor}`)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="stacked-field">
                  <span>{t("sizingRule")}</span>
                  <select
                    aria-label={t("sizingRule")}
                    value={layer.layout.sizing}
                    onChange={(e) =>
                      metadata({
                        ...layer,
                        layout: {
                          ...layer.layout,
                          sizing: e.target.value as Layer["layout"]["sizing"],
                        },
                      })
                    }
                  >
                    {(["fixed", "scale", "fill"] as const).map((rule) => (
                      <option key={rule} value={rule}>
                        {t(`sizing_${rule}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label={t("safePadding")}
                  value={layer.layout.padding}
                  min={0}
                  max={512}
                  onCommit={(padding) =>
                    metadata({ ...layer, layout: { ...layer.layout, padding } })
                  }
                />
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={layer.layout.mandatory}
                    onChange={(e) =>
                      metadata({
                        ...layer,
                        layout: {
                          ...layer.layout,
                          mandatory: e.target.checked,
                        },
                      })
                    }
                  />
                  {t("mandatory")}
                </label>
              </section>
            </fieldset>
            <section className="inspector-section layer-actions">
              <Button
                aria-label={t("forward")}
                title={t("forward")}
                disabled={
                  layer.locked || layer.zIndex === document.layers.length - 1
                }
                onClick={() => reorder("up")}
                size="icon"
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                aria-label={t("backward")}
                title={t("backward")}
                disabled={layer.locked || layer.zIndex === 0}
                onClick={() => reorder("down")}
                size="icon"
              >
                <ArrowDown size={16} />
              </Button>
              <span className="toolbar-divider" />
              <Button
                aria-label={t("duplicate")}
                title={t("duplicate")}
                disabled={layer.locked || document.layers.length >= 200}
                onClick={duplicate}
                size="icon"
              >
                <Copy size={16} />
              </Button>
              <Button
                aria-label={t("delete")}
                title={t("delete")}
                disabled={layer.locked}
                onClick={remove}
                variant="ghost"
                size="icon"
                className="danger-text"
              >
                <Trash2 size={16} />
              </Button>
            </section>
          </>
        ) : (
          <>
            <div className="selection-empty">
              <MousePointer2 size={28} strokeWidth={1.25} />
              <h3>{t("noSelection")}</h3>
              <p>{t("noSelectionText")}</p>
            </div>
            <section className="inspector-section">
              <h3>{t("artboard")}</h3>
              <div className="artboard-dimensions">
                <span>
                  {document.width}
                  <small>W</small>
                </span>
                <span>×</span>
                <span>
                  {document.height}
                  <small>H</small>
                </span>
              </div>
              <label className="small-label">{t("background")}</label>
              <ColorField
                label={t("background")}
                value={document.background}
                onChange={changeBackground}
              />
            </section>
          </>
        )}
        <BrandKitPanel {...brandControls} selected={selected} backgroundStyleId={document.backgroundStyleId} />
        <section className="inspector-section font-library-section" aria-label={t("fontLibrary")}>
          <h3>{t("fontLibrary")}</h3>
          <p className="inspector-help">{t("fontUploadHint")}</p>
          <input
            ref={fontInput}
            type="file"
            data-testid="font-upload-input"
            aria-label={t("uploadFont")}
            className="font-file-input"
            accept={FONT_ACCEPT}
            disabled={fontBusy}
            onChange={(event) => { void uploadFont(event); }}
          />
          <Button type="button" variant="secondary" disabled={fontBusy}
            onClick={() => fontInput.current?.click()}>
            <Upload size={15}/>{fontBusy ? t("fontImporting") : t("uploadFont")}
          </Button>
          {fontError && <p className="field-error" role="alert">{fontError}</p>}
          {fontNotice && <p className="font-import-success" role="status">{fontNotice}</p>}
          {assets.filter(asset => asset.kind === "imported-font").length > 0 &&
            <ul className="font-library-list">
              {assets.filter(asset => asset.kind === "imported-font").map(asset =>
                <li key={asset.id}>{asset.name}</li>
              )}
            </ul>
          }
        </section>
      </div>
      <div className="inspector-note">{t("localSaveNote")}</div>
    </aside>
  );
}
