"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FileArchive, ScanSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/preferences";
import type { Project, Asset, AssetBlobs } from "@/shared/schema/project";
import { inspectProject, type PreflightIssue } from "./preflight";
import { renderDocuments, triggerDownload, type ExportFormat } from "./render";
import { makeZip } from "./zip";

type Props = {
  project: Project; assets: Asset[]; blobs: AssetBlobs; close: () => void;
  focusIssue: (issue: PreflightIssue) => void;
};
export function ExportDialog({ project, assets, blobs, close, focusIssue }: Props) {
  const { t } = usePreferences();
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => { modalRef.current?.querySelector<HTMLButtonElement>(".studio-export-title button")?.focus(); }, []);
  const boards = useMemo(() => [
    { key: "master", name: t("master"), document: project.document },
    ...project.variants.map(variant => ({ key: variant.id, name: variant.name, document: variant.document })),
  ], [project, t]);
  const warnings = useMemo(() => inspectProject(project, assets), [project, assets]);
  const [checked, setChecked] = useState<string[]>(() => boards.map(board => board.key));
  const [format, setFormat] = useState<ExportFormat>("png");
  const [review, setReview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const selected = boards.filter(board => checked.includes(board.key));
  async function startExport() {
    if (!selected.length || working) return;
    setError(false); setWorking(true); setProgress(0);
    try {
      const files = await renderDocuments(selected, assets, blobs, format, (done, total) => setProgress(Math.round(done / total * 100)));
      if (files.length === 1) {
        triggerDownload(new Blob([files[0].bytes], { type: format === "jpeg" ? "image/jpeg" : `image/${format}` }), files[0].name);
      } else {
        triggerDownload(makeZip(files), `${project.name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60)}-export.zip`);
      }
    } catch (cause) { console.error("Creative export failed", cause); setError(true); }
    finally { setWorking(false); }
  }
  const labels: Record<PreflightIssue["type"], string> = {
    "safe-zone": t("issueSafeZone"), "artboard-overflow": t("issueArtboard"),
    "small-text": t("issueSmallText"), "text-overflow": t("issueTextOverflow"), "missing-asset": t("issueMissingAsset"),
  };
  return <div className="studio-modal-backdrop" role="presentation" onMouseDown={e => { if(e.target === e.currentTarget && !working) close(); }}>
    <section ref={modalRef} className="studio-export-dialog" role="dialog" aria-modal="true" aria-label={t("exportCreatives")} onKeyDown={e => { if (e.key === "Escape" && !working) { e.preventDefault(); close(); } }}>
      <div className="studio-export-title"><h2><FileArchive size={20}/>{t("exportCreatives")}</h2><Button size="icon" variant="ghost" aria-label={t("dismiss")} disabled={working} onClick={close}><X size={18}/></Button></div>
      <div className="studio-export-tabs"><button type="button" className={!review ? "is-active" : ""} onClick={() => setReview(false)}><Download size={15}/>{t("exportSelected")}</button>
        <button type="button" className={review ? "is-active" : ""} onClick={() => setReview(true)}><ScanSearch size={15}/>{t("preflight")} <small>{warnings.length}</small></button></div>
      {review ? <div className="studio-export-content studio-issue-list">
        {warnings.length === 0 ? <div className="studio-empty-check"><Check size={24}/>{t("allClear")}</div> : <>
          <p className="inspector-help">{t("exportWarning")}</p>
          {warnings.map((issue, index) => <button key={`${index}-${issue.boardKey}-${issue.layerId}`} className="studio-issue" onClick={() => { focusIssue(issue); close(); }}>
            <strong>{issue.boardName} · {issue.layerName}</strong><span>{labels[issue.type]} ↗</span>
          </button>)}
        </>}
      </div> : <div className="studio-export-content">
        <div className="studio-export-config"><label>{t("exportFormat")}<select aria-label={t("exportFormat")} value={format} disabled={working} onChange={e => setFormat(e.target.value as ExportFormat)}>
          <option value="png">PNG</option><option value="jpeg">JPG · 92%</option><option value="webp">WebP · 92%</option>
        </select></label><div><span>{t("selectArtboards")}</span><label className="studio-select-all"><input type="checkbox" checked={checked.length === boards.length} onChange={e => setChecked(e.target.checked ? boards.map(board => board.key) : [])}/>{t("allArtboards")}</label></div></div>
        <div className="studio-export-board-list">{boards.map(board => <label key={board.key} className="studio-export-board"><input type="checkbox" disabled={working} checked={checked.includes(board.key)} onChange={e => setChecked(old => e.target.checked ? [...old, board.key] : old.filter(key => key !== board.key))}/><span>{board.name}</span><small>{board.document.width} × {board.document.height}</small></label>)}</div>
        {!checked.length && <p className="field-error">{t("exportNoBoards")}</p>}
        {warnings.length > 0 && <button className="studio-export-warning" onClick={() => setReview(true)}>{warnings.length} {t("issuesFound")} · {t("review")}</button>}
      </div>}
      <div className="studio-export-footer">
        {error && <span className="field-error" role="alert">{t("exportFailed")}</span>}
        {working && <span role="status">{t("exportProgress")} {progress}%</span>}
        <Button onClick={() => void startExport()} variant="primary" disabled={working || !selected.length}><Download size={15}/>{working ? `${progress}%` : `${t("exportSelected")} (${checked.length})`}</Button>
      </div>
    </section>
  </div>;
}
