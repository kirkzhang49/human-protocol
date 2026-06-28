import { useSyncExternalStore } from "react";
import type { BuilderPropEntry } from "./BuilderAssetCatalog";

/**
 * Catalog asset quarantine (hidden asset dock).
 *
 * Two delete concepts exist in /build:
 *   1. deleting a placed instance (project-level, handled by BuildPage), and
 *   2. quarantining a catalog asset (this module): the asset disappears from
 *      the browser immediately, is queued for a later *human-decided* real
 *      deletion, and can be restored at any time.
 *
 * Safety contract: this module NEVER touches GLBs or source files. Hidden
 * state lives in localStorage; in dev the vite middleware additionally writes
 * a review record under docs/pending-delete/builder-assets/ so the cleanup
 * is reviewable in git. Placed instances of quarantined assets keep working.
 */

export interface BuilderQuarantineRecord {
  modelKey: string;
  label: string;
  group: string;
  source?: string;
  sourceAssetId?: string;
  sizeMeters: readonly [number, number, number];
  queuedAt: string;
  reason: string;
  /** Where a human should look when actually deleting the asset later. */
  candidateSourcePaths: string[];
}

const storageKey = "human-protocol-builder-quarantine-v1";
export const quarantineEndpoint = "/__hp_builder/quarantine_asset";

let cache: BuilderQuarantineRecord[] | null = null;
const listeners = new Set<() => void>();

function readStore(): BuilderQuarantineRecord[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as BuilderQuarantineRecord[]) : [];
    cache = Array.isArray(parsed) ? parsed.filter((record) => typeof record?.modelKey === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function writeStore(records: BuilderQuarantineRecord[]) {
  cache = records;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  } catch {
    // quota/private mode: in-memory state still works for this session
  }
  for (const listener of listeners) listener();
}

export function listQuarantinedAssets(): readonly BuilderQuarantineRecord[] {
  return readStore();
}

export function isQuarantined(modelKey: string): boolean {
  return readStore().some((record) => record.modelKey === modelKey);
}

export function quarantinedModelKeys(): ReadonlySet<string> {
  return new Set(readStore().map((record) => record.modelKey));
}

/** Likely on-disk homes of an asset, recorded for the eventual manual cleanup. */
function candidateSourcePaths(entry: BuilderPropEntry): string[] {
  return [
    `src/assets/models-cooked/environment/**/hp_${entry.modelKey}.glb`,
    `src/assets/manifests/builder/*.json (asset "${entry.modelKey}")`,
    "src/build/generatedBuilderAssetCatalog.ts / generatedBuilderAssetFootprints.ts (regenerate via --emit)",
    `src/assets/thumbnails/builder/**/${entry.modelKey}.webp`,
  ];
}

/** Hide a catalog asset and queue it for review. Returns the stored record. */
export function quarantineAsset(entry: BuilderPropEntry, reason = "builder-dev-quarantine"): BuilderQuarantineRecord {
  const record: BuilderQuarantineRecord = {
    modelKey: entry.modelKey,
    label: entry.label,
    group: entry.group,
    source: entry.source,
    sourceAssetId: entry.sourceAssetId,
    sizeMeters: entry.sizeMeters,
    queuedAt: new Date().toISOString(),
    reason,
    candidateSourcePaths: candidateSourcePaths(entry),
  };
  writeStore([...readStore().filter((existing) => existing.modelKey !== entry.modelKey), record]);
  postQuarantineAction({ action: "queue", record });
  return record;
}

/** Bring an asset back into the catalog and drop its pending-delete record. */
export function restoreAsset(modelKey: string) {
  writeStore(readStore().filter((record) => record.modelKey !== modelKey));
  postQuarantineAction({ action: "restore", modelKey });
}

export function restoreAllAssets() {
  for (const record of readStore()) postQuarantineAction({ action: "restore", modelKey: record.modelKey });
  writeStore([]);
}

/** JSON snapshot of the tray (复制清单 action). */
export function quarantineListJson(): string {
  return JSON.stringify(readStore(), null, 2);
}

/**
 * Best-effort dev sync: writes/removes the review JSON under
 * docs/pending-delete/builder-assets/. Production (no middleware) falls back
 * to localStorage-only quarantine silently.
 */
function postQuarantineAction(payload: { action: "queue"; record: BuilderQuarantineRecord } | { action: "restore"; modelKey: string }) {
  if (typeof fetch === "undefined" || !import.meta.env.DEV) return;
  fetch(quarantineEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // endpoint unavailable (preview build, static host): local quarantine only
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const emptySnapshot: BuilderQuarantineRecord[] = [];

/** Reactive view of the quarantine tray for the asset browser. */
export function useQuarantinedAssets(): readonly BuilderQuarantineRecord[] {
  return useSyncExternalStore(subscribe, readStore, () => emptySnapshot);
}
