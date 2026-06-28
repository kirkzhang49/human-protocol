import type { RawRobotAnimationBridge } from "../../render/raw-webgpu/RawRobotAnimationBridge";
import { FLOATS_PER_VERTEX, VERTEX_MATERIAL_INDEX_COMPONENT } from "../../render/raw-webgpu/RawWebGpuConstants";
import {
  loadRawWebGpuGeometryBuffer,
  loadRawWebGpuRenderPlan,
  loadRawWebGpuRobotAnimationBridge,
} from "../../render/raw-webgpu/RawWebGpuAssetLoader";
import type {
  RawPlanBaseColorTexture,
  RawPlanGeometryAsset,
  RawPlanMaterial,
  RawPlanMaterialTexture,
  RawPlanMaterialTextureSlot,
  RawRenderPlan,
  Tuple3,
  Tuple4,
} from "../../render/raw-webgpu/RawWebGpuTypes";
import {
  BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS,
  type BuilderNativeRawModelRequest,
} from "./BuilderRuntimeAssetIndex";
import { loadRawWebGpuAssetBundleModelLibrary } from "./RawWebGpuAssetBundleIndex";
import type { BuilderNativeRawModel, BuilderNativeRawModelLibrary } from "./compileBuilderRuntimePack";

const NATIVE_ENEMY_BRIDGE_SOURCE_LEVEL_ID = "level_01_maintenance_bay";
const NATIVE_RAW_LIBRARY_ID = "official-raw-builder-index-v1";

interface NativeRawPlanSource {
  levelId: string;
  plan: RawRenderPlan;
  assetsByKey: Map<string, RawPlanGeometryAsset>;
  materialsByIndex: Map<number, RawPlanMaterial>;
  baseColorTexturesByLayer: Map<number, RawPlanBaseColorTexture>;
  materialTexturesByLayer: Map<number, RawPlanMaterialTexture>;
}

let cachedNativeRawPlanSources: Promise<NativeRawPlanSource[]> | null = null;
const cachedNativeRawGeometryBuffers = new Map<string, Promise<ArrayBuffer>>();
let cachedNativeEnemyBridge: Promise<RawRobotAnimationBridge | null> | null = null;

export async function loadBuilderNativeRawModelLibrary(
  requests: readonly BuilderNativeRawModelRequest[],
): Promise<BuilderNativeRawModelLibrary | null> {
  const requested = uniqueRequests(requests);
  if (requested.length === 0) return null;

  const bundleLibrary = await loadRawWebGpuAssetBundleModelLibrary(requested);
  const bundleKeys = new Set(bundleLibrary?.models.keys() ?? []);
  const legacyRequests = requested.filter((request) => !bundleKeys.has(request.modelKey));
  const legacyLibrary = legacyRequests.length > 0 ? await loadLegacyNativeRawModelLibrary(legacyRequests) : null;
  return mergeNativeRawModelLibraries([bundleLibrary, legacyLibrary]);
}

async function loadLegacyNativeRawModelLibrary(
  requested: readonly BuilderNativeRawModelRequest[],
): Promise<BuilderNativeRawModelLibrary | null> {
  const sources = await loadNativeRawPlanSources();
  const matches: Array<{ request: BuilderNativeRawModelRequest; source: NativeRawPlanSource; asset: RawPlanGeometryAsset }> = [];
  for (const request of requested) {
    const match = sources
      .map((source) => ({ source, asset: source.assetsByKey.get(request.modelKey) }))
      .find(({ asset }) => asset?.status === "ready" && (asset.vertexCount ?? 0) > 0);
    if (match?.asset) matches.push({ request, source: match.source, asset: match.asset });
  }
  if (matches.length === 0) return null;

  const buffersByLevel = new Map<string, Float32Array>();
  await Promise.all(
    [...new Set(matches.map((match) => match.source.levelId))].map(async (levelId) => {
      buffersByLevel.set(levelId, new Float32Array(await loadNativeRawGeometryBuffer(levelId)));
    }),
  );

  const models: BuilderNativeRawModelLibrary["models"] = new Map();
  const materials: RawPlanMaterial[] = [];
  const baseColorTextures: RawPlanBaseColorTexture[] = [];
  const materialTextures: RawPlanMaterialTexture[] = [];
  const materialIndexBySource = new Map<string, number>();
  const baseColorLayerBySource = new Map<string, number>();
  const materialLayerBySource = new Map<string, number>();
  let nextMaterialIndex = 2;
  let nextBaseColorLayer = 1;
  let nextMaterialLayer = 1;

  const ensureTextureLayer = (
    source: NativeRawPlanSource,
    texture: RawPlanBaseColorTexture | RawPlanMaterialTexture,
    target: "baseColor" | "material",
  ) => {
    const layerBySource = target === "baseColor" ? baseColorLayerBySource : materialLayerBySource;
    const key = `${source.levelId}:${texture.layer}`;
    const existing = layerBySource.get(key);
    if (existing !== undefined) return existing;
    const layer = target === "baseColor" ? nextBaseColorLayer++ : nextMaterialLayer++;
    layerBySource.set(key, layer);
    const copied = {
      ...texture,
      layer,
      name: `${source.levelId}:${texture.name ?? `layer_${texture.layer}`}`,
    };
    if (target === "baseColor") baseColorTextures.push(copied as RawPlanBaseColorTexture);
    else materialTextures.push(copied as RawPlanMaterialTexture);
    return layer;
  };

  const remapTextureSlot = (source: NativeRawPlanSource, slot: RawPlanMaterialTextureSlot): RawPlanMaterialTextureSlot => {
    const sourceLayer = typeof slot.layer === "number" && Number.isFinite(slot.layer) ? slot.layer : null;
    if (!sourceLayer || sourceLayer <= 0) return { ...slot };
    const baseColor = slot.semantic === "baseColor";
    const texture = baseColor
      ? source.baseColorTexturesByLayer.get(sourceLayer)
      : source.materialTexturesByLayer.get(sourceLayer);
    if (!texture) return { ...slot, present: false, layer: null };
    return {
      ...slot,
      layer: ensureTextureLayer(source, texture, baseColor ? "baseColor" : "material"),
      url: texture.url,
      sourceFile: texture.sourceFile,
      mimeType: texture.mimeType,
      stats: texture.stats ?? slot.stats ?? null,
    };
  };

  const ensureMaterial = (source: NativeRawPlanSource, sourceIndex: number) => {
    const key = `${source.levelId}:${sourceIndex}`;
    const existing = materialIndexBySource.get(key);
    if (existing !== undefined) return existing;
    const sourceMaterial = source.materialsByIndex.get(sourceIndex);
    if (!sourceMaterial) return 0;
    const index = nextMaterialIndex++;
    materialIndexBySource.set(key, index);
    materials.push({
      ...sourceMaterial,
      index,
      id: `builder:native-raw:${source.levelId}:${index}:${sourceMaterial.id}`,
      category: sourceMaterial.category || "native-raw",
      semanticParams: cloneTuple4(sourceMaterial.semanticParams),
      paletteColorFactor: cloneTuple4(sourceMaterial.paletteColorFactor),
      baseColorFactor: [...sourceMaterial.baseColorFactor] as Tuple4,
      emissiveFactor: [...sourceMaterial.emissiveFactor] as Tuple3,
      transparency: sourceMaterial.transparency ? { ...sourceMaterial.transparency } : sourceMaterial.transparency,
      textures: sourceMaterial.textures?.map((slot) => remapTextureSlot(source, slot)),
    });
    return index;
  };

  for (const { request, source, asset } of matches) {
    const sourceFloats = buffersByLevel.get(source.levelId);
    if (!sourceFloats) continue;
    const start = asset.vertexOffset * FLOATS_PER_VERTEX;
    const end = start + asset.vertexCount * FLOATS_PER_VERTEX;
    if (start < 0 || end > sourceFloats.length) continue;
    const vertices = sourceFloats.slice(start, end);
    for (let offset = VERTEX_MATERIAL_INDEX_COMPONENT; offset < vertices.length; offset += FLOATS_PER_VERTEX) {
      vertices[offset] = ensureMaterial(source, Math.max(0, Math.round(vertices[offset])));
    }
    models.set(request.modelKey, {
      modelKey: request.modelKey,
      kind: request.kind,
      sourceLevelId: source.levelId,
      asset,
      vertices,
    });
  }

  if (models.size === 0) return null;
  return {
    libraryId: NATIVE_RAW_LIBRARY_ID,
    sourceLevelIds: [...new Set([...models.values()].map((model) => model.sourceLevelId))],
    models,
    materials,
    baseColorTextures,
    materialTextures,
    baseColorTextureSize: matches[0]?.source.plan.geometry?.baseColorTextureSize,
    materialTextureSize: matches[0]?.source.plan.geometry?.materialTextureSize,
  };
}

function mergeNativeRawModelLibraries(
  libraries: readonly (BuilderNativeRawModelLibrary | null | undefined)[],
): BuilderNativeRawModelLibrary | null {
  const available = libraries.filter((library): library is BuilderNativeRawModelLibrary => Boolean(library?.models.size));
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  const models: BuilderNativeRawModelLibrary["models"] = new Map();
  const materials: RawPlanMaterial[] = [];
  const baseColorTextures: RawPlanBaseColorTexture[] = [];
  const materialTextures: RawPlanMaterialTexture[] = [];
  const sourceLevelIds = new Set<string>();
  let nextMaterialIndex = 2;
  let nextBaseColorLayer = 1;
  let nextMaterialLayer = 1;
  let baseColorTextureSize: number | undefined;
  let materialTextureSize: number | undefined;

  for (const library of available) {
    baseColorTextureSize ??= library.baseColorTextureSize;
    materialTextureSize ??= library.materialTextureSize;
    for (const sourceLevelId of library.sourceLevelIds) sourceLevelIds.add(sourceLevelId);

    const materialIndexMap = new Map<number, number>();
    const baseColorTexturesByLayer = new Map((library.baseColorTextures ?? []).map((texture) => [texture.layer, texture]));
    const materialTexturesByLayer = new Map((library.materialTextures ?? []).map((texture) => [texture.layer, texture]));
    const baseLayerMap = new Map<number, number>();
    const materialLayerMap = new Map<number, number>();
    const ensureTextureLayer = (
      texture: RawPlanBaseColorTexture | RawPlanMaterialTexture,
      target: "baseColor" | "material",
    ) => {
      const layerMap = target === "baseColor" ? baseLayerMap : materialLayerMap;
      const existing = layerMap.get(texture.layer);
      if (existing !== undefined) return existing;
      const layer = target === "baseColor" ? nextBaseColorLayer++ : nextMaterialLayer++;
      layerMap.set(texture.layer, layer);
      const copied = { ...texture, layer };
      if (target === "baseColor") baseColorTextures.push(copied as RawPlanBaseColorTexture);
      else materialTextures.push(copied as RawPlanMaterialTexture);
      return layer;
    };
    const remapLibraryTextureSlot = (slot: RawPlanMaterialTextureSlot): RawPlanMaterialTextureSlot => {
      if (!slot.present || typeof slot.layer !== "number" || slot.layer <= 0) return { ...slot };
      const baseColor = slot.semantic === "baseColor";
      const texture = baseColor ? baseColorTexturesByLayer.get(slot.layer) : materialTexturesByLayer.get(slot.layer);
      if (!texture) return { ...slot, present: false, layer: null };
      return {
        ...slot,
        layer: ensureTextureLayer(texture, baseColor ? "baseColor" : "material"),
        url: texture.url,
        sourceFile: texture.sourceFile,
        mimeType: texture.mimeType,
        stats: texture.stats ?? slot.stats ?? null,
      };
    };
    for (const material of library.materials) {
      const index = nextMaterialIndex++;
      materialIndexMap.set(material.index, index);
      materials.push({
        ...material,
        index,
        id: `merged-native-raw:${library.libraryId}:${index}:${material.id}`,
        semanticParams: cloneTuple4(material.semanticParams),
        paletteColorFactor: cloneTuple4(material.paletteColorFactor),
        baseColorFactor: [...material.baseColorFactor] as Tuple4,
        emissiveFactor: [...material.emissiveFactor] as Tuple3,
        transparency: material.transparency ? { ...material.transparency } : material.transparency,
        textures: material.textures?.map((slot) => remapLibraryTextureSlot(slot)),
      });
    }
    for (const model of library.models.values()) {
      const vertices = model.vertices.slice();
      for (let offset = VERTEX_MATERIAL_INDEX_COMPONENT; offset < vertices.length; offset += FLOATS_PER_VERTEX) {
        const sourceIndex = Math.max(0, Math.round(vertices[offset] ?? 0));
        vertices[offset] = materialIndexMap.get(sourceIndex) ?? 0;
      }
      models.set(model.modelKey, {
        ...model,
        asset: cloneGeometryAsset(model.asset),
        vertices,
      });
    }
  }

  return {
    libraryId: "raw-webgpu-native-merged-v1",
    sourceLevelIds: [...sourceLevelIds],
    models,
    materials,
    baseColorTextures,
    materialTextures,
    baseColorTextureSize,
    materialTextureSize,
  };
}

export function loadBuilderNativeEnemyModelLibrary(modelKeys: readonly string[]): Promise<BuilderNativeRawModelLibrary | null> {
  return loadBuilderNativeRawModelLibrary(modelKeys.map((modelKey) => ({ modelKey, kind: "enemy" })));
}

export function loadBuilderNativeEnemyAnimationBridge(): Promise<RawRobotAnimationBridge | null> {
  cachedNativeEnemyBridge ??= loadRawWebGpuRobotAnimationBridge(NATIVE_ENEMY_BRIDGE_SOURCE_LEVEL_ID);
  return cachedNativeEnemyBridge;
}

function uniqueRequests(requests: readonly BuilderNativeRawModelRequest[]) {
  const byKey = new Map<string, BuilderNativeRawModelRequest>();
  for (const request of requests) {
    if (!request.modelKey || byKey.has(request.modelKey)) continue;
    byKey.set(request.modelKey, request);
  }
  return [...byKey.values()].sort((left, right) => left.modelKey.localeCompare(right.modelKey));
}

function loadNativeRawPlanSources(): Promise<NativeRawPlanSource[]> {
  cachedNativeRawPlanSources ??= Promise.all(
    BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS.map(async (levelId): Promise<NativeRawPlanSource | null> => {
      try {
        const plan = await loadRawWebGpuRenderPlan(levelId);
        const geometry = plan.geometry;
        if (!geometry) return null;
        return {
          levelId,
          plan,
          assetsByKey: new Map((geometry.assets ?? []).map((asset) => [asset.modelKey, asset])),
          materialsByIndex: new Map((geometry.materials ?? []).map((material) => [material.index, material])),
          baseColorTexturesByLayer: new Map((geometry.baseColorTextures ?? []).map((texture) => [texture.layer, texture])),
          materialTexturesByLayer: new Map((geometry.materialTextures ?? []).map((texture) => [texture.layer, texture])),
        };
      } catch {
        return null;
      }
    }),
  ).then((entries): NativeRawPlanSource[] => entries.filter((entry): entry is NativeRawPlanSource => entry !== null));
  return cachedNativeRawPlanSources;
}

function loadNativeRawGeometryBuffer(levelId: string) {
  let cached = cachedNativeRawGeometryBuffers.get(levelId);
  if (!cached) {
    cached = loadRawWebGpuGeometryBuffer(levelId);
    cachedNativeRawGeometryBuffers.set(levelId, cached);
  }
  return cached;
}

function cloneTuple4(value: Tuple4 | null | undefined): Tuple4 | null | undefined {
  return value ? ([...value] as Tuple4) : value;
}

function cloneGeometryAsset(asset: RawPlanGeometryAsset): RawPlanGeometryAsset {
  return {
    ...asset,
    rigidSkin: asset.rigidSkin ? { ...asset.rigidSkin } : asset.rigidSkin,
    animationClips: asset.animationClips?.map((clip) => ({
      ...clip,
      targetPaths: clip.targetPaths ? [...clip.targetPaths] : clip.targetPaths,
    })),
    nodeChunks: asset.nodeChunks?.map((chunk) => ({
      ...chunk,
      bindMatrix: [...chunk.bindMatrix],
      inverseBindMatrix: [...chunk.inverseBindMatrix],
    })),
    bounds: asset.bounds
      ? {
          min: [...asset.bounds.min] as Tuple3,
          center: [...asset.bounds.center] as Tuple3,
          size: [...asset.bounds.size] as Tuple3,
        }
      : asset.bounds,
  };
}
