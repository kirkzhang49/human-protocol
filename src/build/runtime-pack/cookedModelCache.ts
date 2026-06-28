import { FLOATS_PER_VERTEX, VERTEX_MATERIAL_INDEX_COMPONENT } from "../../render/raw-webgpu/RawWebGpuConstants";
import type { CookedGlbModel } from "./cookGlbModels";

/**
 * Per-model cook cache, keyed by the model's GLB URL + cooked-vertex format.
 *
 * In production the GLB url is vite content-hashed, so the key changes when a
 * GLB's bytes change. DEV skips this cache entirely because source URLs are
 * stable while bytes change often. Records are still stamped with
 * COOK_FORMAT_VERSION so a vertex-layout change (e.g. 14→10 floats /
 * materialIndex column move) cannot replay stale, mis-strided geometry.
 *
 * Best-effort: every operation swallows errors and degrades to a cache miss, so
 * a disabled / full / evicted IndexedDB just means "cook it again", never a
 * broken playtest.
 */

const DB_NAME = "hp-builder-cooked-models";
// Bumped 1→2 to wipe the store for users carrying pre-format-change (14-float) records.
const DB_VERSION = 2;
const STORE = "models";

// Identifies the cooked vertex layout; stale-format records are treated as misses.
const COOK_FORMAT_VERSION = `f${FLOATS_PER_VERTEX}m${VERTEX_MATERIAL_INDEX_COMPONENT}`;

interface CachedCookedModelRecord {
  url: string;
  formatVersion: string;
  model: CookedGlbModel;
  storedAt: number;
}

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Recreate the store on any version bump — cached blobs carry no inherent
      // format, so a vertex-layout change would replay mis-strided geometry.
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE, { keyPath: "url" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("cooked-model cache open failed"));
  });
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("cooked-model cache request failed"));
  });
}

/** Reads cached cooked models for the given GLB URLs. Returns a url→model map of hits only. */
export async function readCachedCookedModels(urls: readonly string[]): Promise<Map<string, CookedGlbModel>> {
  const hits = new Map<string, CookedGlbModel>();
  if (!idbAvailable() || urls.length === 0) return hits;
  try {
    const db = await openCacheDb();
    try {
      const store = db.transaction(STORE, "readonly").objectStore(STORE);
      // Issue every get synchronously so the transaction stays alive across awaits.
      const gets = urls.map((url) => store.get(url));
      await Promise.all(
        gets.map(async (get, index) => {
          const record = (await requestAsPromise(get)) as CachedCookedModelRecord | undefined;
          if (record?.model && record.formatVersion === COOK_FORMAT_VERSION) hits.set(urls[index], record.model);
        }),
      );
    } finally {
      db.close();
    }
  } catch {
    // best-effort — a read failure just means everything re-cooks.
  }
  return hits;
}

/** Stores freshly cooked models keyed by GLB URL. Never throws. */
export async function writeCachedCookedModels(entries: readonly { url: string; model: CookedGlbModel }[]): Promise<void> {
  if (!idbAvailable() || entries.length === 0) return;
  try {
    const db = await openCacheDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const storedAt = typeof Date !== "undefined" ? Date.now() : 0;
      for (const entry of entries) {
        store.put({ url: entry.url, formatVersion: COOK_FORMAT_VERSION, model: entry.model, storedAt } satisfies CachedCookedModelRecord);
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("cooked-model cache write failed"));
        tx.onabort = () => reject(tx.error ?? new Error("cooked-model cache write aborted"));
      });
    } finally {
      db.close();
    }
  } catch {
    // best-effort — a write failure just means a future cook can't reuse it.
  }
}
