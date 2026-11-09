"use client";
import { useState } from "react";
import { Check, Copy, LayoutGrid, Plus, Trash2, X, Pencil } from "lucide-react";
import type { Project } from "@/shared/schema/project";
import { usePreferences } from "@/components/preferences";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = {
  project: Project;
  activeVariantId: string | null;
  focus: (id: string | null) => void;
  arrange: () => void;
  addCustom: (name: string, width: number, height: number) => boolean;
  rename: (id: string, name: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
};
export function ArtboardManager({ project, activeVariantId, focus, arrange, addCustom, rename, duplicate, remove }: Props) {
  const { t } = usePreferences();
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const [width, setWidth] = useState("1080");
  const [height, setHeight] = useState("1440");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const boards = [
    { id: null, name: t("master"), document: project.document, status: "master" },
    ...project.variants,
  ];
  return <nav className="workspace-artboards-nav" aria-label={t("artboards")}>
    <div className="workspace-nav-header">
      <span className="workspace-nav-title">{t("artboards")}</span>
      <div className="workspace-nav-actions">
        <Button size="icon" variant="ghost" aria-label={t("autoArrange")} title={t("autoArrange")} onClick={arrange}><LayoutGrid size={14}/></Button>
        <Button size="icon" variant="ghost" aria-label={t("addArtboard")} title={t("addArtboard")} disabled={project.variants.length >= 40} onClick={() => setCreate(v => !v)}><Plus size={15}/></Button>
      </div>
    </div>
    {create && <form className="artboard-inline-form" onSubmit={(e) => {
      e.preventDefault();
      if (addCustom(name, Number(width), Number(height))) { setCreate(false); setName(""); }
    }}>
      <label>{t("artboardName")}<input value={name} maxLength={100} placeholder={t("customFormat")} onChange={e => setName(e.target.value)}/></label>
      <div className="artboard-form-sizes">
        <label>W <input type="number" min="64" max="8192" required value={width} onChange={e => setWidth(e.target.value)}/></label>
        <label>H <input type="number" min="64" max="8192" required value={height} onChange={e => setHeight(e.target.value)}/></label>
      </div>
      <div className="artboard-form-actions"><Button type="submit" className="artboard-small-button"><Check size={13}/>{t("createArtboard")}</Button><Button type="button" size="icon" variant="ghost" onClick={() => setCreate(false)}><X size={14}/></Button></div>
    </form>}
    {boards.map(board => <div key={board.id ?? "master"} className={`artboard-nav-row ${activeVariantId === board.id ? "is-active" : ""}`}>
      {renameId === board.id && board.id !== null ? <form className="artboard-rename" onSubmit={e => { e.preventDefault(); rename(board.id!, renameText); setRenameId(null); }}>
        <input autoFocus value={renameText} maxLength={100} aria-label={t("artboardName")} onChange={e=>setRenameText(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setRenameId(null); }}/>
        <button type="submit" title={t("apply")}><Check size={14}/></button>
      </form> : <button type="button" className={`workspace-nav-item ${activeVariantId === board.id ? "is-active" : ""}`}
        data-testid={`artboard-nav-${board.id ?? "master"}`} aria-current={activeVariantId === board.id ? "true" : undefined}
        onClick={() => focus(board.id)}>
        <span className={`workspace-status-dot ${board.status}`} /><span className="workspace-nav-name">{board.name}</span>
        <small>{board.document.width} × {board.document.height}</small>
      </button>}
      {board.id && <div className={`artboard-row-tools ${activeVariantId === board.id ? "is-active" : ""}`}>
        {activeVariantId === board.id && <>
          <button type="button" title={t("renameArtboard")} aria-label={`${t("renameArtboard")}: ${board.name}`} onClick={() => { setRenameId(board.id); setRenameText(board.name); }}><Pencil size={13}/></button>
          <button type="button" title={t("duplicateArtboard")} aria-label={`${t("duplicateArtboard")}: ${board.name}`} disabled={project.variants.length >= 40} onClick={() => duplicate(board.id!)}><Copy size={13}/></button>
        </>}
        <button type="button" className="artboard-delete-trigger" data-testid={`delete-artboard-${board.id}`} title={t("deleteArtboard")} aria-label={`${t("deleteArtboard")}: ${board.name}`} onClick={() => setDeleteId(board.id)}><Trash2 size={14}/></button>
      </div>}
    </div>)}
    <div className="artboard-help">{t("dragArtboardsHint")}</div>
    <ConfirmDialog
      open={deleteId !== null}
      onOpenChange={(open) => { if (!open) setDeleteId(null); }}
      title={t("deleteArtboard")}
      description={`${project.variants.find(variant => variant.id === deleteId)?.name ?? ""} — ${t("confirmDeleteArtboard")}`}
      confirm={t("deleteArtboard")}
      onConfirm={() => {
        if (deleteId) remove(deleteId);
        setDeleteId(null);
      }}
    />
  </nav>;
}
