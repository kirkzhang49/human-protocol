import { Matrix3, Matrix4, Quaternion, Vector3 } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import type { Tuple3, Tuple4 } from "../../render/raw-webgpu/RawWebGpuTypes";
import { readCachedCookedModels, writeCachedCookedModels } from "./cookedModelCache";

/**
 * Browser-side GLB cooker for deep builder playtest packs.
 *
 * Parses binary glTF (GLB) and flattens the node hierarchy into the raw
 * renderer's packed 10-float vertex format (position3, normal3, uv2,
 * materialIndex, rigidJointIndex), preserving PBR material factors
 * (base color, emissive + strength, roughness/metalness, alpha mode).
 * Textures are not baked in v1 — material factors carry the look.
 *
 * Geometry bufferViews compressed with EXT_meshopt_compression (and quantized
 * with KHR_mesh_quantization) are decoded up front via MeshoptDecoder — the
 * same decoder the offline compiler uses. Without that, the cooker read the
 * compressed/fallback bytes as raw quantized values, producing NaN vertex
 * positions that exploded into black spikes on every render path.
 *
 * This intentionally re-implements the *minimum* of the offline Node
 * compiler needed for builder furniture/pickups/robots; it never runs the
 * offline pipeline in the browser.
 */

/**
 * Resolves before cooking any meshopt-compressed GLB. parseGlbToCookedModel is
 * synchronous, but the meshopt WASM decoder initialises asynchronously, so the
 * async cook entry points await this first. Tests call it directly.
 */
export function ensureMeshoptDecoderReady(): Promise<unknown> {
  return MeshoptDecoder.ready;
}

export interface CookedGlbMaterial {
  name: string;
  baseColorFactor: Tuple4;
  emissiveFactor: Tuple3;
  emissiveStrength: number;
  roughnessFactor: number;
  metallicFactor: number;
  alphaMode: "OPAQUE" | "MASK" | "BLEND";
  doubleSided: boolean;
  /** Index into CookedGlbModel.images when the material has a base color texture. */
  baseColorImageIndex?: number;
}

export interface CookedGlbImage {
  /** glTF image index inside the source file. */
  imageIndex: number;
  mimeType: string;
  bytes: ArrayBuffer;
  /** 8x8 downsample stats (set after decode validation). */
  stats?: { lumaMean: number; contrast: number; chroma: number; detail: number };
  /** Average decoded color, linear-ish 0..1 (tint fallback). */
  dominantColor?: Tuple3;
}

export interface CookedGlbNodeChunk {
  nodeName: string | null;
  /** Vertex offset LOCAL to this model's vertex blob. */
  vertexOffset: number;
  vertexCount: number;
}

export interface CookedGlbModel {
  modelKey: string;
  /** Packed 14-float vertices with LOCAL material indices (column 12). */
  vertices: Float32Array;
  vertexCount: number;
  triangleCount: number;
  materials: CookedGlbMaterial[];
  images: CookedGlbImage[];
  /** Per-node sub-ranges (viewmodel articulation); absent for bulk models. */
  nodeChunks?: CookedGlbNodeChunk[];
  bounds: { min: Tuple3; center: Tuple3; size: Tuple3 };
  warnings: string[];
}

export interface CookedGlbLibrary {
  models: Map<string, CookedGlbModel>;
  missing: { modelKey: string; reason: string }[];
  geometryBytes: number;
  /** Models whose base color textures could not be extracted/decoded. */
  textureFallbackModels: string[];
}

const FLOATS_PER_VERTEX = 10;
const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

interface GltfJson {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: GltfNode[];
  meshes?: { primitives: GltfPrimitive[] }[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  materials?: GltfMaterial[];
  textures?: { source?: number; extensions?: { EXT_texture_webp?: { source?: number } } }[];
  images?: { bufferView?: number; mimeType?: string; uri?: string }[];
}

interface GltfNode {
  name?: string;
  children?: number[];
  mesh?: number;
  matrix?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT4";
}

interface MeshoptCompressionExtension {
  /** Buffer index holding the compressed stream (the GLB BIN buffer is 0). */
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride: number;
  count: number;
  mode: "ATTRIBUTES" | "TRIANGLES" | "INDICES";
  filter?: "NONE" | "OCTAHEDRAL" | "QUATERNION" | "EXPONENTIAL";
}

interface GltfBufferView {
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
  extensions?: { EXT_meshopt_compression?: MeshoptCompressionExtension };
}

interface GltfMaterial {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    metallicFactor?: number;
    roughnessFactor?: number;
    baseColorTexture?: { index?: number };
  };
  emissiveFactor?: number[];
  alphaMode?: "OPAQUE" | "MASK" | "BLEND";
  doubleSided?: boolean;
  extensions?: { KHR_materials_emissive_strength?: { emissiveStrength?: number } };
}

/** Parses one GLB ArrayBuffer into a cooked model. Throws on unsupported files. */
export function parseGlbToCookedModel(
  modelKey: string,
  buffer: ArrayBuffer,
  options: { emitNodeChunks?: boolean } = {},
): CookedGlbModel {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("不是有效的 GLB 文件。");
  }
  let offset = 12;
  let json: GltfJson | null = null;
  let bin: Uint8Array | null = null;
  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkType === CHUNK_JSON) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, chunkStart, chunkLength))) as GltfJson;
    } else if (chunkType === CHUNK_BIN) {
      bin = new Uint8Array(buffer, chunkStart, chunkLength);
    }
    offset = chunkStart + chunkLength + ((4 - (chunkLength % 4)) % 4);
  }
  if (!json || !bin) throw new Error("GLB 缺少 JSON 或二进制数据块。");

  const warnings: string[] = [];
  const images: CookedGlbImage[] = [];
  const imageSlotByGltfIndex = new Map<number, number>();
  const extractImage = (gltfImageIndex: number | undefined): number | undefined => {
    if (gltfImageIndex === undefined) return undefined;
    const existing = imageSlotByGltfIndex.get(gltfImageIndex);
    if (existing !== undefined) return existing;
    const image = json.images?.[gltfImageIndex];
    if (!image || image.bufferView === undefined) {
      if (image?.uri) warnings.push("跳过外部引用的贴图（仅支持内嵌贴图）。");
      return undefined;
    }
    const view = json.bufferViews?.[image.bufferView];
    if (!view) return undefined;
    const start = view.byteOffset ?? 0;
    const bytes = bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + view.byteLength) as ArrayBuffer;
    const slot = images.length;
    images.push({ imageIndex: gltfImageIndex, mimeType: image.mimeType ?? "image/png", bytes });
    imageSlotByGltfIndex.set(gltfImageIndex, slot);
    return slot;
  };
  const materials: CookedGlbMaterial[] = (json.materials ?? []).map((material, index) => {
    const baseColorTextureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index;
    const baseColorTexture = baseColorTextureIndex !== undefined ? json.textures?.[baseColorTextureIndex] : undefined;
    // EXT_texture_webp (gltf-transform / Poly Haven CC0 default) nests the image
    // index under extensions; without this the webp diffuse is dropped at parse
    // time and the prop renders solid white. Fall back to the standard source.
    const gltfImageIndex = baseColorTexture?.extensions?.EXT_texture_webp?.source ?? baseColorTexture?.source;
    return {
      name: material.name ?? `material_${index}`,
      baseColorFactor: tuple4(material.pbrMetallicRoughness?.baseColorFactor, [1, 1, 1, 1]),
      emissiveFactor: tuple3(material.emissiveFactor, [0, 0, 0]),
      emissiveStrength: material.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? emissiveStrengthFromFactor(material.emissiveFactor),
      roughnessFactor: material.pbrMetallicRoughness?.roughnessFactor ?? 0.7,
      metallicFactor: material.pbrMetallicRoughness?.metallicFactor ?? 0,
      alphaMode: material.alphaMode ?? "OPAQUE",
      doubleSided: material.doubleSided ?? false,
      baseColorImageIndex: extractImage(gltfImageIndex),
    };
  });
  if (materials.length === 0) {
    materials.push({
      name: "default",
      baseColorFactor: [0.8, 0.8, 0.8, 1],
      emissiveFactor: [0, 0, 0],
      emissiveStrength: 0,
      roughnessFactor: 0.7,
      metallicFactor: 0,
      alphaMode: "OPAQUE",
      doubleSided: false,
    });
  }

  const floats: number[] = [];
  const min: Tuple3 = [Infinity, Infinity, Infinity];
  const max: Tuple3 = [-Infinity, -Infinity, -Infinity];
  const reader = new AccessorReader(json, bin);
  const worldMatrix = new Matrix4();
  const normalMatrix = new Matrix3();
  const positionVector = new Vector3();
  const normalVector = new Vector3();
  const tangentVector = new Vector3();

  const nodeChunks: CookedGlbNodeChunk[] = [];
  const visitNode = (nodeIndex: number, parentMatrix: Matrix4, nodeName: string | null) => {
    const node = json.nodes?.[nodeIndex];
    if (!node) return;
    const localMatrix = nodeLocalMatrix(node);
    const nodeMatrix = new Matrix4().multiplyMatrices(parentMatrix, localMatrix);
    const ownName = node.name ?? nodeName;
    if (node.mesh !== undefined) {
      const chunkStart = floats.length / FLOATS_PER_VERTEX;
      const mesh = json.meshes?.[node.mesh];
      for (const primitive of mesh?.primitives ?? []) {
        if ((primitive.mode ?? 4) !== 4) {
          warnings.push(`跳过非三角形网格片段（mode ${primitive.mode}）。`);
          continue;
        }
        appendPrimitive(primitive, nodeMatrix);
      }
      const chunkCount = floats.length / FLOATS_PER_VERTEX - chunkStart;
      if (options.emitNodeChunks && chunkCount > 0) {
        nodeChunks.push({ nodeName: ownName, vertexOffset: chunkStart, vertexCount: chunkCount });
      }
    }
    for (const child of node.children ?? []) visitNode(child, nodeMatrix, ownName);
  };

  const appendPrimitive = (primitive: GltfPrimitive, matrix: Matrix4) => {
    const positions = reader.readVec(primitive.attributes.POSITION, 3);
    if (!positions) {
      warnings.push("跳过缺少顶点位置的网格片段。");
      return;
    }
    const normals = reader.readVec(primitive.attributes.NORMAL, 3);
    const tangents = reader.readVec(primitive.attributes.TANGENT, 4);
    const uvs = reader.readVec(primitive.attributes.TEXCOORD_0, 2);
    const indices = primitive.indices !== undefined ? reader.readIndices(primitive.indices) : null;
    const materialIndex = Math.min(materials.length - 1, Math.max(0, primitive.material ?? 0));

    worldMatrix.copy(matrix);
    normalMatrix.getNormalMatrix(worldMatrix);
    const vertexTotal = indices ? indices.length : positions.length / 3;
    for (let i = 0; i < vertexTotal; i += 1) {
      const vertexIndex = indices ? indices[i] : i;
      positionVector.fromArray(positions, vertexIndex * 3).applyMatrix4(worldMatrix);
      if (normals) normalVector.fromArray(normals, vertexIndex * 3).applyMatrix3(normalMatrix).normalize();
      else normalVector.set(0, 1, 0);
      let tangentW = 1;
      if (tangents) {
        tangentVector.fromArray(tangents, vertexIndex * 4).applyMatrix3(normalMatrix).normalize();
        tangentW = tangents[vertexIndex * 4 + 3] >= 0 ? 1 : -1;
      } else {
        tangentVector.set(1, 0, 0);
      }
      const u = uvs ? uvs[vertexIndex * 2] : 0;
      const v = uvs ? uvs[vertexIndex * 2 + 1] : 0;
      floats.push(
        positionVector.x, positionVector.y, positionVector.z,
        normalVector.x, normalVector.y, normalVector.z,
        u, v,
        materialIndex, -1,
      );
      min[0] = Math.min(min[0], positionVector.x);
      min[1] = Math.min(min[1], positionVector.y);
      min[2] = Math.min(min[2], positionVector.z);
      max[0] = Math.max(max[0], positionVector.x);
      max[1] = Math.max(max[1], positionVector.y);
      max[2] = Math.max(max[2], positionVector.z);
    }
  };

  const sceneIndex = json.scene ?? 0;
  const roots = json.scenes?.[sceneIndex]?.nodes ?? [];
  const identity = new Matrix4();
  for (const root of roots) visitNode(root, identity, null);

  const vertexCount = floats.length / FLOATS_PER_VERTEX;
  if (vertexCount <= 0) throw new Error("GLB 中没有可用的三角形几何。");
  return {
    modelKey,
    vertices: new Float32Array(floats),
    vertexCount,
    triangleCount: vertexCount / 3,
    materials,
    images,
    ...(options.emitNodeChunks && nodeChunks.length > 0 ? { nodeChunks } : {}),
    bounds: {
      min,
      center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    },
    warnings,
  };
}

/**
 * Fetches + cooks a list of models; failures land in `missing`, never throw.
 * Runs in a module Web Worker when available (keeps builder UI responsive),
 * with a transparent main-thread fallback.
 */
function deepCookPerfLogEnabled(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perfLog");
}

export async function cookGlbModelLibrary(
  requests: readonly { modelKey: string; url: string; emitNodeChunks?: boolean }[],
  onModel?: (modelKey: string, index: number, total: number, stage: "fetch" | "cook") => void,
): Promise<CookedGlbLibrary> {
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;

  // Per-model cook cache (keyed by GLB url = vite content hash). DEV serves
  // source paths without a content hash, so skip the cache there; correctness is
  // more important than hiding changed GLB bytes behind IndexedDB.
  const cacheEnabled = cookedModelCacheEnabled();
  const cached = cacheEnabled ? await readCachedCookedModels(requests.map((request) => request.url)) : new Map<string, CookedGlbModel>();
  const toCook = requests.filter((request) => !cached.has(request.url));
  requests.forEach((request, index) => {
    if (cached.has(request.url)) onModel?.(request.modelKey, index, requests.length, "cook");
  });

  let path: "cache" | "worker" | "main-thread" = "cache";
  let cooked: CookedGlbLibrary = { models: new Map(), missing: [], geometryBytes: 0, textureFallbackModels: [] };
  if (toCook.length > 0) {
    path = "main-thread";
    // Spinning up a worker loads all of three.js into it; for a handful of newly
    // changed models (the common case once the per-model cache is warm) that
    // overhead dwarfs the work, so cook small batches on the main thread and only
    // offload large (cold-cache) batches to keep the UI responsive.
    if (toCook.length > 3 && typeof Worker !== "undefined" && typeof window !== "undefined") {
      try {
        cooked = await cookGlbModelLibraryInWorker(toCook, onModel);
        path = "worker";
      } catch (error) {
        // Worker fallback is MUCH slower (main-thread, ~1 model per frame) and
        // blocks the UI — if this fires every bake, that is the slowdown.
        console.warn("[HumanProtocol] Deep bake worker unavailable; cooking on main thread.", error);
        cooked = await cookGlbModelLibraryInline(toCook, onModel);
      }
    } else {
      cooked = await cookGlbModelLibraryInline(toCook, onModel);
    }
    // Persist newly cooked models for next time (best-effort, do not block).
    const fresh: { url: string; model: CookedGlbModel }[] = [];
    for (const model of cooked.models.values()) {
      const request = toCook.find((candidate) => candidate.modelKey === model.modelKey);
      if (request) fresh.push({ url: request.url, model });
    }
    if (cacheEnabled) void writeCachedCookedModels(fresh);
  }

  // Merge cache hits + freshly cooked into the full library.
  const models = new Map(cooked.models);
  let geometryBytes = cooked.geometryBytes;
  for (const request of requests) {
    if (models.has(request.modelKey)) continue;
    const cachedModel = cached.get(request.url);
    if (cachedModel) {
      models.set(request.modelKey, cachedModel);
      geometryBytes += cachedModel.vertices.byteLength;
    }
  }
  const result: CookedGlbLibrary = { models, missing: cooked.missing, geometryBytes, textureFallbackModels: cooked.textureFallbackModels };

  if (deepCookPerfLogEnabled()) {
    const ms = (typeof performance !== "undefined" ? performance.now() : 0) - startedAt;
    console.info(
      `[perfLog] deep cook: ${requests.length} models (${cached.size} cached / ${toCook.length} cooked) ` +
        `in ${ms.toFixed(0)}ms via ${path} (${(geometryBytes / 1024).toFixed(0)}KB geom, ${result.missing.length} missing)`,
    );
    if (result.missing.length > 0) {
      // Missing models fall back to untextured proxy geometry → render uncolored/white.
      console.warn(
        "[perfLog] deep cook proxy fallbacks (these render uncolored):",
        result.missing.map((entry) => `${entry.modelKey} (${entry.reason})`),
      );
    }
    if (result.textureFallbackModels.length > 0) {
      console.warn("[perfLog] deep cook texture fallbacks:", result.textureFallbackModels);
    }
  }
  return result;
}

function cookedModelCacheEnabled() {
  return !import.meta.env.DEV;
}

interface GlbCookWorkerProgressMessage {
  type: "progress";
  modelKey: string;
  index: number;
  total: number;
  stage: "fetch" | "cook";
}

interface GlbCookWorkerDoneMessage {
  type: "done";
  models: CookedGlbModel[];
  missing: { modelKey: string; reason: string }[];
  geometryBytes: number;
  textureFallbackModels: string[];
}

export type GlbCookWorkerMessage = GlbCookWorkerProgressMessage | GlbCookWorkerDoneMessage;

function cookGlbModelLibraryInWorker(
  requests: readonly { modelKey: string; url: string; emitNodeChunks?: boolean }[],
  onModel?: (modelKey: string, index: number, total: number, stage: "fetch" | "cook") => void,
): Promise<CookedGlbLibrary> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./glbCookWorker.ts", import.meta.url), { type: "module" });
    const finish = (settle: () => void) => {
      worker.terminate();
      settle();
    };
    worker.onmessage = (event: MessageEvent<GlbCookWorkerMessage>) => {
      const message = event.data;
      if (message.type === "progress") {
        onModel?.(message.modelKey, message.index, message.total, message.stage);
        return;
      }
      finish(() =>
        resolve({
          models: new Map(message.models.map((model) => [model.modelKey, model])),
          missing: message.missing,
          geometryBytes: message.geometryBytes,
          textureFallbackModels: message.textureFallbackModels,
        }),
      );
    };
    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || "deep bake worker crashed")));
    };
    worker.postMessage({
      requests: requests.map((request) => ({
        modelKey: request.modelKey,
        url: new URL(request.url, window.location.href).href,
        emitNodeChunks: request.emitNodeChunks ?? false,
      })),
    });
  });
}

/** Main-thread (and worker-internal) cooking loop. */
export async function cookGlbModelLibraryInline(
  requests: readonly { modelKey: string; url: string; emitNodeChunks?: boolean }[],
  onModel?: (modelKey: string, index: number, total: number, stage: "fetch" | "cook") => void,
): Promise<CookedGlbLibrary> {
  const models = new Map<string, CookedGlbModel>();
  const missing: { modelKey: string; reason: string }[] = [];
  const textureFallbackModels: string[] = [];
  let geometryBytes = 0;

  // Many builder GLBs ship EXT_meshopt_compression geometry; the (synchronous)
  // parser needs the WASM decoder live before it touches their bufferViews.
  await ensureMeshoptDecoderReady();

  // Phase 1 — download every GLB concurrently. Serial `await fetch` per model was
  // the deep-cook bottleneck (network IO done one model at a time). Batch the
  // concurrency so a large project never holds every buffer in memory at once.
  const FETCH_CONCURRENCY = 8;
  const fetched: ({ request: (typeof requests)[number]; buffer: ArrayBuffer } | null)[] = [];
  for (let start = 0; start < requests.length; start += FETCH_CONCURRENCY) {
    const batch = requests.slice(start, start + FETCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (request, offset) => {
        const index = start + offset;
        onModel?.(request.modelKey, index, requests.length, "fetch");
        try {
          const response = await fetch(request.url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = await response.arrayBuffer();
          return { request, buffer };
        } catch (error) {
          missing.push({ modelKey: request.modelKey, reason: `模型下载失败（${error instanceof Error ? error.message : "网络错误"}）` });
          return null;
        }
      }),
    );
    for (const entry of batchResults) fetched.push(entry);
  }

  // Phase 2 — parse on the single cook thread (CPU-bound), yielding every few
  // models so the worker can still post progress without starving.
  for (const [index, entry] of fetched.entries()) {
    if (!entry) continue;
    const { request, buffer } = entry;
    onModel?.(request.modelKey, index, requests.length, "cook");
    try {
      const model = parseGlbToCookedModel(request.modelKey, buffer, { emitNodeChunks: request.emitNodeChunks ?? false });
      const textureOk = await validateAndDescribeImages(model);
      if (!textureOk) textureFallbackModels.push(request.modelKey);
      models.set(request.modelKey, model);
      geometryBytes += model.vertices.byteLength;
    } catch (error) {
      missing.push({ modelKey: request.modelKey, reason: error instanceof Error ? error.message : "模型解析失败" });
    }
    if ((index & 3) === 3) await yieldToFrame();
  }

  return { models, missing, geometryBytes, textureFallbackModels };
}

/**
 * Decode-validates extracted base color textures and fills stats + dominant
 * color from an 8x8 downsample. Undecodable images are dropped: materials
 * fall back to a dominant/neutral tint instead of broken texture layers.
 * Returns false when any image had to be dropped.
 */
async function validateAndDescribeImages(model: CookedGlbModel): Promise<boolean> {
  if (model.images.length === 0) return true;
  const canDecode = typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function";
  const dropped = new Set<number>();
  for (const [slot, image] of model.images.entries()) {
    if (!canDecode) {
      dropped.add(slot);
      continue;
    }
    try {
      const bitmap = await createImageBitmap(new Blob([image.bytes], { type: image.mimeType }));
      const canvas = new OffscreenCanvas(8, 8);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.drawImage(bitmap, 0, 0, 8, 8);
      bitmap.close?.();
      const data = context.getImageData(0, 0, 8, 8).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let minLuma = 1;
      let maxLuma = 0;
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        const pr = data[pixel] / 255;
        const pg = data[pixel + 1] / 255;
        const pb = data[pixel + 2] / 255;
        r += pr;
        g += pg;
        b += pb;
        const luma = pr * 0.2126 + pg * 0.7152 + pb * 0.0722;
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
      }
      const count = data.length / 4;
      const mean: Tuple3 = [r / count, g / count, b / count];
      const lumaMean = mean[0] * 0.2126 + mean[1] * 0.7152 + mean[2] * 0.0722;
      image.dominantColor = mean;
      image.stats = {
        lumaMean,
        contrast: Math.min(1, maxLuma - minLuma),
        chroma: Math.min(1, Math.max(mean[0], mean[1], mean[2]) - Math.min(mean[0], mean[1], mean[2])),
        detail: Math.min(1, (maxLuma - minLuma) * 1.4),
      };
    } catch {
      dropped.add(slot);
    }
  }
  if (dropped.size === 0) return true;
  for (const material of model.materials) {
    if (material.baseColorImageIndex !== undefined && dropped.has(material.baseColorImageIndex)) {
      material.baseColorImageIndex = undefined;
      // Texture dropped: keep the surface readable with a neutral worn tint.
      material.baseColorFactor = [
        material.baseColorFactor[0] * 0.62,
        material.baseColorFactor[1] * 0.6,
        material.baseColorFactor[2] * 0.58,
        material.baseColorFactor[3],
      ];
    }
  }
  model.images = model.images.filter((_, slot) => !dropped.has(slot));
  model.warnings.push("部分贴图无法解码，已用近似颜色代替。");
  return false;
}

/**
 * Backing bytes for a bufferView plus the local offset where its data starts.
 * Plain views point straight at the GLB BIN; meshopt-compressed views point at
 * a freshly decoded buffer (offset 0). The accessor's own byteOffset is added
 * by the caller.
 */
interface BufferViewBacking {
  data: DataView;
  byteOffset: number;
  byteStride: number | undefined;
}

class AccessorReader {
  private readonly decoded = new Map<number, Uint8Array>();

  constructor(
    private readonly json: GltfJson,
    private readonly bin: Uint8Array,
  ) {}

  /** Resolves (and caches) the backing bytes for one bufferView. */
  private backing(viewIndex: number): BufferViewBacking | null {
    const view = this.json.bufferViews?.[viewIndex];
    if (!view) return null;
    const meshopt = view.extensions?.EXT_meshopt_compression;
    if (meshopt) {
      let bytes = this.decoded.get(viewIndex);
      if (!bytes) {
        if (!MeshoptDecoder.supported) {
          throw new Error("EXT_meshopt_compression：解码器不可用。");
        }
        bytes = new Uint8Array(meshopt.count * meshopt.byteStride);
        const sourceStart = this.bin.byteOffset + (meshopt.byteOffset ?? 0);
        const source = new Uint8Array(this.bin.buffer, sourceStart, meshopt.byteLength);
        // MeshoptDecoder.ready must already be settled (awaited by the cook
        // entry points / tests). decodeGltfBuffer dequantizes per the filter.
        MeshoptDecoder.decodeGltfBuffer(bytes, meshopt.count, meshopt.byteStride, source, meshopt.mode, meshopt.filter ?? "NONE");
        this.decoded.set(viewIndex, bytes);
      }
      return { data: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), byteOffset: 0, byteStride: view.byteStride ?? meshopt.byteStride };
    }
    const start = this.bin.byteOffset + (view.byteOffset ?? 0);
    return { data: new DataView(this.bin.buffer, start, view.byteLength), byteOffset: 0, byteStride: view.byteStride };
  }

  readVec(accessorIndex: number | undefined, components: number): Float32Array | null {
    if (accessorIndex === undefined) return null;
    const accessor = this.json.accessors?.[accessorIndex];
    if (!accessor || accessor.bufferView === undefined) return null;
    const backing = this.backing(accessor.bufferView);
    if (!backing) return null;
    const stride = backing.byteStride ?? components * componentByteSize(accessor.componentType);
    const base = backing.byteOffset + (accessor.byteOffset ?? 0);
    const out = new Float32Array(accessor.count * components);
    for (let element = 0; element < accessor.count; element += 1) {
      for (let component = 0; component < components; component += 1) {
        out[element * components + component] = readComponent(
          backing.data,
          base + element * stride + component * componentByteSize(accessor.componentType),
          accessor.componentType,
          accessor.normalized ?? false,
        );
      }
    }
    return out;
  }

  readIndices(accessorIndex: number): Uint32Array | null {
    const accessor = this.json.accessors?.[accessorIndex];
    if (!accessor || accessor.bufferView === undefined) return null;
    const backing = this.backing(accessor.bufferView);
    if (!backing) return null;
    const base = backing.byteOffset + (accessor.byteOffset ?? 0);
    const out = new Uint32Array(accessor.count);
    const size = componentByteSize(accessor.componentType);
    for (let index = 0; index < accessor.count; index += 1) {
      out[index] = readComponent(backing.data, base + index * size, accessor.componentType, false);
    }
    return out;
  }
}

function componentByteSize(componentType: number) {
  if (componentType === 5126 || componentType === 5125) return 4;
  if (componentType === 5123 || componentType === 5122) return 2;
  return 1;
}

function readComponent(data: DataView, offset: number, componentType: number, normalized: boolean): number {
  if (componentType === 5126) return data.getFloat32(offset, true);
  if (componentType === 5125) return data.getUint32(offset, true);
  if (componentType === 5123) {
    const value = data.getUint16(offset, true);
    return normalized ? value / 65535 : value;
  }
  if (componentType === 5121) {
    const value = data.getUint8(offset);
    return normalized ? value / 255 : value;
  }
  if (componentType === 5122) {
    const value = data.getInt16(offset, true);
    return normalized ? Math.max(-1, value / 32767) : value;
  }
  if (componentType === 5120) {
    // Signed byte — used by KHR_mesh_quantization for octahedral normals.
    const value = data.getInt8(offset);
    return normalized ? Math.max(-1, value / 127) : value;
  }
  return 0;
}

function nodeLocalMatrix(node: GltfNode): Matrix4 {
  const matrix = new Matrix4();
  if (node.matrix && node.matrix.length === 16) {
    return matrix.fromArray(node.matrix);
  }
  const translation = node.translation ?? [0, 0, 0];
  const rotation = node.rotation ?? [0, 0, 0, 1];
  const scale = node.scale ?? [1, 1, 1];
  return matrix.compose(
    new Vector3(translation[0], translation[1], translation[2]),
    new Quaternion(rotation[0], rotation[1], rotation[2], rotation[3]),
    new Vector3(scale[0], scale[1], scale[2]),
  );
}

function emissiveStrengthFromFactor(factor: number[] | undefined) {
  if (!factor) return 0;
  return Math.max(factor[0] ?? 0, factor[1] ?? 0, factor[2] ?? 0) > 0.01 ? 1 : 0;
}

function tuple3(value: number[] | undefined, fallback: Tuple3): Tuple3 {
  return value && value.length >= 3 ? [value[0], value[1], value[2]] : fallback;
}

function tuple4(value: number[] | undefined, fallback: Tuple4): Tuple4 {
  return value && value.length >= 4 ? [value[0], value[1], value[2], value[3]] : fallback;
}

function yieldToFrame(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // Race rAF with a timeout: rAF does not fire in background/hidden tabs,
  // and a bake must keep progressing if the player switches tabs.
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(finish);
    window.setTimeout(finish, 48);
  });
}
