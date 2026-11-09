import {
  projectSchema,
  type Layer,
  type Project,
  type Crop,
} from "@/shared/schema/project";
import { cropImageLayer } from "./crop";
import { resizeGeometry } from "./geometry";

export type SingleCommand =
  | { type: "update-layer"; layer: Layer }
  | { type: "insert-layer"; layer: Layer }
  | { type: "delete-layer"; id: string }
  | { type: "group-layers"; ids: string[]; groupId: string; name: string }
  | { type: "ungroup-layers"; ids: string[] }
  | { type: "rename-group"; groupId: string; name: string }
  | { type: "toggle-lock"; id: string }
  | { type: "reorder"; id: string; direction: "up" | "down" }
  | { type: "rename"; name: string }
  | { type: "background"; fill: string }
  | { type: "set-visible"; id: string; visible: boolean }
  | { type: "set-lock"; id: string; locked: boolean }
  | { type: "crop-image"; id: string; crop: Crop }
  | {
      type: "metadata";
      id: string;
      role: Layer["role"];
      priority: number;
      anchor: Layer["anchor"];
      layout: Layer["layout"];
    }
  | {
      type: "reorder-layers";
      ids: string[];
      direction: "up" | "down" | "front" | "back";
    };
export type Command =
  SingleCommand | { type: "batch"; commands: SingleCommand[] };
export type HistoryEntry = {
  before: Project;
  after: Project;
  command: Command["type"];
};
export type History = {
  past: HistoryEntry[];
  present: Project;
  future: HistoryEntry[];
};
export const HISTORY_LIMIT = 100;
export const createHistory = (project: Project): History => ({
  past: [],
  present: projectSchema.parse(project),
  future: [],
});

export function applyCommand(project: Project, command: Command): Project {
  if (command.type === "batch")
    return command.commands.reduce(applyCommand, project);
  const layers = project.document.layers;
  let next = layers;
  switch (command.type) {
    case "group-layers": {
      const ids = new Set(command.ids);
      if (ids.size < 2 || command.name.trim().length === 0 || layers.some((layer) => layer.groupId === command.groupId)) return project;
      const members = layers.filter((layer) => ids.has(layer.id) && !layer.locked);
      if (members.length !== ids.size || members.length < 2) return project;
      next = layers.map((layer) => ids.has(layer.id)
        ? { ...layer, groupId: command.groupId, groupName: command.name.trim() }
        : layer);
      break;
    }
    case "ungroup-layers": {
      const groupIds = new Set(layers.filter((layer) => command.ids.includes(layer.id) && layer.groupId).map((layer) => layer.groupId));
      if (!groupIds.size) return project;
      next = layers.map((layer) => layer.groupId && groupIds.has(layer.groupId)
        ? { ...layer, groupId: undefined, groupName: undefined }
        : layer);
      break;
    }
    case "rename-group": {
      const name = command.name.trim();
      if (!name || !layers.some((layer) => layer.groupId === command.groupId)) return project;
      next = layers.map((layer) => layer.groupId === command.groupId ? { ...layer, groupName: name } : layer);
      break;
    }
    case "set-visible":
      next = layers.map((l) =>
        l.id === command.id ? { ...l, visible: command.visible } : l,
      );
      break;
    case "set-lock":
      next = layers.map((l) =>
        l.id === command.id ? { ...l, locked: command.locked } : l,
      );
      break;
    case "crop-image":
      next = layers.map((l) =>
        l.id === command.id && l.type === "image" && !l.locked
          ? cropImageLayer(l, command.crop)
          : l,
      );
      break;
    case "metadata":
      next = layers.map((l) =>
        l.id === command.id && !l.locked
          ? {
              ...l,
              role: command.role,
              priority: command.priority,
              anchor: command.anchor,
              layout: command.layout,
            }
          : l,
      );
      break;
    case "reorder-layers": {
      const ids = new Set(
        command.ids.filter((id) =>
          layers.some((l) => l.id === id && !l.locked),
        ),
      );
      next = [...layers];
      if (command.direction === "front")
        next = [
          ...layers.filter((l) => !ids.has(l.id)),
          ...layers.filter((l) => ids.has(l.id)),
        ];
      else if (command.direction === "back")
        next = [
          ...layers.filter((l) => ids.has(l.id)),
          ...layers.filter((l) => !ids.has(l.id)),
        ];
      else if (command.direction === "up") {
        for (let i = next.length - 2; i >= 0; i--)
          if (ids.has(next[i].id) && !ids.has(next[i + 1].id))
            [next[i], next[i + 1]] = [next[i + 1], next[i]];
      } else {
        for (let i = 1; i < next.length; i++)
          if (ids.has(next[i].id) && !ids.has(next[i - 1].id))
            [next[i], next[i - 1]] = [next[i - 1], next[i]];
      }
      break;
    }
    case "rename":
      return projectSchema.parse({ ...project, name: command.name });
    case "background":
      return projectSchema.parse({
        ...project,
        document: { ...project.document, background: command.fill, backgroundStyleId: undefined },
      });
    case "update-layer":
      next = layers.map((layer) => {
        if (
          layer.id !== command.layer.id ||
          layer.locked ||
          layer.type !== command.layer.type
        )
          return layer;
        const incoming = command.layer;
        const size = resizeGeometry(
          layer,
          incoming.geometry.width,
          incoming.geometry.height,
          incoming.geometry.width === layer.geometry.width ? "height" : "width",
        );
        return {
          ...incoming,
          id: layer.id,
          sourceId: layer.sourceId,
          zIndex: layer.zIndex,
          locked: layer.locked,
          constraints: layer.constraints,
          visible: layer.visible,
          ...(layer.type === "image" && incoming.type === "image"
            ? { assetId: layer.assetId, crop: layer.crop }
            : {}),
          geometry: {
            ...incoming.geometry,
            width: size.width,
            height: size.height,
          },
        };
      });
      break;
    case "insert-layer":
      if (layers.some((l) => l.id === command.layer.id)) return project;
      next = [...layers, command.layer];
      break;
    case "delete-layer":
      next = layers.filter((l) => l.id !== command.id || l.locked);
      break;
    case "toggle-lock":
      next = layers.map((l) =>
        l.id === command.id ? { ...l, locked: !l.locked } : l,
      );
      break;
    case "reorder": {
      const index = layers.findIndex((l) => l.id === command.id);
      if (index < 0 || layers[index].locked) return project;
      const target = index + (command.direction === "up" ? 1 : -1);
      if (target < 0 || target >= layers.length) return project;
      next = [...layers];
      [next[index], next[target]] = [next[target], next[index]];
      break;
    }
  }
  return projectSchema.parse({
    ...project,
    document: {
      ...project.document,
      layers: next.map((layer, zIndex) => ({ ...layer, zIndex })),
    },
  });
}
export function execute(history: History, command: Command): History {
  const after = applyCommand(history.present, command);
  if (JSON.stringify(after) === JSON.stringify(history.present)) return history;
  const entry: HistoryEntry = {
    before: history.present,
    after,
    command: command.type,
  };
  return {
    past: [...history.past, entry].slice(-HISTORY_LIMIT),
    present: after,
    future: [],
  };
}
export function undo(history: History): History {
  const entry = history.past.at(-1);
  return entry
    ? {
        past: history.past.slice(0, -1),
        present: entry.before,
        future: [entry, ...history.future],
      }
    : history;
}
export function redo(history: History): History {
  const entry = history.future[0];
  return entry
    ? {
        past: [...history.past, entry],
        present: entry.after,
        future: history.future.slice(1),
      }
    : history;
}
