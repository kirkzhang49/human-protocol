import {
  BUILDER_RUNTIME_PACK_ENGINE_VERSION,
  type BuilderRuntimePackBakeMode,
  type BuilderRuntimePackPointer,
  type BuilderRuntimePackRecord,
} from "./BuilderRuntimePackTypes";
import {
  hasLegacyTextureLayers,
  resolveBuilderRuntimePackRequest,
  type BuilderRuntimePackRequest,
} from "./BuilderRuntimePackRequest";

export { hasLegacyTextureLayers } from "./BuilderRuntimePackRequest";

/**
 * Persistent storage for builder playtest packs.
 *
 * - Pack records (including the geometry ArrayBuffer) live in IndexedDB.
 * - localStorage only holds lightweight pointers (latest pack per project,
 *   recent pack ids) so the builder UI can answer "is there a current pack?"
 *   synchronously without touching IndexedDB.
 * - A memory backend implements the same interface for SSR/QA environments
 *   without IndexedDB.
 */

const DB_NAME = "hp-builder-runtime-packs";
const DB_VERSION = 1;
const STORE_NAME = "packs";
const LATEST_POINTERS_KEY = "human-protocol-builder-runtime-pack-latest-v1";
const RECENT_PACKS_KEY = "human-protocol-builder-runtime-pack-recent-v1";
const MAX_PACKS_PER_PROJECT_PER_MODE = 1;
const MAX_RECENT_IDS = 8;

export interface BuilderRuntimePackBackend {
  put(record: BuilderRuntimePackRecord): Promise<void>;
  get(packId: string): Promise<BuilderRuntimePackRecord | null>;
  listForLevel(levelId: string): Promise<BuilderRuntimePackRecord[]>;
  listForProject(projectId: string): Promise<BuilderRuntimePackRecord[]>;
  delete(packId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// IndexedDB backend
// ---------------------------------------------------------------------------

function indexedDbAvailable() {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "packId" });
        store.createIndex("levelId", "levelId", { unique: false });
        store.createIndex("projectId", "projectId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
  });
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function createIndexedDbBackend(): BuilderRuntimePackBackend {
  const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
    const db = await openDatabase();
    try {
      return await run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    } finally {
      db.close();
    }
  };
  return {
    put: (record) => withStore("readwrite", async (store) => void (await requestAsPromise(store.put(record)))),
    get: (packId) => withStore("readonly", async (store) => ((await requestAsPromise(store.get(packId))) as BuilderRuntimePackRecord | undefined) ?? null),
    listForLevel: (levelId) =>
      withStore("readonly", async (store) => {
        const records = (await requestAsPromise(store.index("levelId").getAll(levelId))) as BuilderRuntimePackRecord[];
        return records.sort((a, b) => b.updatedAt - a.updatedAt);
      }),
    listForProject: (projectId) =>
      withStore("readonly", async (store) => {
        const records = (await requestAsPromise(store.index("projectId").getAll(projectId))) as BuilderRuntimePackRecord[];
        return records.sort((a, b) => b.updatedAt - a.updatedAt);
      }),
    delete: (packId) => withStore("readwrite", async (store) => void (await requestAsPromise(store.delete(packId)))),
  };
}

// ---------------------------------------------------------------------------
// Memory backend (SSR + QA)
// ---------------------------------------------------------------------------

export function createMemoryRuntimePackBackend(): BuilderRuntimePackBackend {
  const records = new Map<string, BuilderRuntimePackRecord>();
  return {
    put: async (record) => void records.set(record.packId, record),
    get: async (packId) => records.get(packId) ?? null,
    listForLevel: async (levelId) =>
      [...records.values()].filter((record) => record.levelId === levelId).sort((a, b) => b.updatedAt - a.updatedAt),
    listForProject: async (projectId) =>
      [...records.values()].filter((record) => record.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt),
    delete: async (packId) => void records.delete(packId),
  };
}

let defaultBackend: BuilderRuntimePackBackend | null = null;

export function builderRuntimePackBackend(): BuilderRuntimePackBackend | null {
  if (defaultBackend) return defaultBackend;
  if (!indexedDbAvailable()) return null;
  defaultBackend = createIndexedDbBackend();
  return defaultBackend;
}

// ---------------------------------------------------------------------------
// High-level store API
// ---------------------------------------------------------------------------

export async function saveBuilderRuntimePack(
  record: BuilderRuntimePackRecord,
  backend: BuilderRuntimePackBackend | null = builderRuntimePackBackend(),
): Promise<void> {
  if (!backend) throw new Error("本地存储不可用（IndexedDB 被禁用）。");
  await backend.put(record);
  setLatestBuilderPackPointer(record);
  rememberRecentPackId(record.packId);
  // Bound storage: keep only the newest pack per bake mode for this project.
  try {
    const byMode = new Map<string, number>();
    for (const candidate of await backend.listForProject(record.projectId)) {
      const mode = candidate.manifest.bakeMode ?? "proxy";
      const kept = byMode.get(mode) ?? 0;
      if (kept < MAX_PACKS_PER_PROJECT_PER_MODE || candidate.packId === record.packId) {
        byMode.set(mode, kept + 1);
        continue;
      }
      await backend.delete(candidate.packId);
    }
  } catch {
    // Pruning is best-effort; never fail a save because cleanup failed.
  }
}

export async function loadBuilderRuntimePack(
  packId: string,
  backend: BuilderRuntimePackBackend | null = builderRuntimePackBackend(),
): Promise<BuilderRuntimePackRecord | null> {
  if (!backend) return null;
  return backend.get(packId);
}

export async function loadLatestBuilderRuntimePackForLevel(
  levelId: string,
  backend: BuilderRuntimePackBackend | null = builderRuntimePackBackend(),
  bakeMode?: BuilderRuntimePackBakeMode,
): Promise<BuilderRuntimePackRecord | null> {
  const result = await resolveBuilderRuntimePackRequest({ levelId, bakeMode }, backend);
  return result.record;
}

export async function hasBuilderRuntimePackForLevel(
  levelId: string,
  request: Partial<BuilderRuntimePackRequest> = {},
  backend: BuilderRuntimePackBackend | null = builderRuntimePackBackend(),
): Promise<boolean> {
  return (await resolveBuilderRuntimePackRequest({ ...request, levelId }, backend)).record !== null;
}

// ---------------------------------------------------------------------------
// localStorage pointers (lightweight only — never binary data)
// ---------------------------------------------------------------------------

function readPointerMap(): Record<string, BuilderRuntimePackPointer> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LATEST_POINTERS_KEY) ?? "{}") as Record<string, BuilderRuntimePackPointer>;
  } catch {
    return {};
  }
}

function pointerKey(projectId: string, bakeMode: BuilderRuntimePackBakeMode) {
  return bakeMode === "cooked-glb" ? `${projectId}::deep` : projectId;
}

export function latestBuilderPackPointer(
  projectId: string,
  bakeMode: BuilderRuntimePackBakeMode = "proxy",
): BuilderRuntimePackPointer | null {
  const pointer = readPointerMap()[pointerKey(projectId, bakeMode)] ?? null;
  if (!pointer || pointer.engineVersion !== BUILDER_RUNTIME_PACK_ENGINE_VERSION) return null;
  return pointer;
}

export function setLatestBuilderPackPointer(record: BuilderRuntimePackRecord) {
  if (typeof window === "undefined") return;
  const pointers = readPointerMap();
  pointers[pointerKey(record.projectId, record.manifest.bakeMode ?? "proxy")] = {
    packId: record.packId,
    projectId: record.projectId,
    projectHash: record.projectHash,
    builderSnapshotId: record.builderSnapshotId,
    configHash: record.configHash,
    runtimeResourceHash: record.runtimeResourceHash,
    engineVersion: record.engineVersion,
    levelId: record.levelId,
    updatedAt: record.updatedAt,
    sizeBytes: record.sizeBytes,
  };
  try {
    window.localStorage.setItem(LATEST_POINTERS_KEY, JSON.stringify(pointers));
  } catch {
    // Pointer write is a convenience cache; IndexedDB remains the source of truth.
  }
}

function clearLatestBuilderPackPointers(projectId: string, bakeMode?: BuilderRuntimePackBakeMode) {
  if (typeof window === "undefined") return false;
  const pointers = readPointerMap();
  let removed = false;
  for (const key of Object.keys(pointers)) {
    const pointer = pointers[key];
    if (pointer?.projectId !== projectId) continue;
    if (bakeMode && key !== pointerKey(projectId, bakeMode)) continue;
    delete pointers[key];
    removed = true;
  }
  if (!removed) return false;
  try {
    window.localStorage.setItem(LATEST_POINTERS_KEY, JSON.stringify(pointers));
  } catch {
    return false;
  }
  return true;
}

function clearLatestBuilderPackPointersForLevel(levelId: string, bakeMode?: BuilderRuntimePackBakeMode) {
  if (typeof window === "undefined") return false;
  const pointers = readPointerMap();
  let removed = false;
  for (const key of Object.keys(pointers)) {
    const pointer = pointers[key];
    if (pointer?.levelId !== levelId) continue;
    if (bakeMode) {
      const pointerMode = key.endsWith("::deep") ? "cooked-glb" : "proxy";
      if (pointerMode !== bakeMode) continue;
    }
    delete pointers[key];
    removed = true;
  }
  if (!removed) return false;
  try {
    window.localStorage.setItem(LATEST_POINTERS_KEY, JSON.stringify(pointers));
  } catch {
    return false;
  }
  return true;
}

function rememberRecentPackId(packId: string) {
  if (typeof window === "undefined") return;
  try {
    const recent = JSON.parse(window.localStorage.getItem(RECENT_PACKS_KEY) ?? "[]") as string[];
    const next = [packId, ...recent.filter((id) => id !== packId)].slice(0, MAX_RECENT_IDS);
    window.localStorage.setItem(RECENT_PACKS_KEY, JSON.stringify(next));
  } catch {
    // Best-effort.
  }
}

function forgetRecentPackIds(packIds: readonly string[]) {
  if (typeof window === "undefined" || packIds.length === 0) return false;
  try {
    const remove = new Set(packIds);
    const recent = JSON.parse(window.localStorage.getItem(RECENT_PACKS_KEY) ?? "[]") as string[];
    const next = recent.filter((id) => !remove.has(id));
    window.localStorage.setItem(RECENT_PACKS_KEY, JSON.stringify(next));
    return next.length !== recent.length;
  } catch {
    return false;
  }
}

export async function clearBuilderRuntimePacksForProject(
  projectId: string,
  bakeMode?: BuilderRuntimePackBakeMode,
  backend: BuilderRuntimePackBackend | null = builderRuntimePackBackend(),
): Promise<{
  deletedRecords: number;
  removedPointers: boolean;
  removedRecentIds: boolean;
}> {
  const deletedPackIds: string[] = [];
  if (backend) {
    for (const record of await backend.listForProject(projectId)) {
      const recordMode = record.manifest.bakeMode ?? "proxy";
      if (bakeMode && recordMode !== bakeMode) continue;
      await backend.delete(record.packId);
      deletedPackIds.push(record.packId);
    }
  }

  return {
    deletedRecords: deletedPackIds.length,
    removedPointers: clearLatestBuilderPackPointers(projectId, bakeMode),
    removedRecentIds: forgetRecentPackIds(deletedPackIds),
  };
}

export async function clearBuilderRuntimePacksForLevel(
  levelId: string,
  bakeMode?: BuilderRuntimePackBakeMode,
  backend: BuilderRuntimePackBackend | null = builderRuntimePackBackend(),
): Promise<{
  deletedRecords: number;
  removedPointers: boolean;
  removedRecentIds: boolean;
}> {
  const deletedPackIds: string[] = [];
  if (backend) {
    for (const record of await backend.listForLevel(levelId)) {
      const recordMode = record.manifest.bakeMode ?? "proxy";
      if (bakeMode && recordMode !== bakeMode) continue;
      await backend.delete(record.packId);
      deletedPackIds.push(record.packId);
    }
  }

  return {
    deletedRecords: deletedPackIds.length,
    removedPointers: clearLatestBuilderPackPointersForLevel(levelId, bakeMode),
    removedRecentIds: forgetRecentPackIds(deletedPackIds),
  };
}

export async function clearBuilderRuntimePackCache(): Promise<{
  removedPointers: boolean;
  deletedDatabase: boolean;
  blocked: boolean;
}> {
  let removedPointers = false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LATEST_POINTERS_KEY);
      window.localStorage.removeItem(RECENT_PACKS_KEY);
      removedPointers = true;
    } catch {
      removedPointers = false;
    }
  }

  defaultBackend = null;
  if (!indexedDbAvailable()) {
    return { removedPointers, deletedDatabase: false, blocked: false };
  }

  const deleted = await new Promise<{ deletedDatabase: boolean; blocked: boolean }>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    let settled = false;
    const finish = (result: { deletedDatabase: boolean; blocked: boolean }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    request.onsuccess = () => finish({ deletedDatabase: true, blocked: false });
    request.onerror = () => finish({ deletedDatabase: false, blocked: false });
    request.onblocked = () => finish({ deletedDatabase: false, blocked: true });
  });

  return { removedPointers, ...deleted };
}

// ---------------------------------------------------------------------------
// Persistent storage request
// ---------------------------------------------------------------------------

export interface BuilderStoragePersistence {
  supported: boolean;
  persisted: boolean;
}

/** Asks the browser to protect local packs from eviction. Never throws. */
export async function requestPersistentBuilderStorage(): Promise<BuilderStoragePersistence> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return { supported: false, persisted: false };
    }
    const already = (await navigator.storage.persisted?.()) ?? false;
    if (already) return { supported: true, persisted: true };
    const granted = await navigator.storage.persist();
    return { supported: true, persisted: granted };
  } catch {
    return { supported: true, persisted: false };
  }
}
