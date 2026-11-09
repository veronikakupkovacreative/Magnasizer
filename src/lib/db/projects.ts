import { openDB, type DBSchema } from "idb";
import {
  bundleSchema,
  migrateProject,
  type Asset,
  type AssetBlobs,
  type LoadedProject,
  type Project,
  type ProjectBundle,
} from "@/shared/schema/project";
import { assetKeys } from "@/features/assets/import";

interface StudioDB extends DBSchema {
  projects: { key: string; value: Project };
  assets: { key: string; value: Asset };
  catalog: { key: [string, string]; value: Asset & { projectId: string } };
  binaries: { key: string; value: Blob };
}
export interface ProjectRepository {
  list(): Promise<Project[]>;
  load(id: string): Promise<LoadedProject | undefined>;
  save(bundle: ProjectBundle, blobs?: AssetBlobs): Promise<ProjectBundle>;
  remove(id: string): Promise<boolean>;
}
const database = () =>
  openDB<StudioDB>("smart-resize-studio", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("projects", { keyPath: "id" });
        db.createObjectStore("assets", { keyPath: "id" });
      }
      if (oldVersion < 2) {
        db.createObjectStore("catalog", { keyPath: ["projectId", "id"] });
        db.createObjectStore("binaries");
      }
    },
  });
export const localProjects: ProjectRepository = {
  async list() {
    const db = await database();
    try {
      return (await db.getAll("projects"))
        .map(migrateProject)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } finally {
      db.close();
    }
  },
  async load(id) {
    const db = await database();
    try {
      const stored = await db.get("projects", id);
      if (!stored) return undefined;
      const project = migrateProject(stored);
      const documents = [
        project.document,
        ...project.variants.map((variant) => variant.document),
      ];
      const ids = [
        ...new Set(
          documents.flatMap((document) =>
            document.layers.flatMap((l) =>
              l.type === "image" ? [l.assetId] : [],
            ),
          ),
        ),
      ];
      const fontEntries = (await db.getAll("catalog", IDBKeyRange.bound([id, ""], [id, "\uffff"]))).filter((asset) => asset.kind === "imported-font");
      const assets = await Promise.all(
        ids.map(async (assetId) => {
          const entry = await db.get("catalog", [id, assetId]);
          if (entry) {
            const { projectId: _projectId, ...asset } = entry;
            void _projectId;
            return asset;
          }
          return db.get("assets", assetId);
        }),
      );
      const bundle = bundleSchema.parse({
        format: "smart-resize-studio",
        version: 2,
        project,
        assets: [...assets, ...fontEntries.map(({ projectId: _projectId, ...font }) => { void _projectId; return font; })],
      });
      const blobs: AssetBlobs = {};
      for (const key of assetKeys(bundle.assets)) {
        const blob = await db.get("binaries", key);
        if (!blob) throw new Error("missingAsset");
        blobs[key] = blob;
      }
      return { bundle, blobs };
    } finally {
      db.close();
    }
  },
  /**
   * Permanently remove one local project and its private catalog entries.
   * Binary keys are content-addressed and may be shared with other projects:
   * reclaim only blobs that have no remaining catalog or legacy references.
   * All removals happen in one IndexedDB transaction.
   */
  async remove(id) {
    if (!id.trim()) return false;
    const db = await database();
    try {
      const tx = db.transaction(["projects", "catalog", "binaries", "assets"], "readwrite");
      const projects = tx.objectStore("projects");
      const catalog = tx.objectStore("catalog");
      const binaries = tx.objectStore("binaries");
      const exists = await projects.get(id);
      if (!exists) {
        await tx.done;
        return false;
      }
      const owned = await catalog.getAll(
        IDBKeyRange.bound([id, ""], [id, "\uffff"]),
      );
      const reclaimCandidates = new Set(assetKeys(owned));
      await projects.delete(id);
      for (const asset of owned) {
        await catalog.delete([id, asset.id]);
      }

      // Phase-0 projects kept their assets in an unscoped legacy store.
      // Only remove legacy entries that belonged to the deleted document and
      // are not used by any surviving project, including its resize variants.
      const documents = (project: Project) => [
        project.document,
        ...(project.variants ?? []).map((variant) => variant.document),
      ];
      const imageIds = (project: Project) => documents(project).flatMap(
        (document) => (document?.layers ?? []).flatMap((layer) =>
          layer.type === "image" ? [layer.assetId] : [],
        ),
      );
      const remainingProjects = await projects.getAll();
      const referencedElsewhere = new Set(remainingProjects.flatMap(imageIds));
      const legacyStore = tx.objectStore("assets");
      for (const assetId of new Set(imageIds(exists))) {
        if (referencedElsewhere.has(assetId)) continue;
        const oldAsset = await legacyStore.get(assetId);
        if (!oldAsset) continue;
        for (const key of assetKeys([oldAsset])) reclaimCandidates.add(key);
        await legacyStore.delete(assetId);
      }
      const remaining = await catalog.getAll();
      const legacy = await legacyStore.getAll();
      const inUse = new Set(assetKeys([...remaining, ...legacy]));
      for (const key of reclaimCandidates) {
        if (!inUse.has(key)) await binaries.delete(key);
      }
      await tx.done;
      return true;
    } finally {
      db.close();
    }
  },
  async save(input, blobs = {}) {
    const bundle = bundleSchema.parse(input);
    const saved = {
      ...bundle,
      project: { ...bundle.project, updatedAt: new Date().toISOString() },
    };
    const db = await database();
    try {
      const keys = assetKeys(saved.assets);
      for (const key of keys) {
        if (!blobs[key] && !(await db.get("binaries", key)))
          throw new Error("missingAsset");
      }
      const tx = db.transaction(
        ["projects", "catalog", "binaries"],
        "readwrite",
      );
      await Promise.all([
        tx.objectStore("projects").put(saved.project),
        ...saved.assets.map((asset) =>
          tx
            .objectStore("catalog")
            .put({ ...asset, projectId: saved.project.id }),
        ),
        ...keys
          .filter((key) => blobs[key])
          .map((key) => tx.objectStore("binaries").put(blobs[key], key)),
      ]);
      await tx.done;
      return saved;
    } finally {
      db.close();
    }
  },
};
