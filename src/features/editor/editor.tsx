"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Download,
  HardDrive,
  ImagePlus,
  LoaderCircle,
  Magnet,
  LayoutGrid,
  FileArchive,
  Group as GroupIcon,
  Ungroup as UngroupIcon,
  Monitor,
  MousePointer2,
  PanelLeftOpen,
  PanelRightOpen,
  Redo2,
  Save,
  Square,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { usePreferences } from "@/components/preferences";
import {
  ErrorNotice,
  LoadingState,
  Logo,
  PreferencesControls,
} from "@/components/studio-chrome";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Layer, LoadedProject } from "@/shared/schema/project";
import type { MessageKey } from "@/lib/i18n/messages";
import { newLayer } from "@/features/projects/demo";
import { IMAGE_ACCEPT } from "@/features/assets/import";
import { importErrorKey } from "@/features/assets/errors";
import { useEditor } from "./use-editor";
import { LayersPanel } from "./layers-panel";
import { PropertiesPanel } from "./properties-panel";
import { PanelDivider } from "./panel-divider";
import { CropDialog } from "./crop-dialog";
import { clamp } from "./model/geometry";
import { ResizePanel } from "@/features/resize/resize-panel";
import { validateVariant } from "@/features/resize/engine";
import { ArtboardManager } from "./artboard-manager";


const ExportDialog = dynamic(() => import("@/features/export/export-dialog").then(module => module.ExportDialog), { ssr: false });
const Canvas = dynamic(() => import("./workspace-canvas"), {
  ssr: false,
  loading: () => <LoadingState canvas />,
});
export function Editor({ initial }: { initial: LoadedProject }) {
  const { t, prefs, setPrefs } = usePreferences();
  const router = useRouter();
  const editor = useEditor(initial);
  const { project, document, selected, selection, dirty, dispatch, select } = editor;
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [viewReset, setViewReset] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ key: string; sequence: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const activateArtboard = (id: string | null) => {
    if (id === editor.activeVariantId) return;
    setEditingId(null);
    setCropId(null);
    editor.switchDocument(id);
  };
  const focusArtboard = (id: string | null) => {
    activateArtboard(id);
    setFocusRequest((old) => ({ key: id ?? "master", sequence: (old?.sequence ?? 0) + 1 }));
  };
  const [notice, setNotice] = useState<MessageKey | null>(() => {
    try {
      return sessionStorage.getItem(
        `srs-import-notice-${initial.bundle.project.id}`,
      )
        ? "svgSanitized"
        : null;
    } catch {
      return null;
    }
  });
  const [importError, setImportError] = useState<MessageKey | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const clipboard = useRef<Layer[]>([]);
  const cropLayer = document.layers.find(
    (l) => l.id === cropId && l.type === "image",
  );
  const cropAsset =
    cropLayer?.type === "image"
      ? editor.assets.find((a) => a.id === cropLayer.assetId)
      : undefined;
  useEffect(() => {
    try {
      const key = `srs-import-notice-${project.id}`;
      sessionStorage.removeItem(key);
    } catch {
      /* Notice storage is optional. */
    }
  }, [project.id]);
  const duplicate = (sources: Layer[] = selection) => {
    const source = sources.filter((l) => !l.locked);
    if (!source.length || document.layers.length + source.length > 200)
      return;
    const groupCount = new Map<string, number>();
    const groupIds = new Map<string, string>();
    for (const layer of source) if (layer.groupId) groupCount.set(layer.groupId, (groupCount.get(layer.groupId) ?? 0) + 1);
    const copies = source.map((layer, index) => {
      const id = crypto.randomUUID();
      const allGroupMembers = layer.groupId ? document.layers.filter((item) => item.groupId === layer.groupId).length : 0;
      const groupCopied = layer.groupId && groupCount.get(layer.groupId) === allGroupMembers && allGroupMembers > 1;
      if (groupCopied && !groupIds.has(layer.groupId!)) groupIds.set(layer.groupId!, crypto.randomUUID());
      const copyGroupId = groupCopied ? groupIds.get(layer.groupId!) : undefined;
      return {
        ...structuredClone(layer),
        id,
        sourceId: layer.sourceId,
        groupId: copyGroupId,
        groupName: copyGroupId ? layer.groupName : undefined,
        name: `${layer.name.slice(0, 85)} ${t("copySuffix")}`,
        geometry: {
          ...layer.geometry,
          x: clamp(layer.geometry.x + 24, -16000, 16000),
          y: clamp(layer.geometry.y + 24, -16000, 16000),
        },
        zIndex: document.layers.length + index,
      };
    });
    dispatch({
      type: "batch",
      commands: copies.map((layer) => ({ type: "insert-layer", layer })),
    });
    editor.setSelectedIds(copies.map((l) => l.id));
  };
  const groupSelection = () => {
    if (selection.length < 2 || selection.some((layer) => layer.locked)) return;
    const groupId = crypto.randomUUID();
    dispatch({ type: "group-layers", ids: selection.map((layer) => layer.id), groupId, name: t("newGroup") });
  };
  const ungroupSelection = () => {
    if (!selection.some((layer) => layer.groupId)) return;
    dispatch({ type: "ungroup-layers", ids: selection.map((layer) => layer.id) });
  };
  const reorder = (direction: "up" | "down" | "front" | "back") =>
    dispatch({ type: "reorder-layers", ids: editor.selectedIds, direction });
  const setLocked = (locked: boolean) =>
    dispatch({
      type: "batch",
      commands: selection.map((l) => ({ type: "set-lock", id: l.id, locked })),
    });
  const setVisible = (visible: boolean) =>
    dispatch({
      type: "batch",
      commands: selection.map((l) => ({
        type: "set-visible",
        id: l.id,
        visible,
      })),
    });
  const remove = () =>
    setDeleteIds(selection.filter((l) => !l.locked).map((l) => l.id));
  const importFiles = async (files: File[]) => {
    setImportError(null);
    setNotice(null);
    try {
      const removed = await editor.importFiles(files);
      if (files.length) setNotice(removed ? "svgSanitized" : "flatImport");
    } catch (error) {
      setImportError(importErrorKey(error));
    }
    if (imageInput.current) imageInput.current.value = "";
  };
  const add = (type: "text" | "shape") => {
    const layer = newLayer(type, document.layers.length);
    layer.name = t(type);
    if (layer.type === "text") layer.text = t("newText");
    dispatch({ type: "insert-layer", layer });
    select(layer.id);
  };
  const goHome = () => {
    if (dirty) setLeaveOpen(true);
    else router.push("/");
  };
  useEffect(() => {
    const preventLoss = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.isComposing ||
        deleteIds.length ||
        leaveOpen ||
        cropId ||
        editor.importing ||
        (e.target instanceof HTMLElement &&
          e.target.closest('[role="dialog"], [role="alertdialog"], dialog'))
      )
        return;
      const input =
        e.target instanceof HTMLElement &&
        (e.target.matches("input,textarea,select") ||
          e.target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey,
        key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        if (input && e.target instanceof HTMLElement) {
          e.target.blur();
          requestAnimationFrame(() => void editor.save());
        } else void editor.save();
        return;
      }
      if (input) return;
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        editor.redo();
      } else if (mod && key === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
      } else if (mod && key === "d") {
        e.preventDefault();
        duplicate();
      } else if (mod && key === "a") {
        e.preventDefault();
        editor.setSelectedIds(
          document.layers
            .filter((l) => l.visible && !l.locked)
            .map((l) => l.id),
        );
      } else if (mod && key === "c" && selection.length) {
        e.preventDefault();
        clipboard.current = structuredClone(selection);
      } else if (mod && key === "v" && clipboard.current.length) {
        e.preventDefault();
        duplicate(clipboard.current.map((l) => ({ ...l, locked: false })));
      } else if (mod && e.shiftKey && key === "l") {
        e.preventDefault();
        setLocked(!selection.every((l) => l.locked));
      } else if (mod && e.shiftKey && key === "h") {
        e.preventDefault();
        setVisible(!selection.every((l) => l.visible));
      } else if (e.key === "Escape") {
        select(null);
        setHelpOpen(false);
      } else if (
        e.key === "Enter" &&
        selected?.type === "text" &&
        !selected.locked &&
        selected.visible &&
        (!(e.target instanceof HTMLElement) ||
          !e.target.closest("button") ||
          e.target.closest(".layer-select"))
      ) {
        e.preventDefault();
        setEditingId(selected.id);
      } else if (e.key === "F2" && selected && !selected.locked) {
        e.preventDefault();
        setPrefs({ rightOpen: true });
        requestAnimationFrame(() => {
          const field =
            document.querySelector<HTMLInputElement>(".layer-name-input");
          field?.focus();
          field?.select();
        });
      } else if (
        ["Delete", "Backspace"].includes(e.key) &&
        selection.some((l) => !l.locked)
      ) {
        e.preventDefault();
        remove();
      } else if (
        (e.code === "BracketLeft" || e.code === "BracketRight") &&
        !mod
      ) {
        e.preventDefault();
        reorder(
          e.code === "BracketRight"
            ? e.shiftKey
              ? "front"
              : "up"
            : e.shiftKey
              ? "back"
              : "down",
        );
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
        selection.length &&
        !(
          e.target instanceof HTMLElement &&
          e.target.getAttribute("role") === "separator"
        )
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        dispatch({
          type: "batch",
          commands: selection
            .filter((l) => !l.locked && l.visible)
            .map((layer) => ({
              type: "update-layer",
              layer: {
                ...layer,
                geometry: {
                  ...layer.geometry,
                  x: clamp(
                    layer.geometry.x +
                      (e.key === "ArrowRight"
                        ? step
                        : e.key === "ArrowLeft"
                          ? -step
                          : 0),
                    -16000,
                    16000,
                  ),
                  y: clamp(
                    layer.geometry.y +
                      (e.key === "ArrowDown"
                        ? step
                        : e.key === "ArrowUp"
                          ? -step
                          : 0),
                    -16000,
                    16000,
                  ),
                },
              },
            })),
        });
      } else if (!mod && ["+", "=", "-", "0"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "0") {
          setPrefs({ zoom: null });
          setViewReset((v) => v + 1);
        } else {
          const zoom =
            Number(
              document.querySelector<HTMLElement>('[data-testid="canvas-host"]')
                ?.dataset.zoom,
            ) || 0.5;
          setPrefs({
            zoom: clamp(zoom + (e.key === "-" ? -0.1 : 0.1), 0.1, 2),
          });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="editor-shell">
      <header className="topbar editor-topbar">
        <Button
          variant="ghost"
          size="icon"
          onClick={goHome}
          aria-label={t("home")}
          title={t("home")}
        >
          <ArrowLeft size={17} />
        </Button>
        <Logo compact />
        <span className="toolbar-divider" />
        <div className="project-heading">
          <input
            aria-label={t("projectName")}
            key={project.name}
            defaultValue={project.name}
            maxLength={100}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name) dispatch({ type: "rename", name });
              else e.target.value = project.name;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = project.name;
                e.currentTarget.blur();
              }
            }}
          />
          <span className="local-label">
            <HardDrive size={11} />
            {t("local")}
          </span>
        </div>
        <div className="topbar-spacer" />
        <span
          className={`save-status ${dirty ? "is-dirty" : ""}`}
          role="status"
        >
          {editor.saving ? (
            <LoaderCircle className="spin" size={13} />
          ) : dirty ? (
            <span className="unsaved-dot" />
          ) : (
            <Check size={13} />
          )}
          {t(editor.saving ? "saving" : dirty ? "unsaved" : "saved")}
        </span>
        <PreferencesControls />
        <span className="toolbar-divider" />
        <Button
          variant="ghost"
          size="icon"
          onClick={editor.download}
          aria-label={t("download")}
          title={t("download")}
        >
          <Download size={17} />
        </Button>
        <Button
          variant="primary"
          onClick={() => void editor.save()}
          disabled={editor.saving || editor.importing}
          data-testid="save-project"
        >
          <Save size={15} />
          <span>{t("save")}</span>
        </Button>
      </header>
      <div className="small-screen-fallback">
        <Monitor size={44} strokeWidth={1.2} />
        <h1>{t("smallTitle")}</h1>
        <p>{t("smallText")}</p>
        <Button onClick={goHome}>{t("home")}</Button>
        <small>{t("smallNote")}</small>
      </div>
      <div className="desktop-editor">
        <div className="editor-tools">
          <div className="tools-group">
            <span className="active-tool" title={t("canvasLabel")}>
              <MousePointer2 size={17} />
            </span>
            <span className="toolbar-divider" />
            <Button
              variant="ghost"
              onClick={() => add("text")}
              disabled={document.layers.length >= 200}
            >
              <Type size={17} />
              {t("addText")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => add("shape")}
              disabled={document.layers.length >= 200}
            >
              <Square size={16} />
              {t("addShape")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => imageInput.current?.click()}
              disabled={
                editor.importing || document.layers.length >= 200
              }
            >
              <ImagePlus size={17} />
              {t("addImage")}
            </Button>
            <input
              ref={imageInput}
              className="sr-only"
              tabIndex={-1}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              aria-label={t("importImages")}
              onChange={(e) =>
                void importFiles(Array.from(e.target.files ?? []))
              }
            />
            <span className="toolbar-divider" />
            <Button
              variant="ghost"
              title={`${t("groupLayers")} · ⌘G`}
              data-testid="group-layers"
              onClick={groupSelection}
              disabled={selection.length < 2 || selection.some((layer) => layer.locked)}
            ><GroupIcon size={16}/>{t("group")}</Button>
            <Button
              variant="ghost"
              title={`${t("ungroupLayers")} · ⇧⌘G`}
              data-testid="ungroup-layers"
              onClick={ungroupSelection}
              disabled={!selection.some((layer) => layer.groupId)}
            ><UngroupIcon size={16}/>{t("ungroup")}</Button>
            <span className="toolbar-divider" />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("undo")}
              title={`${t("undo")} · ⌘Z`}
              onClick={editor.undo}
              disabled={!editor.history.past.length}
            >
              <Undo2 size={17} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("redo")}
              title={`${t("redo")} · ⇧⌘Z`}
              onClick={editor.redo}
              disabled={!editor.history.future.length}
            >
              <Redo2 size={17} />
            </Button>
          </div>
          <div className="workspace-toolbar-summary" aria-label={t("artboards")}>
            <LayoutGrid size={15} />
            <span>{t("allArtboards")}</span>
            <span className="workspace-board-count">{project.variants.length + 1}</span>
          </div>
          <div className="tools-group panel-toggles">
            <Button variant="ghost" onClick={() => setExportOpen(true)} data-testid="export-open"><FileArchive size={16}/>{t("exportCreatives")}</Button>
            <Button
              variant={resizeOpen ? "primary" : "ghost"}
              aria-label={t("resizeStudio")}
              title={t("resizeStudio")}
              onClick={() => setResizeOpen((open) => !open)}
            >
              <LayoutGrid size={16} />
              {t("resize")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("smartGuides")}
              title={t("smartGuidesHint")}
              aria-pressed={prefs.snapping}
              onClick={() => setPrefs({ snapping: !prefs.snapping })}
            >
              <Magnet size={17} />
            </Button>
            {!prefs.leftOpen && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("showLayers")}
                onClick={() => setPrefs({ leftOpen: true })}
              >
                <PanelLeftOpen size={17} />
              </Button>
            )}
            {!prefs.rightOpen && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("showProperties")}
                onClick={() => setPrefs({ rightOpen: true })}
              >
                <PanelRightOpen size={17} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("shortcuts")}
              title={t("shortcuts")}
              onClick={() => setHelpOpen((h) => !h)}
            >
              <CircleHelp size={17} />
            </Button>
          </div>
        </div>
        <ResizePanel
          open={resizeOpen}
          project={project}
          activeVariant={editor.activeVariant}
          assets={editor.assets}
          blobs={editor.blobs}
          close={() => setResizeOpen(false)}
          recompose={editor.recompose}
          updateFlatImage={editor.setFlatImageSettings}
          generate={(presetIds, mode) => {
            editor.generateVariants(presetIds, mode);
            setResizeOpen(false);
          }}
          removeVariant={editor.removeVariant}
        />
        {editor.activeVariant && (() => {
          const warnings = validateVariant(document, editor.activeVariant.safeZone);
          return warnings.length ? (
            <div className="variant-warning-banner" role="status">
              <strong>{warnings.length} {t("warnings")}</strong>
              <span>{warnings[0]}</span>
              <Button variant="ghost" onClick={() => setResizeOpen(true)}>{t("review")}</Button>
            </div>
          ) : null;
        })()}
        {editor.saveError && (
          <ErrorNotice
            action={<Button onClick={editor.download}>{t("download")}</Button>}
          >
            {t("storageError")}
          </ErrorNotice>
        )}
        {importError && (
          <ErrorNotice
            action={
              <Button onClick={() => setImportError(null)}>
                {t("dismiss")}
              </Button>
            }
          >
            {t(importError)}
          </ErrorNotice>
        )}
        {notice && (
          <div className="import-notice" role="status">
            <p>{t(notice)}</p>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("dismiss")}
              onClick={() => setNotice(null)}
            >
              <X size={16} />
            </Button>
          </div>
        )}
        {helpOpen && (
          <div className="shortcuts-banner">
            <p>{t("shortcutText")}</p>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("dismiss")}
              onClick={() => setHelpOpen(false)}
            >
              <X size={16} />
            </Button>
          </div>
        )}
        <div className="editor-body">
          {prefs.leftOpen && (
            <>
              <div style={{ width: prefs.leftWidth }} className="panel-slot workspace-sidebar">
                <ArtboardManager project={project} activeVariantId={editor.activeVariantId}
                  focus={focusArtboard} arrange={editor.arrangeArtboards} addCustom={editor.addCustomVariant}
                  rename={editor.renameVariant} duplicate={editor.duplicateVariant} remove={editor.removeVariant}/>

                <LayersPanel
                  layers={document.layers}
                  dimensions={document}
                  artboardName={editor.activeVariant?.name ?? t("master")}
                  selectedIds={editor.selectedIds}
                  select={select}
                  selectMany={editor.selectMany}
                  groupSelection={groupSelection}
                  ungroupSelection={ungroupSelection}
                  renameGroup={(groupId, name) => dispatch({ type: "rename-group", groupId, name })}
                  toggleLockGroup={(ids, locked) => dispatch({ type: "batch", commands: ids.map((id) => ({ type: "set-lock", id, locked })) })}
                  toggleVisibleGroup={(ids, visible) => dispatch({ type: "batch", commands: ids.map((id) => ({ type: "set-visible", id, visible })) })}
                  toggleLock={(id) => dispatch({ type: "toggle-lock", id })}
                  toggleVisible={(id) => {
                    const layer = document.layers.find(
                      (l) => l.id === id,
                    );
                    if (layer)
                      dispatch({
                        type: "set-visible",
                        id,
                        visible: !layer.visible,
                      });
                  }}
                  rename={(layer, name) => editor.update({ ...layer, name })}
                />
              </div>
              <PanelDivider
                side="left"
                value={prefs.leftWidth}
                onChange={(leftWidth) => setPrefs({ leftWidth })}
                label={t("resizeLayers")}
              />
            </>
          )}
          <main
            className={`canvas-region ${dragging ? "is-dropping" : ""}`}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={(e) => {
              if (
                !(e.relatedTarget instanceof Node) ||
                !e.currentTarget.contains(e.relatedTarget)
              )
                setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void importFiles(Array.from(e.dataTransfer.files));
            }}
          >
            {(dragging || editor.importing) && (
              <div className="canvas-drop-overlay" role="status">
                {editor.importing ? (
                  <LoaderCircle className="spin" size={28} />
                ) : (
                  <ImagePlus size={28} />
                )}
                <strong>
                  {t(editor.importing ? "imageImportBusy" : "dropImages")}
                </strong>
                <span>PNG · JPG · WebP · SVG</span>
              </div>
            )}
            <Canvas
              key={viewReset}
              viewReset={viewReset}
              project={project}
              activeVariantId={editor.activeVariantId}
              activate={activateArtboard}
              focusRequest={focusRequest}
              moveArtboard={editor.moveArtboard}
              groupLayers={(ids) => dispatch({ type: "group-layers", ids, groupId: crypto.randomUUID(), name: t("newGroup") })}
              ungroupLayers={(id) => dispatch({ type: "ungroup-layers", ids: [id] })}
              duplicateLayers={(ids) => duplicate(document.layers.filter((layer) => ids.includes(layer.id)))}
              deleteLayers={(ids) => setDeleteIds(document.layers.filter((layer) => ids.includes(layer.id) && !layer.locked).map((layer) => layer.id))}
              assets={editor.assets}
              blobs={editor.blobs}
              selectedIds={editor.selectedIds}
              select={select}
              selectMany={editor.selectMany}
              updateMany={(layers) =>
                dispatch({
                  type: "batch",
                  commands: layers.map((layer) => ({
                    type: "update-layer",
                    layer,
                  })),
                })
              }
              snapping={prefs.snapping}
              editingId={editingId}
              editText={setEditingId}
              onDraftDirty={editor.setDraftDirty}
            />
          </main>
          {prefs.rightOpen && (
            <>
              <PanelDivider
                side="right"
                value={prefs.rightWidth}
                onChange={(rightWidth) => setPrefs({ rightWidth })}
                label={t("resizeProperties")}
              />
              <div style={{ width: prefs.rightWidth }} className="panel-slot">
                <PropertiesPanel
                  assets={editor.assets}
                  importFont={editor.importFont}
                  brandKit={project.brandKit}
                  createBrandColor={editor.createBrandColor}
                  editBrandColor={editor.editBrandColor}
                  removeBrandColor={editor.removeBrandColor}
                  createBrandTextStyle={editor.createBrandTextStyle}
                  editBrandTextStyle={editor.editBrandTextStyle}
                  removeBrandTextStyle={editor.removeBrandTextStyle}
                  setColorStyle={editor.setColorStyle}
                  setTextStyle={editor.setTextStyle}
                  selected={selected}
                  document={document}
                  update={editor.update}
                  changeBackground={(fill) =>
                    dispatch({ type: "background", fill })
                  }
                  selection={selection}
                  editText={() => {
                    if (selected) setEditingId(selected.id);
                  }}
                  crop={() => {
                    if (selected) setCropId(selected.id);
                  }}
                  metadata={(layer) =>
                    dispatch({
                      type: "metadata",
                      id: layer.id,
                      role: layer.role,
                      priority: layer.priority,
                      anchor: layer.anchor,
                      layout: layer.layout,
                    })
                  }
                  setLocked={setLocked}
                  setVisible={setVisible}
                  duplicate={() => duplicate()}
                  remove={remove}
                  reorder={reorder}
                  unlock={() => {
                    if (selected)
                      dispatch({ type: "toggle-lock", id: selected.id });
                  }}
                />
              </div>
            </>
          )}
        </div>
        <footer className="editor-statusbar">
          <span>
            <span className="status-dot" />
            {t("projectReady")}
          </span>
          <span>
            {document.layers.length} {t("layerCount")}
            <span className="status-separator">/</span>
            {selection.length > 1
              ? `${selection.length} ${t("selectedLayers")}`
              : selected
                ? selected.name
                : t("noLayer")}
          </span>
          <span className="keyboard-hint">{t("keyboardHint")}</span>
        </footer>
      </div>
      {exportOpen && <ExportDialog project={project} assets={editor.assets} blobs={editor.blobs}
        close={() => setExportOpen(false)} focusIssue={(issue) => {
          focusArtboard(issue.boardKey === "master" ? null : issue.boardKey);
          editor.setSelectedIds([issue.layerId]);
        }} />}
      {cropLayer?.type === "image" && cropAsset && (
        <CropDialog
          key={cropLayer.id}
          layer={cropLayer}
          asset={cropAsset}
          blobs={editor.blobs}
          close={() => setCropId(null)}
          apply={(crop) => {
            dispatch({ type: "crop-image", id: cropLayer.id, crop });
            setCropId(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleteIds.length > 0}
        onOpenChange={(open) => {
          if (!open) setDeleteIds([]);
        }}
        title={t("removeTitle")}
        description={t("removeText")}
        confirm={t("remove")}
        onConfirm={() => {
          dispatch({
            type: "batch",
            commands: deleteIds.map((id) => ({ type: "delete-layer", id })),
          });
          select(null);
        }}
      />
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={t("leaveTitle")}
        description={t("leaveText")}
        confirm={t("leave")}
        onConfirm={() => router.push("/")}
      />
    </div>
  );
}
