import { RAW_WEBGPU_ASSET_SOURCES } from "../../render/raw-webgpu/contracts/RawWebGpuContracts";
import {
  loadRawWebGpuLevelAssets,
  type RawWebGpuLoadedLevelAssets,
} from "../../render/raw-webgpu/RawWebGpuAssetLoader";
import { getBuiltInLevelConfig } from "../../game/config/ConfigPackStore";
import { builderProjectFromBuiltInLevel } from "../BuilderLevelImport";
import {
  builderDeepModelRequestsForAssetIndex,
  builderNativeRawRequestsForAssetIndex,
  builderRuntimeAssetIndexForProject,
  type BuilderNativeRawModelRequest,
} from "./BuilderRuntimeAssetIndex";
import {
  collectExternalBuilderRuntimeTextureBlobs,
  compileBuilderRuntimePack,
  type BuilderNativeRawModelLibrary,
} from "./compileBuilderRuntimePack";
import { cookGlbModelLibrary, type CookedGlbLibrary } from "./cookGlbModels";
import { deepCookEmitsNodeChunks } from "./deepCookPolicy";
import { loadBuilderNativeEnemyAnimationBridge, loadBuilderNativeRawModelLibrary } from "./nativeRawEnemyModels";
import { builderProjectHash } from "./builderProjectHash";
import {
  builderRuntimePackBackend,
  type BuilderRuntimePackBackend,
} from "./BuilderRuntimePackStore";
import { builderRuntimePackRequestForLevel, resolveBuilderRuntimePackRequest } from "./BuilderRuntimePackRequest";
import type { BuilderRuntimePackRecord } from "./BuilderRuntimePackTypes";

/**
 * Bridges builder runtime packs into the Raw WebGPU loading chain:
 *
 *   1. official-builder runtime packs (builder-authored official levels)
 *   2. IndexedDB builder runtime pack (generated /build levels)
 *   3. static cooked raw assets (Level 3 and legacy cooked levels)
 *   4. caller's existing error path (→ Three.js fallback)
 */
export async function loadRawWebGpuLevelAssetsOrRuntimePack(
  levelId: string,
  options: { backend?: BuilderRuntimePackBackend | null } = {},
): Promise<RawWebGpuLoadedLevelAssets> {
  const runtimePackRequest = builderRuntimePackRequestForLevel(levelId);
  if (isExplicitBuilderRuntimePackRequest(runtimePackRequest)) {
    const pack = await loadBuilderRuntimePackAssets(levelId, {
      backend: options.backend,
      request: runtimePackRequest,
    });
    if (pack) return pack;
  }

  if (usesOfficialBuilderRuntimePack(levelId)) {
    const runtimePack = await loadOfficialBuilderRuntimePackAssets(levelId);
    if (runtimePack) return runtimePack;
    throw new Error(`Could not compile official builder runtime pack for level "${levelId}".`);
  }

  let staticError: unknown = null;
  try {
    return await loadRawWebGpuLevelAssets(levelId);
  } catch (error) {
    staticError = error;
  }
  const pack = await loadBuilderRuntimePackAssets(levelId, {
    backend: options.backend,
    request: runtimePackRequest,
  });
  if (pack) return pack;
  throw staticError instanceof Error ? staticError : new Error(`No raw assets for level "${levelId}".`);
}

function isExplicitBuilderRuntimePackRequest(request: ReturnType<typeof builderRuntimePackRequestForLevel>) {
  return Boolean(request.packId || request.bakeMode || request.projectHash || request.configHash || request.runtimeResourceHash);
}

export function usesOfficialBuilderRuntimePack(levelId: string) {
  // Official play uses the same builder-runtime surface/furniture path as
  // /build so the canonical builder source cannot drift behind static plans.
  return (
    levelId === "level_01_maintenance_bay" ||
    levelId === "level_02_residential_simulation" ||
    levelId === "level_03_human_museum" ||
    levelId === "level_04_memory_clinic"
  );
}

const officialBuilderRuntimePackCache = new Map<string, Promise<RawWebGpuLoadedLevelAssets | null>>();

export function loadOfficialBuilderRuntimePackAssets(levelId: string): Promise<RawWebGpuLoadedLevelAssets | null> {
  const cacheKey = officialBuilderRuntimePackCacheKey(levelId);
  let cached = officialBuilderRuntimePackCache.get(cacheKey);
  if (!cached) {
    cached = compileOfficialBuilderRuntimePackAssets(levelId).catch((error) => {
      officialBuilderRuntimePackCache.delete(cacheKey);
      throw error;
    });
    officialBuilderRuntimePackCache.set(cacheKey, cached);
  }
  return cached;
}

function officialBuilderRuntimePackCacheKey(levelId: string) {
  const project = builderProjectFromBuiltInLevel(levelId);
  return project ? `${levelId}:${builderProjectHash(project)}` : `${levelId}:missing`;
}

/**
 * Loads a generated builder runtime pack as raw level assets, or null.
 * `?pack=fast|deep` selects the bake mode explicitly (the builder's 快速试玩 /
 * 深度试玩 buttons); otherwise the newest pack wins, deep preferred.
 */
export async function loadBuilderRuntimePackAssets(
  levelId: string,
  options: {
    backend?: BuilderRuntimePackBackend | null;
    request?: ReturnType<typeof builderRuntimePackRequestForLevel>;
  } = {},
): Promise<RawWebGpuLoadedLevelAssets | null> {
  const readStart = typeof performance !== "undefined" ? performance.now() : 0;
  const resolved = await resolveBuilderRuntimePackRequest(options.request ?? builderRuntimePackRequestForLevel(levelId), options.backend ?? builderRuntimePackBackend());
  const record = resolved.record;
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perfLog")) {
    const ms = (typeof performance !== "undefined" ? performance.now() : 0) - readStart;
    const textureBytes = (record?.textureBlobs ?? []).reduce((sum, blob) => sum + blob.bytes.byteLength, 0);
    console.info(
      `[perfLog] pack IDB read: ${ms.toFixed(0)}ms | packId=${record?.packId ?? "none"} requested=${resolved.requested.packId ?? "latest"} ` +
        `status=${resolved.status} reason=${resolved.reason} bakeMode=${record?.manifest.bakeMode ?? "none"} ` +
        `geom=${((record?.geometryBuffer.byteLength ?? 0) / 1024).toFixed(0)}KB tex=${(textureBytes / 1024).toFixed(0)}KB ` +
        `cookedModels=${record?.manifest.cookedModels?.length ?? 0} instances=${record?.manifest.counts.instances ?? 0}`,
    );
  }
  if (!record || record.geometryBuffer.byteLength <= 0) return null;
  const robotAnimationBridge =
    record.manifest.enemyAnimationMode === "bridge" ? await loadBuilderNativeEnemyAnimationBridge() : null;
  return {
    plan: planWithTextureUrls(record),
    geometryBuffer: record.geometryBuffer,
    robotAnimationBridge,
    cookedGltfLoaderManifest: null,
    source:
      record.manifest.bakeMode === "cooked-glb"
        ? RAW_WEBGPU_ASSET_SOURCES.builderRuntimePackCookedGlb
        : RAW_WEBGPU_ASSET_SOURCES.builderRuntimePack,
  };
}

/**
 * Deep packs store texture bytes in IndexedDB with placeholder URLs in the
 * plan; rebuild object URLs at load time. One URL set per playtest load —
 * they live for the page session, which is acceptable.
 */
function planWithTextureUrls(record: BuilderRuntimePackRecord) {
  return planWithTextureBlobUrls(record.renderPlan, record.textureBlobs ?? []);
}

function planWithTextureBlobUrls(renderPlan: BuilderRuntimePackRecord["renderPlan"], blobs: NonNullable<BuilderRuntimePackRecord["textureBlobs"]>) {
  const geometry = renderPlan.geometry;
  if (blobs.length === 0 || !geometry?.baseColorTextures?.length || typeof URL === "undefined") {
    return renderPlan;
  }
  const urlByLayer = new Map(
    blobs.map((blob) => [texturePageLayerKey(blob.page, blob.layer), URL.createObjectURL(new Blob([blob.bytes], { type: blob.mimeType }))]),
  );
  return {
    ...renderPlan,
    geometry: {
      ...geometry,
      baseColorTextures: geometry.baseColorTextures.map((entry) => ({
        ...entry,
        url: urlByLayer.get(texturePageLayerKey(entry.page, entry.layer)) ?? entry.url,
      })),
    },
  };
}

function texturePageLayerKey(page: number | null | undefined, layer: number) {
  return `${Number.isFinite(page) ? Math.max(0, Math.floor(Number(page))) : 0}:${layer}`;
}

async function compileOfficialBuilderRuntimePackAssets(levelId: string): Promise<RawWebGpuLoadedLevelAssets | null> {
  const project = builderProjectFromBuiltInLevel(levelId);
  if (!project) return null;
  const level = getBuiltInLevelConfig(levelId);
  const assetIndex = builderRuntimeAssetIndexForProject(level, project);
  const nativeRawRequests = officialNativeRawRequestsForAssetIndex(assetIndex);
  let nativeRawModels: BuilderNativeRawModelLibrary | undefined;
  let cooked: CookedGlbLibrary | undefined;
  let loadedNativeKeys = new Set<string>();
  if (nativeRawRequests.length > 0) {
    nativeRawModels = (await loadBuilderNativeRawModelLibrary(nativeRawRequests)) ?? undefined;
    loadedNativeKeys = new Set(nativeRawModels?.models.keys() ?? []);
  }
  const staticFurnitureCookRequests = builderDeepModelRequestsForAssetIndex(assetIndex).requests
    .filter((request) => (request.kind === "furniture" || request.kind === "pickup") && !loadedNativeKeys.has(request.modelKey))
    .filter((request) => !officialProceduralModelKeys.has(request.modelKey))
    .map((request) => ({ modelKey: request.modelKey, url: request.url, emitNodeChunks: deepCookEmitsNodeChunks(request.kind, request.modelKey) }));
  if (staticFurnitureCookRequests.length > 0) {
    cooked = await cookGlbModelLibrary(staticFurnitureCookRequests);
  }
  const compiled = compileBuilderRuntimePack(level, project, {
    assetIndex,
    cooked,
    nativeRawModels,
    manifestBakeMode: "proxy",
  });
  const textureBlobs = (await collectExternalBuilderRuntimeTextureBlobs(compiled.renderPlan, compiled.textures)).textures;
  return {
    plan: planWithTextureBlobUrls(compiled.renderPlan, textureBlobs),
    geometryBuffer: compiled.geometryBuffer,
    robotAnimationBridge:
      compiled.manifest.enemyAnimationMode === "bridge" ? await loadBuilderNativeEnemyAnimationBridge() : null,
    cookedGltfLoaderManifest: null,
    source: RAW_WEBGPU_ASSET_SOURCES.builderRuntimePack,
  };
}

const officialProceduralModelKeys = new Set([
  "decal_human_body_reference",
  "decal_human_hand_reference",
  "decal_human_spine_reference",
  "decal_human_reference_triptych",
]);

function officialNativeRawRequestsForAssetIndex(
  assetIndex: ReturnType<typeof builderRuntimeAssetIndexForProject>,
): BuilderNativeRawModelRequest[] {
  // Level 1/2 official runtime should render the same prebuilt WebGPU/native
  // geometry as /build. Cooked GLBs are only an explicit fallback for modelKeys
  // that have not reached the Raw resource map yet.
  return builderNativeRawRequestsForAssetIndex(assetIndex);
}
