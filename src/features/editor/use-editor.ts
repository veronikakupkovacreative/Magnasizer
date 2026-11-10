"use client";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  applyCommand,
  createHistory,
  execute,
  HISTORY_LIMIT,
  redo,
  undo,
  type Command,
  type History,
} from "./model/history";
import { localProjects } from "@/lib/db/projects";
import {
  projectSchema,
  MAX_VARIANTS,
  type Layer,
  type BrandKit,
  type FlatImageSettings,
  type LoadedProject,
  type Project,
} from "@/shared/schema/project";
import { encodeProject } from "@/features/assets/project-file";
import {
  asFlatMaster,
  assetKeys,
  imageLayer,
  importImage,
  MAX_TOTAL_BYTES,
} from "@/features/assets/import";
import { FORMAT_PRESETS } from "@/features/formats/presets";
import { mergeGeneratedVariants, generateVariant, strategyFor, recomposeVariant, variantCountAfterGeneration, type CompositionMode } from "@/features/resize/engine";
import { addBrandColor, addBrandTextStyle, updateBrandColor, updateBrandTextStyle, deleteBrandColor, deleteBrandTextStyle, applyColorStyle, applyTextStyle } from "./brand-styles";

function commitProject(history: History, next: Project, command = "batch"): History {
  const parsed = projectSchema.parse(next);
  if (JSON.stringify(parsed) === JSON.stringify(history.present)) return history;
  const entry = {
    before: history.present,
    after: parsed,
    command: command as Command["type"],
  };
  return {
    past: [...history.past, entry].slice(-HISTORY_LIMIT),
    present: parsed,
    future: [],
  };
}

export function useEditor(initial: LoadedProject) {
  const [history, setHistory] = useState(() =>
    createHistory(initial.bundle.project),
  );
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assets, setAssets] = useState(initial.bundle.assets);
  const [blobs, setBlobs] = useState(initial.blobs);
  const [savedSnapshot, setSavedSnapshot] = useState(
    JSON.stringify({ project: initial.bundle.project, assets: initial.bundle.assets }),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const savingRef = useRef(false);
  const importingRef = useRef(false);
  const project = history.present;
  const activeVariant = activeVariantId
    ? project.variants.find((variant) => variant.id === activeVariantId) ?? null
    : null;
  const document = activeVariant?.document ?? project.document;
  const selection = document.layers.filter((l) => selectedIds.includes(l.id));
  const selected = selection.length === 1 ? selection[0] : null;
  const groupMembers = useCallback((id: string) => {
    const active = activeVariantId ? project.variants.find((variant) => variant.id === activeVariantId)?.document : project.document;
    const layer = active?.layers.find((item) => item.id === id);
    return layer?.groupId
      ? active!.layers.filter((item) => item.groupId === layer.groupId).map((item) => item.id)
      : [id];
  }, [activeVariantId, project]);
  const select = useCallback(
    (id: string | null, toggle = false, individual = false) =>
      setSelectedIds((ids) => {
        if (id === null) return [];
        const targets = individual ? [id] : groupMembers(id);
        const set = new Set(ids);
        const allSelected = targets.every((item) => set.has(item));
        if (!toggle) return targets;
        targets.forEach((item) => allSelected ? set.delete(item) : set.add(item));
        return [...set];
      }),
    [groupMembers],
  );
  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds([...new Set(ids.flatMap((id) => groupMembers(id)))]);
  }, [groupMembers]);
  const effectiveAssets = useMemo(() => {
    const docs = [project.document, ...project.variants.map(variant => variant.document)];
    const referenced = new Set(docs.flatMap(doc => doc.layers.flatMap(layer => layer.type === "image" ? [layer.assetId] : [])));
    return assets.filter(asset => asset.kind === "imported-font" || referenced.has(asset.id));
  }, [project, assets]);
  const dirty = draftDirty || JSON.stringify({ project, assets: effectiveAssets }) !== savedSnapshot;

  const dispatch = useCallback(
    (command: Command) => {
      setHistory((current) => {
        if (!activeVariantId || command.type === "rename")
          return execute(current, command);
        const target = current.present.variants.find(
          (variant) => variant.id === activeVariantId,
        );
        if (!target) return current;
        const working = projectSchema.parse({
          ...current.present,
          document: target.document,
        });
        const edited = applyCommand(working, command);
        const next = {
          ...current.present,
          variants: current.present.variants.map((variant) =>
            variant.id === activeVariantId
              ? { ...variant, status: "customized" as const, document: edited.document }
              : variant,
          ),
        };
        return commitProject(current, next, command.type);
      });
    },
    [activeVariantId],
  );

  const stepUndo = useCallback(() => setHistory(undo), []);
  const stepRedo = useCallback(() => setHistory(redo), []);
  const update = useCallback(
    (layer: Layer) => dispatch({ type: "update-layer", layer }),
    [dispatch],
  );
  const latest = useRef({ project, assets, blobs });
  useLayoutEffect(() => {
    latest.current = { project, assets, blobs };
  }, [project, assets, blobs]);
  useLayoutEffect(() => {
    if (activeVariantId && !activeVariant) {
      setActiveVariantId(null);
      setSelectedIds([]);
    }
  }, [activeVariantId, activeVariant]);

  const switchDocument = useCallback((variantId: string | null) => {
    setActiveVariantId(variantId);
    setSelectedIds([]);
    setDraftDirty(false);
  }, []);

  const generateVariants = useCallback((presetIds: string[], composition: CompositionMode = "auto") => {
    const ids = new Set(presetIds);
    const presets = FORMAT_PRESETS.filter((preset) => ids.has(preset.id));
    if (!presets.length) return;
    setHistory((current) => {
      if (variantCountAfterGeneration(current.present.variants, presets) > MAX_VARIANTS) return current;
      const generated = mergeGeneratedVariants(
        current.present.document,
        presets,
        current.present.variants,
        composition,
        current.present.flatImage,
      );
      const selectedKeys = new Set(
        presets.map((preset) => `${preset.id}@${preset.version}`),
      );
      const retained = current.present.variants.filter(
        (variant) => !selectedKeys.has(`${variant.presetId}@${variant.presetVersion}`),
      );
      const next = {
        ...current.present,
        variants: [...retained, ...generated],
        updatedAt: new Date().toISOString(),
      };
      return commitProject(current, next);
    });
  }, []);

  const recompose = useCallback((variantId: string, composition: CompositionMode) => {
    setHistory((current) => {
      const original = current.present.variants.find((variant) => variant.id === variantId);
      if (!original) return current;
      return commitProject(current, {
        ...current.present,
        variants: current.present.variants.map((variant) => variant.id === variantId
          ? recomposeVariant(current.present.document, variant, composition, current.present.flatImage)
          : variant),
        updatedAt: new Date().toISOString(),
      });
    });
    setSelectedIds([]);
  }, []);

  const setFlatImageSettings = useCallback((settings: FlatImageSettings) => {
    setHistory((current) => commitProject(current, {
      ...current.present,
      flatImage: settings,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const createBrandColor = useCallback((name: string, value: string) => {
    const id = crypto.randomUUID();
    setHistory((current) => commitProject(current, addBrandColor(current.present, { id, name, value })));
  }, []);
  const editBrandColor = useCallback((id: string, name: string, value: string) => {
    setHistory((current) => commitProject(current, updateBrandColor(current.present, id, value, name)));
  }, []);
  const removeBrandColor = useCallback((id: string) => {
    setHistory((current) => commitProject(current, deleteBrandColor(current.present, id)));
  }, []);
  const createBrandTextStyle = useCallback((name: string, source: Extract<Layer, { type: "text" }>["style"]) => {
    const id = crypto.randomUUID();
    setHistory((current) => commitProject(current, addBrandTextStyle(current.present, { id, name, fontFamily: source.fontFamily, fontSize: source.fontSize, fontWeight: source.fontWeight, align: source.align })));
  }, []);
  const editBrandTextStyle = useCallback((id: string, next: BrandKit["textStyles"][number]) => {
    setHistory((current) => commitProject(current, updateBrandTextStyle(current.present, id, next)));
  }, []);
  const removeBrandTextStyle = useCallback((id: string) => {
    setHistory((current) => commitProject(current, deleteBrandTextStyle(current.present, id)));
  }, []);
  const setColorStyle = useCallback((layerId: string | null, styleId: string | null) => {
    setHistory((current) => commitProject(current, applyColorStyle(current.present, activeVariantId, layerId, styleId)));
  }, [activeVariantId]);
  const setTextStyle = useCallback((layerId: string, styleId: string | null) => {
    setHistory((current) => commitProject(current, applyTextStyle(current.present, activeVariantId, layerId, styleId)));
  }, [activeVariantId]);

  const removeVariant = useCallback((variantId: string) => {
    setHistory((current) =>
      commitProject(current, {
        ...current.present,
        variants: current.present.variants.filter((variant) => variant.id !== variantId),
        workspacePositions: Object.fromEntries(
          Object.entries(current.present.workspacePositions ?? {}).filter(([key]) => key !== variantId),
        ),
        updatedAt: new Date().toISOString(),
      }),
    );
    setActiveVariantId((current) => (current === variantId ? null : current));
    setSelectedIds([]);
  }, []);

  const moveArtboard = useCallback((key: string, position: { x: number; y: number }) => {
    setHistory((current) => commitProject(current, {
      ...current.present,
      workspacePositions: {
        ...current.present.workspacePositions,
        [key]: { x: Math.max(0, Math.min(16000, Math.round(position.x))), y: Math.max(0, Math.min(16000, Math.round(position.y))) },
      },
    }));
  }, []);
  const arrangeArtboards = useCallback(() => {
    setHistory((current) => {
      const { workspacePositions: _positions, ...rest } = current.present;
      void _positions;
      return commitProject(current, rest);
    });
  }, []);
  const renameVariant = useCallback((id: string, name: string) => {
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) return;
    setHistory((current) => commitProject(current, {
      ...current.present,
      variants: current.present.variants.map((v) => v.id === id ? { ...v, name: trimmed } : v),
    }));
  }, []);
  const duplicateVariant = useCallback((id: string) => {
    const source = latest.current.project.variants.find((v) => v.id === id);
    if (!source || latest.current.project.variants.length >= MAX_VARIANTS) return;
    const freshId = crypto.randomUUID();
    setHistory((current) => commitProject(current, {
      ...current.present,
      variants: [...current.present.variants, {
        ...structuredClone(source), id: freshId, presetId: `duplicate-${freshId}`,
        name: `${source.name.slice(0, 85)} copy`, platform: "custom" as const,
        status: "customized" as const, document: { ...structuredClone(source.document), id: crypto.randomUUID() },
      }],
    }));
    setActiveVariantId(freshId);
    setSelectedIds([]);
  }, []);
  const addCustomVariant = useCallback((name: string, width: number, height: number) => {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64 || width > 8192 || height > 8192 || latest.current.project.variants.length >= MAX_VARIANTS) return false;
    const freshId = crypto.randomUUID();
    const variant = generateVariant(latest.current.project.document, {
      id: `custom-${freshId}`, name: name.trim().slice(0, 100) || `${width} × ${height}`,
      width, height, platform: "meta", version: 1,
      safeZone: { top: Math.round(height * .05), bottom: Math.round(height * .05), left: Math.round(width * .05), right: Math.round(width * .05) },
    }, "auto", latest.current.project.flatImage);
    variant.id = freshId;
    variant.platform = "custom";
    variant.status = "customized";
    variant.strategy = strategyFor(width, height);
    setHistory((current) => commitProject(current, { ...current.present, variants: [...current.present.variants, variant] }));
    setActiveVariantId(freshId);
    setSelectedIds([]);
    return true;
  }, []);
  const importFont = useCallback(async (file: File) => {
    const { importFontFile } = await import("@/features/assets/fonts");
    const result = await importFontFile(file);
    if (latest.current.assets.some((asset) => asset.kind === "imported-font" && asset.fontFamily === result.asset.fontFamily)) throw new Error("fontAlreadyAdded");
    const total = Object.values(latest.current.blobs).reduce((sum, blob) => sum + blob.size, 0) + result.blob.size;
    if (total > MAX_TOTAL_BYTES) throw new Error("projectTooLarge");
    let face: FontFace;
    try {
      face = new FontFace(result.asset.fontFamily, await result.blob.arrayBuffer());
      await face.load();
      window.document.fonts.add(face);
    } catch {
      throw new Error("fontDecodeError");
    }
    setAssets((old) => [...old, result.asset]);
    setBlobs((old) => ({ ...old, [result.asset.blobKey]: result.blob }));
    return result.asset;
  }, []);

  const currentBundle = useCallback(() => {
    const {
      project: snapshot,
      assets: allAssets,
      blobs: files,
    } = latest.current;
    const docs = [snapshot.document, ...snapshot.variants.map((variant) => variant.document)];
    const ids = new Set(
      docs.flatMap((doc) =>
        doc.layers.flatMap((l) => (l.type === "image" ? [l.assetId] : [])),
      ),
    );
    return {
      bundle: {
        ...initial.bundle,
        project: snapshot,
        assets: allAssets.filter((a) => a.kind === "imported-font" || ids.has(a.id)),
      },
      blobs: files,
    };
  }, [initial.bundle]);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    const snapshot = currentBundle();
    try {
      await localProjects.save(snapshot.bundle, snapshot.blobs);
      setSavedSnapshot(JSON.stringify({ project: snapshot.bundle.project, assets: snapshot.bundle.assets }));
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [currentBundle]);

  const download = useCallback(async () => {
    try {
      const snapshot = currentBundle();
      const json = await encodeProject(snapshot.bundle, snapshot.blobs);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${snapshot.bundle.project.name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80)}.srs.json`;
      window.document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setSaveError(true);
    }
  }, [currentBundle]);

  const importFiles = useCallback(
    async (files: File[]) => {
      if (importingRef.current || !files.length) return 0;
      if (files.length > 20) throw new Error("tooManyFiles");
      importingRef.current = true;
      setImporting(true);
      try {
        const imported = [];
        const stagedBlobs = { ...latest.current.blobs };
        for (const file of files) {
          const result = await importImage(file);
          Object.assign(stagedBlobs, result.blobs);
          if (
            Object.values(stagedBlobs).reduce(
              (sum, blob) => sum + blob.size,
              0,
            ) > MAX_TOTAL_BYTES
          )
            throw new Error("projectTooLarge");
          imported.push(result);
        }
        const nextBlobs = {
          ...latest.current.blobs,
          ...Object.assign({}, ...imported.map((a) => a.blobs)),
        };
        const nextAssets = [
          ...latest.current.assets,
          ...imported.map((a) => a.asset),
        ];
        if (nextAssets.length > 200 || document.layers.length + imported.length > 200)
          throw new Error("tooManyFiles");
        if (
          assetKeys(nextAssets).reduce(
            (sum, key) => sum + nextBlobs[key].size,
            0,
          ) > MAX_TOTAL_BYTES
        )
          throw new Error("projectTooLarge");
        const canUseFlatMaster = !activeVariantId && document.layers.length === 0 && imported.length === 1;
        const flatDocument = canUseFlatMaster ? structuredClone(document) : null;
        const flat = flatDocument ? asFlatMaster(imported[0].asset, flatDocument) : null;
        const layers = flat ? flatDocument!.layers : imported.map((a, i) => imageLayer(a.asset, document, i * 24));
        setAssets(nextAssets);
        setBlobs(nextBlobs);
        if (flat && flatDocument) {
          setHistory((current) => commitProject(current, {
            ...current.present,
            document: flatDocument,
            flatImage: flat,
            updatedAt: new Date().toISOString(),
          }));
        } else {
          dispatch({
            type: "batch",
            commands: layers.map((layer) => ({ type: "insert-layer", layer })),
          });
        }
        setSelectedIds(layers.map((l) => l.id));
        return imported.reduce((n, a) => n + a.removed, 0);
      } finally {
        importingRef.current = false;
        setImporting(false);
      }
    },
    [dispatch, document, activeVariantId],
  );

  const variantWarnings = useMemo(
    () => activeVariant?.safeZone ?? null,
    [activeVariant],
  );

  return {
    history,
    project,
    document,
    activeVariant,
    activeVariantId,
    variantWarnings,
    assets,
    blobs,
    selection,
    selected,
    selectedIds,
    select,
    selectMany,
    setSelectedIds,
    switchDocument,
    generateVariants, recompose, setFlatImageSettings,
    createBrandColor, editBrandColor, removeBrandColor, createBrandTextStyle, editBrandTextStyle, removeBrandTextStyle, setColorStyle, setTextStyle,
    removeVariant,
    moveArtboard, arrangeArtboards, renameVariant, duplicateVariant, addCustomVariant, importFont,
    dirty,
    draftDirty,
    setDraftDirty,
    saving,
    saveError,
    importing,
    importFiles,
    dispatch,
    undo: stepUndo,
    redo: stepRedo,
    update,
    save,
    download,
  };
}
