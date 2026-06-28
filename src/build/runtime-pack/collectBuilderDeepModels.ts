import type { LevelDefinition } from "../../game/config/schema/levelConfig";
import {
  builderDeepModelRequestsForAssetIndex,
  builderDeepModelRequestsForLevel,
  type BuilderDeepModelCollection,
  type BuilderDeepModelRequest,
  type BuilderRuntimeAssetIndexEntry,
} from "./BuilderRuntimeAssetIndex";

/**
 * Collects every GLB the deep bake should cook for a generated level:
 * furniture from the map props, pickup models the runtime can drop, enemy
 * models for the archetypes the waves spawn, and the official weapon/hand
 * viewmodels so builder playtests can keep the same first-person silhouette
 * as campaign levels while the native Raw pass evolves.
 */

export type { BuilderDeepModelCollection, BuilderDeepModelRequest };

export function collectBuilderDeepModels(level: LevelDefinition, assetIndex?: readonly BuilderRuntimeAssetIndexEntry[]): BuilderDeepModelCollection {
  if (assetIndex) return builderDeepModelRequestsForAssetIndex(assetIndex);
  return builderDeepModelRequestsForLevel(level);
}

/** Stable version hash over resolved asset URLs (vite content-hashes them). */
export function builderDeepAssetVersionHash(requests: readonly BuilderDeepModelRequest[]): string {
  const canonical = requests
    .map((request) => `${request.modelKey}=${request.url}`)
    .sort()
    .join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
