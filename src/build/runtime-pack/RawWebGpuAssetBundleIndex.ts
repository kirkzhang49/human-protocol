import type {
  RawPlanBaseColorTexture,
  RawPlanGeometryAsset,
  RawPlanMaterial,
  RawPlanMaterialTexture,
  RawPlanMaterialTextureSlot,
  Tuple3,
  Tuple4,
} from "../../render/raw-webgpu/RawWebGpuTypes";
import { FLOATS_PER_VERTEX, VERTEX_MATERIAL_INDEX_COMPONENT } from "../../render/raw-webgpu/RawWebGpuConstants";
import type { BuilderNativeRawModelRequest } from "./BuilderRuntimeAssetIndex";
import type { BuilderNativeRawModelLibrary } from "./compileBuilderRuntimePack";

export const RAW_WEBGPU_ASSET_BUNDLE_INDEX_URL = "/assets/human-protocol/raw-webgpu/assets-v1/index.json";

interface RawWebGpuAssetBundleIndex {
  schemaVersion: "hp.raw-webgpu.asset-index.v1";
  publicBase: string;
  assets?: Record<string, RawWebGpuAssetBundleIndexEntry>;
}

interface RawWebGpuAssetBundleIndexEntry {
  modelKey: string;
  family: string;
  bundleId: string;
  version?: number;
  status: "ready" | "missing" | string;
  kind?: string;
  manifest: string;
  geometry: string;
  geometryFormat: "raw-float32" | string;
  hash?: {
    geometry?: string;
    material?: string;
  };
}

interface RawWebGpuAssetBundleManifest {
  schemaVersion: "hp.raw-webgpu.asset-bundle-manifest.v1";
  modelKey: string;
  family: string;
  bundleId: string;
  status: "ready" | "missing" | string;
  source?: {
    sourcePackId?: string;
    sourceLevels?: string[];
  };
  geometry: {
    file: string;
    format: "raw-float32" | string;
    vertexStrideFloats: number;
    vertexCount: number;
    triangleCount: number;
    asset: RawPlanGeometryAsset;
  };
  material: {
    materials?: RawPlanMaterial[];
    baseColorTextureSize?: number;
    baseColorTextures?: RawPlanBaseColorTexture[];
    materialTextureSize?: number;
    materialTextures?: RawPlanMaterialTexture[];
  };
}

interface LoadedBundleAsset {
  request: BuilderNativeRawModelRequest;
  entry: RawWebGpuAssetBundleIndexEntry;
  manifest: RawWebGpuAssetBundleManifest;
  vertices: Float32Array;
}

let cachedIndexPromise: Promise<RawWebGpuAssetBundleIndex | null> | null = null;
const cachedBundlePromises = new Map<string, Promise<LoadedBundleAsset | null>>();

export async function loadRawWebGpuAssetBundleModelLibrary(
  requests: readonly BuilderNativeRawModelRequest[],
): Promise<BuilderNativeRawModelLibrary | null> {
  if (typeof fetch !== "function" || typeof window === "undefined") return null;
  const index = await loadAssetBundleIndex();
  if (!index?.assets) return null;

  const uniqueRequests = new Map<string, BuilderNativeRawModelRequest>();
  for (const request of requests) {
    if (request.modelKey && !uniqueRequests.has(request.modelKey)) uniqueRequests.set(request.modelKey, request);
  }

  const loaded = (
    await Promise.all(
      [...uniqueRequests.values()].map(async (request) => {
        const entry = index.assets?.[request.modelKey];
        if (!entry || entry.status !== "ready" || entry.geometryFormat !== "raw-float32") return null;
        return loadBundleAsset(index, entry, request);
      }),
    )
  ).filter((asset): asset is LoadedBundleAsset => asset !== null);
  if (loaded.length === 0) return null;

  let nextMaterialIndex = 2;
  let nextBaseColorLayer = 1;
  let nextMaterialLayer = 1;
  const materials: RawPlanMaterial[] = [];
  const baseColorTextures: RawPlanBaseColorTexture[] = [];
  const materialTextures: RawPlanMaterialTexture[] = [];
  const models: BuilderNativeRawModelLibrary["models"] = new Map();
  let baseColorTextureSize: number | undefined;
  let materialTextureSize: number | undefined;

  for (const asset of loaded) {
    baseColorTextureSize ??= asset.manifest.material.baseColorTextureSize;
    materialTextureSize ??= asset.manifest.material.materialTextureSize;
    const materialIndexMap = new Map<number, number>();
    const baseColorTexturesByLayer = new Map((asset.manifest.material.baseColorTextures ?? []).map((texture) => [texture.layer, texture]));
    const materialTexturesByLayer = new Map((asset.manifest.material.materialTextures ?? []).map((texture) => [texture.layer, texture]));
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
    const remapAssetTextureSlot = (slot: RawPlanMaterialTextureSlot): RawPlanMaterialTextureSlot => {
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
    for (const material of asset.manifest.material.materials ?? []) {
      const index = nextMaterialIndex++;
      materialIndexMap.set(material.index, index);
      materials.push({
        ...material,
        index,
        id: `assets-v1:${asset.entry.bundleId}:${index}:${material.id}`,
        semanticParams: cloneTuple4(material.semanticParams),
        paletteColorFactor: cloneTuple4(material.paletteColorFactor),
        baseColorFactor: [...material.baseColorFactor] as Tuple4,
        emissiveFactor: [...material.emissiveFactor] as Tuple3,
        transparency: material.transparency ? { ...material.transparency } : material.transparency,
        textures: material.textures?.map((slot) => remapAssetTextureSlot(slot)),
      });
    }

    const vertices = asset.vertices.slice();
    for (let offset = VERTEX_MATERIAL_INDEX_COMPONENT; offset < vertices.length; offset += FLOATS_PER_VERTEX) {
      const sourceIndex = Math.max(0, Math.round(vertices[offset] ?? 0));
      vertices[offset] = materialIndexMap.get(sourceIndex) ?? 0;
    }

    models.set(asset.request.modelKey, {
      modelKey: asset.request.modelKey,
      kind: asset.request.kind,
      sourceLevelId: rawBundleSourceId(asset.entry),
      asset: asset.manifest.geometry.asset,
      vertices,
    });
  }

  if (models.size === 0) return null;
  return {
    libraryId: "raw-webgpu-assets-v1",
    sourceLevelIds: [...new Set([...models.values()].map((model) => model.sourceLevelId))],
    models,
    materials,
    baseColorTextures,
    materialTextures,
    baseColorTextureSize,
    materialTextureSize,
  };
}

async function loadAssetBundleIndex(): Promise<RawWebGpuAssetBundleIndex | null> {
  if (import.meta.env.DEV) {
    return fetchJson<RawWebGpuAssetBundleIndex>(RAW_WEBGPU_ASSET_BUNDLE_INDEX_URL, { cache: "no-cache" }).catch(() => null);
  }
  cachedIndexPromise ??= fetchJson<RawWebGpuAssetBundleIndex>(RAW_WEBGPU_ASSET_BUNDLE_INDEX_URL, { cache: "no-cache" }).catch(() => null);
  return cachedIndexPromise;
}

async function loadBundleAsset(
  index: RawWebGpuAssetBundleIndex,
  entry: RawWebGpuAssetBundleIndexEntry,
  request: BuilderNativeRawModelRequest,
): Promise<LoadedBundleAsset | null> {
  const cacheKey = `${entry.bundleId}:${entry.manifest}:${entry.hash?.geometry ?? "no-geometry-hash"}:${entry.hash?.material ?? "no-material-hash"}`;
  let cached = cachedBundlePromises.get(cacheKey);
  if (!cached) {
    cached = loadBundleAssetUncached(index, entry, request).catch(() => null);
    cachedBundlePromises.set(cacheKey, cached);
  }
  return cached;
}

async function loadBundleAssetUncached(
  index: RawWebGpuAssetBundleIndex,
  entry: RawWebGpuAssetBundleIndexEntry,
  request: BuilderNativeRawModelRequest,
): Promise<LoadedBundleAsset | null> {
  const base = index.publicBase.replace(/\/$/, "");
  const manifestVersion = [entry.hash?.geometry, entry.hash?.material].filter(Boolean).join(":") || String(entry.version ?? "v1");
  const manifest = await fetchJson<RawWebGpuAssetBundleManifest>(withVersion(`${base}/${entry.manifest}`, manifestVersion), { cache: "no-cache" });
  if (manifest.status !== "ready" || manifest.geometry.format !== "raw-float32") return null;
  if (manifest.modelKey !== request.modelKey || manifest.geometry.vertexStrideFloats !== FLOATS_PER_VERTEX) return null;
  const geometryBuffer = await fetchArrayBuffer(withVersion(`${base}/${entry.geometry}`, entry.hash?.geometry ?? manifestVersion), { cache: "force-cache" });
  const vertices = new Float32Array(geometryBuffer);
  if (vertices.length !== manifest.geometry.vertexCount * FLOATS_PER_VERTEX) return null;
  return { request, entry, manifest, vertices };
}

async function fetchJson<T>(url: string, init: RequestInit = { cache: "force-cache" }): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return (await response.json()) as T;
}

async function fetchArrayBuffer(url: string, init: RequestInit = { cache: "force-cache" }): Promise<ArrayBuffer> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return response.arrayBuffer();
}

function withVersion(url: string, version: string | null | undefined) {
  if (!version) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

function rawBundleSourceId(entry: RawWebGpuAssetBundleIndexEntry) {
  const version = [entry.hash?.geometry, entry.hash?.material].filter(Boolean).join(":") || String(entry.version ?? "v1");
  return `assets-v1:${entry.bundleId}:${version}`;
}

function cloneTuple4(value: Tuple4 | null | undefined): Tuple4 | null | undefined {
  return value ? ([...value] as Tuple4) : value;
}
