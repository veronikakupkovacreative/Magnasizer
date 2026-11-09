"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowRight,
  FolderOpen,
  Plus,
  ShieldCheck,
  Layers3,
  Scan,
  LoaderCircle,
  Trash2,
  ClipboardPaste,
  Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ErrorNotice,
  LoadingState,
  Logo,
  PreferencesControls,
} from "@/components/studio-chrome";
import { usePreferences } from "@/components/preferences";
import { localProjects } from "@/lib/db/projects";
import { MAX_PROJECT_BYTES, type Project } from "@/shared/schema/project";
import { createProject } from "./demo";
import { decodeProject } from "@/features/assets/project-file";
import { createProjectFromFigma, parseFigmaTransfer } from "@/features/figma/bridge";
import {
  importImage,
  imageLayer,
  asFlatMaster,
  IMAGE_ACCEPT,
  MAX_TOTAL_BYTES,
} from "@/features/assets/import";
import { importErrorKey } from "@/features/assets/errors";
import type { MessageKey } from "@/lib/i18n/messages";
import type { AssetBlobs } from "@/shared/schema/project";

export function Welcome() {
  const { t, prefs } = usePreferences();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [retry, setRetry] = useState(0);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [figmaPasteOpen, setFigmaPasteOpen] = useState(false);
  const [figmaText, setFigmaText] = useState("");
  useEffect(() => {
    let active = true;
    localProjects
      .list()
      .then((items) => {
        if (active) {
          setProjects(items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("listError");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [retry]);
  async function removeProject() {
    const target = projectToDelete;
    if (!target) return;
    // The repository performs one atomic transaction; do not optimistically
    // remove a card if IndexedDB rejected the deletion.
    await localProjects.remove(target.id);
    setProjects((items) => items.filter((project) => project.id !== target.id));
    setProjectToDelete(null);
  }
  async function create(demo: boolean) {
    setBusy(true);
    setError(null);
    const bundle = createProject(demo);
    if (!demo) bundle.project.name = t("untitled");
    // Create a real local record before navigating; failures are recoverable.
    try {
      await localProjects.save(bundle);
      router.push(`/editor/${bundle.project.id}`);
    } catch {
      setError("storageError");
      setBusy(false);
    }
  }
  async function importFigma(text: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const transfer = parseFigmaTransfer(text);
      const { bundle, blobs, warnings } = await createProjectFromFigma(transfer);
      await localProjects.save(bundle, blobs);
      // Keep import diagnostics available after navigation without modifying the file.
      if (warnings.length) {
        try { sessionStorage.setItem(`magnasizer-figma-warnings-${bundle.project.id}`, warnings.slice(0, 12).join("\n")); } catch { /* optional */ }
      }
      router.push(`/editor/${bundle.project.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "figmaTransferInvalid";
      setError(message === "figmaTransferTooLarge" ? "figmaTransferTooLarge" : "figmaTransferInvalid");
      setBusy(false);
    }
  }
  async function readFigmaClipboard() {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      await importFigma(text);
    } catch {
      setFigmaPasteOpen(true);
      setError("figmaClipboardHelp");
    }
  }
  async function importFiles(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (files.length > 20) throw new Error("tooManyFiles");
      const file = files[0];
      let bundle,
        blobs: AssetBlobs = {},
        removed = 0;
      if (file.name.toLowerCase().endsWith(".json")) {
        if (files.length !== 1 || file.size > MAX_PROJECT_BYTES)
          throw new Error("Invalid file");
        const json = await file.text();
        if (file.name.toLowerCase().endsWith(".magnasizer.json") || json.includes('"magnasizer-figma"')) {
          const loaded = await createProjectFromFigma(parseFigmaTransfer(json));
          bundle = loaded.bundle;
          blobs = loaded.blobs;
        } else {
          const loaded = await decodeProject(json);
          bundle = loaded.bundle;
          blobs = loaded.blobs;
        }
      } else {
        bundle = createProject(false);
        bundle.project.name =
          file.name.replace(/\.[^.]+$/, "").slice(0, 100) || t("untitled");
        for (const [index, file] of files.entries()) {
          const imported = await importImage(file);
          bundle.assets.push(imported.asset);
          Object.assign(blobs, imported.blobs);
          removed += imported.removed;
          const flatSettings = files.length === 1
            ? asFlatMaster(imported.asset, bundle.project.document)
            : null;
          if (flatSettings) bundle.project.flatImage = flatSettings;
          else bundle.project.document.layers.push(
            imageLayer(imported.asset, bundle.project.document, index * 24),
          );
        }
        if (
          Object.values(blobs).reduce((n, b) => n + b.size, 0) > MAX_TOTAL_BYTES
        )
          throw new Error("projectTooLarge");
      }
      // Import as a new project; never overwrite a saved project silently.
      bundle.project.id = crypto.randomUUID();
      bundle.project.createdAt = new Date().toISOString();
      await localProjects.save(bundle, blobs);
      if (removed) {
        try {
          sessionStorage.setItem(
            `srs-import-notice-${bundle.project.id}`,
            "svgSanitized",
          );
        } catch {
          /* Import succeeded; the optional notice must not block opening it. */
        }
      }
      router.push(`/editor/${bundle.project.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setError(message.startsWith("figmaTransfer")
        ? message === "figmaTransferTooLarge" ? "figmaTransferTooLarge" : "figmaTransferInvalid"
        : importErrorKey(error, "importError"));
      setBusy(false);
    }
    if (input.current) input.current.value = "";
  }
  return (
    <div className="welcome-shell">
      <header className="topbar welcome-topbar">
        <Logo />
        <span className="workspace-label">{t("localWorkspace")}</span>
        <PreferencesControls />
      </header>
      <main className="welcome-main">
        <div className="welcome-heading">
          <div>
            <p className="eyebrow">{t("phase")}</p>
            <h1>{t("welcomeTitle")}</h1>
            <p className="welcome-subtitle">{t("welcomeText")}</p>
          </div>
          <Button
            variant="primary"
            size="large"
            disabled={busy}
            onClick={() => create(false)}
          >
            <Plus size={18} />
            {t("newProject")}
          </Button>
        </div>
        {error && (
          <ErrorNotice
            action={
              error === "listError" ? (
                <Button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    setRetry((r) => r + 1);
                  }}
                >
                  {t("retry")}
                </Button>
              ) : undefined
            }
          >
            {t(error)}
          </ErrorNotice>
        )}
        <div className="start-grid">
          <section
            className={`dropzone ${dragging ? "is-dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void importFiles(Array.from(e.dataTransfer.files));
            }}
            aria-busy={busy}
          >
            <div className="drop-icon">
              <ArrowDownToLine size={28} strokeWidth={1.4} />
            </div>
            <h2>{t("importTitle")}</h2>
            <p>{t("importText")}</p>
            <Button disabled={busy} onClick={() => input.current?.click()}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <FolderOpen size={16} />
              )}
              {busy ? t("importBusy") : t("browse")}
            </Button>
            <input
              ref={input}
              type="file"
              accept={`.json,.srs.json,application/json,${IMAGE_ACCEPT}`}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-label={t("browse")}
              onChange={(e) =>
                void importFiles(Array.from(e.target.files ?? []))
              }
            />
            <small>{t("importHint")}</small>
            <div className="figma-import-block">
              <div className="figma-import-heading"><Braces size={16}/><strong>{t("figmaImportTitle")}</strong></div>
              <p>{t("figmaImportDescription")}</p>
              <div className="figma-import-actions">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => { void readFigmaClipboard(); }}>
                  <ClipboardPaste size={15}/>{t("figmaPaste")}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setFigmaPasteOpen((open) => !open)}>
                  {t("figmaPasteManually")}
                </Button>
              </div>
              {figmaPasteOpen && <div className="figma-paste-form">
                <label htmlFor="figma-transfer-data">{t("figmaTransferLabel")}</label>
                <textarea id="figma-transfer-data" rows={4} value={figmaText}
                  onChange={(event) => setFigmaText(event.target.value)}
                  placeholder={t("figmaTransferPlaceholder")}/>
                <Button disabled={busy || !figmaText.trim()} onClick={() => { void importFigma(figmaText); }}>
                  {t("figmaImportButton")}
                </Button>
              </div>}
            </div>
            <div className="drop-future">{t("futureImport")}</div>
          </section>
          <section className="demo-card">
            <div className="demo-preview" aria-hidden="true">
              <div className="preview-ruler">MASTER / 1200 × 1200</div>
              <div className="mini-artboard">
                <div className="mini-copy">
                  <b>FORM®</b>
                  <span>THE EDIT / OBJECTS FOR EVERY DAY</span>
                  <strong>
                    BETTER.
                    <br />
                    BY DESIGN.
                  </strong>
                  <small>
                    An everyday essential.
                    <br />
                    Nothing extra.
                  </small>
                  <i>EXPLORE THE EDIT ↗</i>
                </div>
                <div className="mini-product">
                  <div className="mini-orbit" />
                  <div className="mini-bottle" />
                </div>
              </div>
              <span className="preview-corner corner-tl" />
              <span className="preview-corner corner-br" />
            </div>
            <div className="demo-details">
              <p className="eyebrow">{t("demoLabel")}</p>
              <h2>{t("demoTitle")}</h2>
              <p>{t("demoText")}</p>
              <div className="demo-footer">
                <span>
                  <Layers3 size={14} />
                  {t("demoTag")}
                </span>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => create(true)}
                >
                  {t("openDemo")}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </section>
        </div>
        <div className="privacy-line">
          <ShieldCheck size={15} />
          <span>{t("privacy")}</span>
        </div>
        <section className="recent-section">
          <div className="section-heading">
            <h2>{t("recent")}</h2>
            <span className="count-pill">{projects.length}</span>
          </div>
          {loading ? (
            <LoadingState />
          ) : projects.length === 0 ? (
            <div className="recent-empty">
              <Scan size={28} strokeWidth={1.2} />
              <div>
                <strong>{t("recentEmpty")}</strong>
                <p>{t("recentEmptyText")}</p>
              </div>
            </div>
          ) : (
            <div className="recent-grid">
              {projects.map((project) => (
                <div className="recent-project" key={project.id} data-testid={`project-card-${project.id}`}>
                  <button
                    type="button"
                    className="recent-project-open"
                    aria-label={`${t("open")}: ${project.name}`}
                    onClick={() => router.push(`/editor/${project.id}`)}
                  >
                    <span className="project-glyph"><Layers3 size={24} /></span>
                    <span className="recent-project-info">
                      <strong>{project.name}</strong>
                      <small>
                        {project.document.width} × {project.document.height} ·{" "}
                        {project.document.layers.length} {t("layerCount")}
                      </small>
                      <small>
                        {t("modified")}{" "}
                        {new Intl.DateTimeFormat(prefs.locale, {
                          dateStyle: "medium", timeStyle: "short",
                        }).format(new Date(project.updatedAt))}
                      </small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="recent-project-delete"
                    aria-label={`${t("deleteProject")}: ${project.name}`}
                    title={t("deleteProject")}
                    disabled={busy}
                    onClick={() => setProjectToDelete(project)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
        <ConfirmDialog
          open={projectToDelete !== null}
          onOpenChange={(open) => { if (!open) setProjectToDelete(null); }}
          title={t("deleteProjectTitle")}
          description={`${t("deleteProjectDescription")} ${projectToDelete?.name ?? ""}`}
          confirm={t("deleteProjectConfirm")}
          errorText={t("deleteProjectError")}
          onConfirm={removeProject}
        />
        <footer className="welcome-footer">
          <span>{t("future")}</span>
          <p>{t("futureText")}</p>
        </footer>
      </main>
    </div>
  );
}
