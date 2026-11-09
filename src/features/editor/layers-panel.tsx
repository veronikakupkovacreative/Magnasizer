"use client";
import { useRef, useState, type MouseEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Group as GroupIcon,
  ImageIcon,
  Layers3,
  LockKeyhole,
  PanelLeftClose,
  Square,
  Type,
  Ungroup,
  UnlockKeyhole,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/preferences";
import type { Layer } from "@/shared/schema/project";

const icons = { text: Type, shape: Square, image: ImageIcon };

type Props = {
  layers: Layer[];
  dimensions: { width: number; height: number };
  artboardName?: string;
  selectedIds: string[];
  select: (id: string, toggle?: boolean, individual?: boolean) => void;
  selectMany: (ids: string[]) => void;
  toggleLock: (id: string) => void;
  toggleVisible: (id: string) => void;
  rename: (layer: Layer, name: string) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  renameGroup: (groupId: string, name: string) => void;
  toggleLockGroup: (ids: string[], locked: boolean) => void;
  toggleVisibleGroup: (ids: string[], visible: boolean) => void;
};

export function LayersPanel({
  layers, dimensions, artboardName, selectedIds, select, selectMany, toggleLock,
  toggleVisible, rename, groupSelection, ungroupSelection, renameGroup,
  toggleLockGroup, toggleVisibleGroup,
}: Props) {
  const { t, setPrefs } = usePreferences();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const reversed = [...layers].reverse();
  const groupMap = new Map<string, Layer[]>();
  for (const layer of reversed) if (layer.groupId) {
    const members = groupMap.get(layer.groupId) ?? [];
    members.push(layer);
    groupMap.set(layer.groupId, members);
  }
  const seenGroups = new Set<string>();
  const entries: ({ type: "layer"; layer: Layer } | { type: "group"; id: string; members: Layer[] })[] = [];
  for (const layer of reversed) {
    if (layer.groupId) {
      if (!seenGroups.has(layer.groupId)) {
        seenGroups.add(layer.groupId);
        entries.push({ type: "group", id: layer.groupId, members: groupMap.get(layer.groupId)! });
      }
    } else entries.push({ type: "layer", layer });
  }
  const selectRange = (layer: Layer, index: number, event: MouseEvent) => {
    if (event.shiftKey && anchor.current) {
      const first = reversed.findIndex((item) => item.id === anchor.current);
      if (first >= 0) {
        selectMany(reversed.slice(Math.min(first, index), Math.max(first, index) + 1).map((item) => item.id));
        return;
      }
    }
    select(layer.id, event.metaKey || event.ctrlKey, event.altKey);
    anchor.current = layer.id;
  };
  const renderLayer = (layer: Layer, nested = false) => {
    const Icon = icons[layer.type];
    const index = reversed.findIndex((item) => item.id === layer.id);
    return (
      <div
        role="listitem"
        className={`layer-row ${nested ? "group-child-row" : ""} ${selectedIds.includes(layer.id) ? "selected" : ""} ${layer.locked ? "locked" : ""} ${!layer.visible ? "is-hidden" : ""}`}
        key={layer.id}
        data-testid={`layer-${layer.id}`}
      >
        {renaming === layer.id ? (
          <input
            autoFocus className="layer-rename" aria-label={t("layerName")}
            defaultValue={layer.name} maxLength={100}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              if (e.target.value.trim()) rename(layer, e.target.value.trim());
              setRenaming(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = layer.name;
                e.currentTarget.blur();
                e.stopPropagation();
              }
            }}
          />
        ) : (
          <button
            className="layer-select" aria-pressed={selectedIds.includes(layer.id)}
            onDoubleClick={() => { if (!layer.locked) setRenaming(layer.id); }}
            onKeyDown={(e) => {
              if (e.key === "F2" && !layer.locked) {
                e.preventDefault(); e.stopPropagation(); setRenaming(layer.id);
              }
            }}
            onClick={(e) => selectRange(layer, index, e)}
            title={layer.groupId ? t("groupHint") : layer.name}
          >
            <Icon size={15} style={layer.type === "shape" ? { color: layer.style.fill } : undefined}/>
            <span>{layer.name}</span>
          </button>
        )}
        <Button className="layer-visibility" variant="ghost" size="icon"
          aria-label={`${t(layer.visible ? "hideLayer" : "showLayer")}: ${layer.name}`}
          title={t(layer.visible ? "hideLayer" : "showLayer")}
          onClick={() => toggleVisible(layer.id)}>
          {layer.visible ? <Eye size={13}/> : <EyeOff size={13}/>}
        </Button>
        <Button className="layer-lock" variant="ghost" size="icon"
          aria-label={`${t(layer.locked ? "unlock" : "lock")}: ${layer.name}`}
          title={t(layer.locked ? "unlock" : "lock")}
          onClick={() => toggleLock(layer.id)}>
          {layer.locked ? <LockKeyhole size={13}/> : <UnlockKeyhole size={13}/>}
        </Button>
      </div>
    );
  };
  return (
    <aside className="layers-panel panel" aria-label={t("layers")}>
      <div className="panel-heading">
        <h2>{t("layers")}</h2>
        <span className="count-pill">{layers.length}</span>
        <Button variant="ghost" size="icon" aria-label={t("groupLayers")}
          title={`${t("groupLayers")} · ⌘G`}
          disabled={selectedIds.length < 2 || layers.filter((item) => selectedIds.includes(item.id)).some((item) => item.locked)}
          onClick={groupSelection}><GroupIcon size={15}/></Button>
        <Button variant="ghost" size="icon" aria-label={t("ungroupLayers")}
          title={`${t("ungroupLayers")} · ⇧⌘G`}
          disabled={!selectedIds.some((id) => layers.some((layer) => layer.id === id && layer.groupId))}
          onClick={ungroupSelection}><Ungroup size={15}/></Button>
        <Button variant="ghost" size="icon" aria-label={t("hideLayers")}
          onClick={() => setPrefs({ leftOpen: false })}>
          <PanelLeftClose size={16}/>
        </Button>
      </div>
      <div className="master-row">
        <Layers3 size={15}/>
        <strong>{artboardName ?? t("master")}</strong>
        <span>{dimensions.width} × {dimensions.height}</span>
      </div>
      <div className="layer-list" role="list" aria-label={t("layers")}>
        {!layers.length && <div className="panel-empty">
          <Layers3 size={26}/><strong>{t("emptyLayers")}</strong><p>{t("emptyLayersText")}</p>
        </div>}
        {entries.map((entry) => {
          if (entry.type === "layer") return renderLayer(entry.layer);
          const { id, members } = entry;
          const isCollapsed = collapsed.includes(id);
          const isSelected = members.every((layer) => selectedIds.includes(layer.id));
          const name = members[0].groupName ?? t("newGroup");
          const allLocked = members.every((layer) => layer.locked);
          const allVisible = members.every((layer) => layer.visible);
          return (
            <div key={`group-${id}`} className="layer-group" data-testid={`group-${id}`} role="listitem">
              <div className={`layer-row layer-group-heading ${isSelected ? "selected" : ""}`}>
                <button className="layer-group-chevron"
                  title={t(isCollapsed ? "expandGroup" : "collapseGroup")}
                  aria-label={`${t(isCollapsed ? "expandGroup" : "collapseGroup")}: ${name}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => setCollapsed((prev) => isCollapsed ? prev.filter((value) => value !== id) : [...prev, id])}>
                  {isCollapsed ? <ChevronRight size={13}/> : <ChevronDown size={13}/>}
                </button>
                {renaming === id ? (
                  <input autoFocus className="layer-rename" defaultValue={name} maxLength={100}
                    aria-label={t("renameGroup")}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => { if (e.target.value.trim()) renameGroup(id, e.target.value.trim()); setRenaming(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") { e.currentTarget.value = name; e.currentTarget.blur(); e.stopPropagation(); }
                    }}/>
                ) : (
                  <button className="layer-select layer-group-select" aria-pressed={isSelected}
                    title={t("groupHint")}
                    onClick={(e) => {
                      const ids = members.map((item) => item.id);
                      if (e.metaKey || e.ctrlKey) select(ids[0], true);
                      else selectMany(ids);
                      anchor.current = members[0].id;
                    }}
                    onDoubleClick={() => setRenaming(id)}
                    onKeyDown={(e) => { if (e.key === "F2") { e.preventDefault(); setRenaming(id); } }}>
                    {isCollapsed ? <Folder size={15}/> : <FolderOpen size={15}/>}
                    <span>{name}</span>
                    <span className="layer-group-count">{members.length}</span>
                  </button>
                )}
                <Button className="layer-visibility" variant="ghost" size="icon"
                  title={t(allVisible ? "hideLayer" : "showLayer")}
                  aria-label={`${t(allVisible ? "hideLayer" : "showLayer")}: ${name}`}
                  onClick={() => toggleVisibleGroup(members.map((layer) => layer.id), !allVisible)}>
                  {allVisible ? <Eye size={13}/> : <EyeOff size={13}/>}
                </Button>
                <Button className="layer-lock" variant="ghost" size="icon"
                  title={t(allLocked ? "unlock" : "lock")}
                  aria-label={`${t(allLocked ? "unlock" : "lock")}: ${name}`}
                  onClick={() => toggleLockGroup(members.map((layer) => layer.id), !allLocked)}>
                  {allLocked ? <LockKeyhole size={13}/> : <UnlockKeyhole size={13}/>}
                </Button>
              </div>
              {!isCollapsed && <div className="layer-group-children" role="list" aria-label={name}>
                {members.map((layer) => renderLayer(layer, true))}
              </div>}
            </div>
          );
        })}
      </div>
      <div className="panel-bottom">
        <span className="status-dot"/>
        {selectedIds.length > 1 ? `${selectedIds.length} ${t("selectedLayers")}` : t("editable")}
        <span>01</span>
      </div>
    </aside>
  );
}
