"use client";
import { useState } from "react";
import { Plus, Trash2, Link2, Unlink2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePreferences } from "@/components/preferences";
import type { BrandKit, Layer } from "@/shared/schema/project";

export type BrandKitControls = {
  brandKit?: BrandKit;
  selected: Layer | null;
  backgroundStyleId?: string;
  createBrandColor: (name: string, value: string) => void;
  editBrandColor: (id: string, name: string, value: string) => void;
  removeBrandColor: (id: string) => void;
  createBrandTextStyle: (name: string, style: Extract<Layer, { type: "text" }>["style"]) => void;
  editBrandTextStyle: (id: string, item: BrandKit["textStyles"][number]) => void;
  removeBrandTextStyle: (id: string) => void;
  setColorStyle: (layerId: string | null, styleId: string | null) => void;
  setTextStyle: (layerId: string, styleId: string | null) => void;
};

function EditableName({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  return <input className="brand-name-field" aria-label="Style name" defaultValue={value} key={value}
    maxLength={60} onBlur={(event) => {
      const next = event.currentTarget.value.trim();
      if (next && next !== value) onCommit(next);
      else event.currentTarget.value = value;
    }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
}

export function BrandKitPanel(props: BrandKitControls) {
  const { t } = usePreferences();
  const [colorName, setColorName] = useState("");
  const [colorValue, setColorValue] = useState("#C1E36C");
  const [textName, setTextName] = useState("");
  const [deleteItem, setDeleteItem] = useState<{ kind: "color" | "text"; id: string } | null>(null);
  const colors = props.brandKit?.colors ?? [];
  const textStyles = props.brandKit?.textStyles ?? [];
  const layer = props.selected;
  const colorTarget = layer?.type === "image" ? null : (layer?.id ?? null);
  const textTarget = layer?.type === "text" ? layer : null;
  const currentColorStyle = layer ? (layer.colorStyleId ?? "") : (props.backgroundStyleId ?? "");
  const currentTextStyle = textTarget?.textStyleId ?? "";
  return (
    <section className="inspector-section linked-brand-kit" aria-label={t("brandStylesTitle")}>
      <div className="brand-kit-heading"><h3>{t("brandStylesTitle")}</h3><span className="brand-kit-tag">{t("linkedStyles")}</span></div>
      <p className="inspector-help">{t("linkedStylesHint")}</p>
      <div className="brand-kit-subhead"><strong>{t("brandColors")}</strong><span>{colors.length}</span></div>
      <div className="brand-list">
        {colors.map((item) => <div className="brand-style-row" key={item.id}>
          <input aria-label={`${item.name} picker`} type="color" value={item.value} onChange={(e) => props.editBrandColor(item.id, item.name, e.target.value)} />
          <div className="brand-style-body"><EditableName value={item.name} onCommit={(name) => props.editBrandColor(item.id, name, item.value)} /><input className="brand-style-hex" aria-label={`${item.name} HEX`} key={item.value} defaultValue={item.value.toUpperCase()} maxLength={7} onBlur={(e) => {
            const next = e.currentTarget.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(next)) props.editBrandColor(item.id, item.name, next.toUpperCase());
            else e.currentTarget.value = item.value.toUpperCase();
          }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}/></div>
          <button className="brand-style-delete" aria-label={`${t("deleteStyle")} ${item.name}`} title={t("deleteStyle")} onClick={() => setDeleteItem({ kind: "color", id: item.id })}><Trash2 size={14} /></button>
        </div>)}
      </div>
      <div className="brand-create-row">
        <input aria-label={t("colorStyleName")} placeholder={t("colorStyleName")} value={colorName} maxLength={60} onChange={(e) => setColorName(e.target.value)} />
        <input aria-label={t("brandColorValue")} type="color" value={colorValue} onChange={(e) => setColorValue(e.target.value)} />
        <Button type="button" size="icon" variant="secondary" aria-label={t("addColorStyle")} disabled={!colorName.trim() || colors.length >= 60} onClick={() => { props.createBrandColor(colorName.trim(), colorValue); setColorName(""); }}><Plus size={15}/></Button>
      </div>
      {layer?.type !== "image" && <label className="brand-assign-row">
        <span><Link2 size={14} />{layer ? t("linkedColorForLayer") : t("linkedBackgroundColor")}</span>
        <select data-testid="brand-color-style" value={currentColorStyle} disabled={Boolean(layer?.locked)} onChange={(e) => props.setColorStyle(colorTarget, e.target.value || null)}>
          <option value="">{t("noLinkedStyle")}</option>
          {colors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      <div className="brand-kit-subhead"><strong>{t("brandTextStyles")}</strong><span>{textStyles.length}</span></div>
      <div className="brand-list">
        {textStyles.map((item) => <div key={item.id} className="brand-text-style-row">
          <div className="brand-text-style-header"><EditableName value={item.name} onCommit={(name) => props.editBrandTextStyle(item.id, { ...item, name })} /><button className="brand-style-delete" aria-label={`${t("deleteStyle")} ${item.name}`} onClick={() => setDeleteItem({ kind: "text", id: item.id })}><Trash2 size={14}/></button></div>
          <div className="brand-text-style-inputs">
            <input aria-label={`${item.name} font family`} value={item.fontFamily} onChange={(e) => props.editBrandTextStyle(item.id, { ...item, fontFamily: e.target.value || item.fontFamily })}/>
            <input aria-label={`${item.name} font size`} type="number" min={8} max={300} value={item.fontSize} onChange={(e) => { const size = Number(e.target.value); if (size >= 8 && size <= 300) props.editBrandTextStyle(item.id, { ...item, fontSize: size }); }} />
            <select aria-label={`${item.name} font weight`} value={item.fontWeight} onChange={(e) => props.editBrandTextStyle(item.id, { ...item, fontWeight: e.target.value as "400" | "600" | "700" })}><option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option></select>
            <select aria-label={`${item.name} alignment`} value={item.align} onChange={(e) => props.editBrandTextStyle(item.id, { ...item, align: e.target.value as "left" | "center" | "right" })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
          </div>
        </div>)}
      </div>
      <div className="brand-create-row">
        <input aria-label={t("textStyleName")} placeholder={t("textStyleName")} value={textName} maxLength={60} onChange={(e) => setTextName(e.target.value)}/>
        <Button type="button" variant="secondary" aria-label={t("addTextStyle")} disabled={!textName.trim() || !textTarget || textStyles.length >= 40} onClick={() => { if (textTarget) props.createBrandTextStyle(textName.trim(), textTarget.style); setTextName(""); }}><Plus size={15}/>{t("saveFromSelection")}</Button>
      </div>
      {textTarget && <label className="brand-assign-row">
        <span><Unlink2 size={14}/>{t("linkedTextForLayer")}</span>
        <select data-testid="brand-text-style" value={currentTextStyle} disabled={textTarget.locked} onChange={(e) => props.setTextStyle(textTarget.id, e.target.value || null)}>
          <option value="">{t("noLinkedStyle")}</option>
          {textStyles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      <ConfirmDialog open={deleteItem !== null} onOpenChange={(open) => { if (!open) setDeleteItem(null); }} title={t("deleteStyleTitle")} description={t("deleteStyleDescription")} confirm={t("deleteStyle")} onConfirm={() => { if (deleteItem?.kind === "color") props.removeBrandColor(deleteItem.id); else if (deleteItem?.kind === "text") props.removeBrandTextStyle(deleteItem.id); setDeleteItem(null); }} />
    </section>
  );
}
