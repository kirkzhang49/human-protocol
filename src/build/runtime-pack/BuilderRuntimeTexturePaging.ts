import {
  FLOATS_PER_VERTEX,
  RAW_TEXTURE_ARRAY_PAGE_COUNT,
  RAW_TEXTURE_PAGE_STRIDE,
  VERTEX_MATERIAL_INDEX_COMPONENT,
} from "../../render/raw-webgpu/RawWebGpuConstants";
import type {
  RawPlanBaseColorTexture,
  RawPlanGeometry,
  RawPlanMaterial,
  RawPlanMaterialTexture,
  RawPlanMaterialTextureSlot,
  RawPlanTextureStats,
} from "../../render/raw-webgpu/RawWebGpuTypes";
import type { BuilderPackTextureBlob } from "./BuilderRuntimePackTypes";

export const BUILDER_TEXTURE_LAYERS_PER_PAGE = 240;
export const BUILDER_MAX_BASE_COLOR_TEXTURE_PAGES = RAW_TEXTURE_ARRAY_PAGE_COUNT;
export const BUILDER_MAX_MATERIAL_TEXTURE_PAGES = RAW_TEXTURE_ARRAY_PAGE_COUNT;

interface TextureAllocation {
  page: number;
  layer: number;
}

interface TexturePagingAllocator<T extends RawPlanBaseColorTexture> {
  readonly label: "baseColor" | "material";
  readonly maxPages: number;
  readonly textures: T[];
  readonly allocationBySourceRef: Map<string, TextureAllocation>;
  allocate(source: T): TextureAllocation;
}

export interface BuilderRuntimeTexturePagingResult {
  geometry: RawPlanGeometry;
  textureBlobs: BuilderPackTextureBlob[];
  baseColorPagesUsed: number;
  materialPagesUsed: number;
}

export function paginateBuilderRuntimePackTextures(
  geometry: RawPlanGeometry,
  geometryBuffer: ArrayBuffer,
  textureBlobs: readonly BuilderPackTextureBlob[],
): BuilderRuntimeTexturePagingResult {
  const usedMaterialIndices = usedMaterialIndicesForGeometry(geometryBuffer);
  const sourceBaseTextures = textureMapByRef(geometry.baseColorTextures ?? []);
  const sourceMaterialTextures = textureMapByRef(geometry.materialTextures ?? []);
  const baseAllocator = createTexturePagingAllocator<RawPlanBaseColorTexture>("baseColor", BUILDER_MAX_BASE_COLOR_TEXTURE_PAGES);
  const materialAllocator = createTexturePagingAllocator<RawPlanMaterialTexture>("material", BUILDER_MAX_MATERIAL_TEXTURE_PAGES);
  const sourceMaterials = geometry.materials ?? [];

  for (const material of prioritizedMaterialsForTexturePaging(sourceMaterials, usedMaterialIndices)) {
    for (const slot of material.textures ?? []) {
      allocateTextureSlot(slot, sourceBaseTextures, sourceMaterialTextures, baseAllocator, materialAllocator);
    }
  }

  const materials = sourceMaterials.map((material) => {
    if (!usedMaterialIndices.has(material.index)) return { ...material, textures: undefined };
    const textures = material.textures
      ?.map((slot) => remapTextureSlot(slot, sourceBaseTextures, sourceMaterialTextures, baseAllocator, materialAllocator))
      .filter((slot): slot is RawPlanMaterialTextureSlot => slot !== null);
    return {
      ...material,
      textures: textures && textures.length > 0 ? textures : undefined,
    };
  });

  const remappedBlobs: BuilderPackTextureBlob[] = [];
  const emittedBlobAllocations = new Set<string>();
  for (const blob of textureBlobs) {
    const allocation = baseAllocator.allocationBySourceRef.get(textureRef(blob));
    if (!allocation) continue;
    const allocationRef = textureRef(allocation);
    if (emittedBlobAllocations.has(allocationRef)) continue;
    emittedBlobAllocations.add(allocationRef);
    remappedBlobs.push({ ...blob, page: allocation.page, layer: allocation.layer });
  }

  return {
    geometry: {
      ...geometry,
      materials,
      baseColorTextures: baseAllocator.textures,
      materialTextures: materialAllocator.textures,
    },
    textureBlobs: remappedBlobs,
    baseColorPagesUsed: pagesUsed(baseAllocator.textures),
    materialPagesUsed: pagesUsed(materialAllocator.textures),
  };
}

export function encodeRawTexturePageLayer(page: number | null | undefined, layer: number | null | undefined) {
  if (!Number.isFinite(layer) || Number(layer) <= 0) return -1;
  const safePage = Math.max(0, Math.floor(Number(page ?? 0)));
  return safePage * RAW_TEXTURE_PAGE_STRIDE + Math.floor(Number(layer));
}

function remapTextureSlot(
  slot: RawPlanMaterialTextureSlot,
  sourceBaseTextures: Map<string, RawPlanBaseColorTexture>,
  sourceMaterialTextures: Map<string, RawPlanMaterialTexture>,
  baseAllocator: TexturePagingAllocator<RawPlanBaseColorTexture>,
  materialAllocator: TexturePagingAllocator<RawPlanMaterialTexture>,
): RawPlanMaterialTextureSlot | null {
  const allocated = allocateTextureSlot(slot, sourceBaseTextures, sourceMaterialTextures, baseAllocator, materialAllocator);
  if (!allocated) return null;
  const { allocation, source } = allocated;
  return {
    ...slot,
    present: true,
    page: allocation.page,
    layer: allocation.layer,
    url: source.url ?? slot.url ?? null,
    sourceFile: source.sourceFile ?? slot.sourceFile ?? null,
    mimeType: source.mimeType ?? slot.mimeType ?? null,
    stats: source.stats ?? slot.stats ?? null,
  };
}

function allocateTextureSlot(
  slot: RawPlanMaterialTextureSlot,
  sourceBaseTextures: Map<string, RawPlanBaseColorTexture>,
  sourceMaterialTextures: Map<string, RawPlanMaterialTexture>,
  baseAllocator: TexturePagingAllocator<RawPlanBaseColorTexture>,
  materialAllocator: TexturePagingAllocator<RawPlanMaterialTexture>,
): { source: RawPlanBaseColorTexture | RawPlanMaterialTexture; allocation: TextureAllocation } | null {
  if (!slot.present || !Number.isFinite(slot.layer) || Number(slot.layer) <= 0) return null;
  const baseColor = slot.semantic === "baseColor";
  const source =
    (baseColor ? sourceBaseTextures : sourceMaterialTextures).get(textureRef(slot)) ??
    textureEntryFromSlot(slot, baseColor ? "baseColor" : "material");
  if (!source) return null;
  const allocation = (baseColor ? baseAllocator : materialAllocator).allocate(source as never);
  return {
    source,
    allocation,
  };
}

function createTexturePagingAllocator<T extends RawPlanBaseColorTexture>(
  label: "baseColor" | "material",
  maxPages: number,
): TexturePagingAllocator<T> {
  let nextPage = 0;
  let nextLayer = 1;
  const textures: T[] = [];
  const allocationByContentKey = new Map<string, TextureAllocation>();
  const allocationBySourceRef = new Map<string, TextureAllocation>();

  return {
    label,
    maxPages,
    textures,
    allocationBySourceRef,
    allocate(source) {
      const contentKey = textureContentKey(source);
      const sourceRef = textureRef(source);
      const existing = allocationByContentKey.get(contentKey);
      if (existing) {
        allocationBySourceRef.set(sourceRef, existing);
        return existing;
      }
      if (nextLayer > BUILDER_TEXTURE_LAYERS_PER_PAGE) {
        nextPage += 1;
        nextLayer = 1;
      }
      if (nextPage >= maxPages) {
        throw new Error(
          `Raw WebGPU ${label} 贴图预算已满：最多 ${maxPages} 页 x ${BUILDER_TEXTURE_LAYERS_PER_PAGE} 层。请复用已有材质或减少唯一贴图道具。`,
        );
      }
      const allocation = { page: nextPage, layer: nextLayer };
      nextLayer += 1;
      allocationByContentKey.set(contentKey, allocation);
      allocationBySourceRef.set(sourceRef, allocation);
      textures.push({ ...source, page: allocation.page, layer: allocation.layer } as T);
      return allocation;
    },
  };
}

function textureMapByRef<T extends RawPlanBaseColorTexture>(textures: readonly T[]) {
  return new Map(textures.map((texture) => [textureRef(texture), texture]));
}

function textureRef(texture: { page?: number | null; layer?: number | null }) {
  const page = Number.isFinite(texture.page) ? Math.max(0, Math.floor(Number(texture.page))) : 0;
  const layer = Number.isFinite(texture.layer) ? Math.floor(Number(texture.layer)) : -1;
  return `${page}:${layer}`;
}

function textureContentKey(texture: RawPlanBaseColorTexture) {
  if (texture.url || texture.sourceFile) {
    return [texture.url ?? "", texture.sourceFile ?? "", texture.mimeType ?? ""].join("|");
  }
  return [
    texture.mimeType ?? "",
    texture.name ?? "",
    texture.stats ? textureStatsKey(texture.stats) : "",
  ].join("|");
}

function textureStatsKey(stats: RawPlanTextureStats) {
  return `${stats.lumaMean.toFixed(4)}:${stats.contrast.toFixed(4)}:${stats.chroma.toFixed(4)}:${stats.detail.toFixed(4)}`;
}

function textureEntryFromSlot(
  slot: RawPlanMaterialTextureSlot,
  target: "baseColor" | "material",
): RawPlanBaseColorTexture | RawPlanMaterialTexture | null {
  if (!slot.url) return null;
  return {
    page: Number.isFinite(slot.page) ? Number(slot.page) : 0,
    layer: Number(slot.layer),
    url: slot.url,
    name: slot.name ?? null,
    sourceFile: slot.sourceFile ?? null,
    mimeType: slot.mimeType ?? null,
    stats: slot.stats ?? null,
    ...(target === "material" ? { semantic: slot.semantic, colorSpace: slot.colorSpace } : {}),
  };
}

function prioritizedMaterialsForTexturePaging(
  materials: readonly RawPlanMaterial[],
  usedMaterialIndices: ReadonlySet<number>,
) {
  return materials
    .filter((material) => usedMaterialIndices.has(material.index) && (material.textures?.length ?? 0) > 0)
    .map((material, order) => ({ material, order, priority: textureMaterialPriority(material) }))
    .sort((left, right) => left.priority - right.priority || left.order - right.order)
    .map((entry) => entry.material);
}

function textureMaterialPriority(material: RawPlanMaterial) {
  const category = String(material.category ?? "").toLowerCase();
  const role = String(material.visualRole ?? "").toLowerCase();
  const label = `${material.id ?? ""} ${material.name ?? ""}`.toLowerCase();
  if (category === "enemy" || role.includes("robot") || /^mat:enemy:/u.test(label)) return 0;
  if (category === "viewmodel" || /viewmodel|weapon|sidearm|iron-rod|flak|blade/u.test(label)) return 1;
  if (category === "pickup" || /pickup|key_item|medkit|energy_cell|core_cell/u.test(label)) return 2;
  if (category === "interaction" || category === "door" || /interaction|door|puzzle|switch|terminal|elevator/u.test(label)) return 3;
  if (category === "room" || role.includes("floor") || role.includes("ceiling") || role.includes("surface")) return 5;
  return 4;
}

function usedMaterialIndicesForGeometry(geometryBuffer: ArrayBuffer) {
  const floats = new Float32Array(geometryBuffer);
  const used = new Set<number>();
  for (let offset = VERTEX_MATERIAL_INDEX_COMPONENT; offset < floats.length; offset += FLOATS_PER_VERTEX) {
    const index = Math.round(floats[offset] ?? -1);
    if (Number.isFinite(index) && index >= 0) used.add(index);
  }
  return used;
}

function pagesUsed(textures: readonly RawPlanBaseColorTexture[]) {
  return textures.reduce((max, texture) => Math.max(max, Math.floor(Number(texture.page ?? 0)) + 1), 0);
}
