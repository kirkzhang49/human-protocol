import fs from "node:fs/promises";
import path from "node:path";
import { hashString } from "./raw-webgpu-plan-utils.mjs";

const FLOATS_PER_VERTEX = 10;
const VERTEX_MATERIAL_INDEX_COMPONENT = 8;
const ENGINE_BUILTIN_MATERIAL_COUNT = 2;

export function createOfficialBuilderSurfaceBridge({
  compileBuilderRuntimePack,
  level,
  project,
}) {
  if (!compileBuilderRuntimePack || !level || !project) {
    return emptyBuilderSurfaceBridge("missing-runtime-module");
  }

  const eligibleRoomIds = new Set(
    (project.rooms ?? [])
      .filter((room) => room.style !== "exit")
      .filter((room) => hasSurfaceOverride(room))
      .map((room) => room.id),
  );
  if (eligibleRoomIds.size === 0) return emptyBuilderSurfaceBridge("no-surface-overrides");

  const runtimePack = compileBuilderRuntimePack(level, project);
  const surfaceAssetKeys = new Set(
    (runtimePack.renderPlan.geometry?.assets ?? [])
      .filter((asset) => isSurfaceAssetForEligibleRoom(asset.modelKey, eligibleRoomIds))
      .map((asset) => asset.modelKey),
  );
  const instances = (runtimePack.renderPlan.instances ?? [])
    .filter((instance) => surfaceAssetKeys.has(instance.modelKey))
    .map((instance) => ({
      ...instance,
      id: `official-builder-surface:${instance.id}`,
      source: "builder-surface",
      tags: [...(instance.tags ?? []), "official-builder-surface"],
      state: {
        ...(instance.state ?? {}),
        officialBuilderSurface: true,
        sourceLayer: "builder-import",
      },
    }));

  return {
    enabled: instances.length > 0,
    reason: instances.length > 0 ? "builder-surface-overrides" : "no-surface-instances",
    eligibleRoomIds,
    runtimePack,
    surfaceAssetKeys,
    instances,
    assets: [...surfaceAssetKeys].map((modelKey) => ({
      modelKey,
      category: "builder-surface",
      url: `builder-surface://${modelKey}`,
      file: null,
      sizeMeters: [1, 1, 1],
      glb: null,
      generated: true,
      runtimeSource: "official-builder-surface",
    })),
  };
}

export function replaceOfficialShellSurfacesWithBuilderSurfaces({
  assetTable,
  bridge,
  instances,
}) {
  if (!bridge?.enabled) return { removedInstances: 0, prunedAssets: 0 };
  const eligibleRoomIds = bridge.eligibleRoomIds ?? new Set();
  const before = instances.length;
  for (let index = instances.length - 1; index >= 0; index -= 1) {
    const instance = instances[index];
    if (
      instance.source === "shell" &&
      eligibleRoomIds.has(instance.roomId) &&
      (instance.role === "floor" || instance.role === "wall" || instance.role === "ceiling")
    ) {
      instances.splice(index, 1);
    }
  }
  instances.push(...bridge.instances);

  const usedModelKeys = new Set(instances.map((instance) => instance.modelKey).filter(Boolean));
  let prunedAssets = 0;
  for (const modelKey of [...assetTable.keys()]) {
    if (usedModelKeys.has(modelKey)) continue;
    assetTable.delete(modelKey);
    prunedAssets += 1;
  }

  return {
    removedInstances: before - (instances.length - bridge.instances.length),
    prunedAssets,
  };
}

export async function appendOfficialBuilderSurfaceGeometry({
  bridge,
  gameRoot,
  geometry,
  geometryOutputPath,
  textureOutputDir,
  texturePublicBase,
}) {
  if (!bridge?.enabled) return geometry;
  const sourceGeometry = bridge.runtimePack.renderPlan.geometry ?? {};
  const sourceAssets = (sourceGeometry.assets ?? []).filter((asset) => bridge.surfaceAssetKeys.has(asset.modelKey));
  if (sourceAssets.length === 0) return geometry;

  const officialBytes = await fs.readFile(geometryOutputPath);
  const officialVertices = new Float32Array(
    officialBytes.buffer,
    officialBytes.byteOffset,
    officialBytes.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
  const sourceVertices = new Float32Array(bridge.runtimePack.geometryBuffer);
  const materialIndexOffset = Math.max(0, (geometry.materials?.length ?? ENGINE_BUILTIN_MATERIAL_COUNT) - ENGINE_BUILTIN_MATERIAL_COUNT);
  const textureLayerOffset = Math.max(0, ...(geometry.baseColorTextures ?? []).map((texture) => Number(texture.layer) || 0));
  const sourceUsedMaterialIndices = usedMaterialIndicesForAssets(sourceVertices, sourceAssets);
  const sourceBaseColorLayers = usedBaseColorTextureLayers(sourceGeometry.materials ?? [], sourceUsedMaterialIndices);
  const textureLayerMap = await copySurfaceTextures({
    baseColorTextures: sourceGeometry.baseColorTextures ?? [],
    sourceLayers: sourceBaseColorLayers,
    gameRoot,
    textureOutputDir,
    texturePublicBase,
    textureLayerOffset,
  });

  const appendedVertices = [];
  const appendedAssets = [];
  let nextVertexOffset = geometry.vertexCount ?? officialVertices.length / FLOATS_PER_VERTEX;
  let appendedVertexCount = 0;
  let appendedTriangleCount = 0;

  for (const asset of sourceAssets) {
    const start = Math.max(0, asset.vertexOffset) * FLOATS_PER_VERTEX;
    const length = Math.max(0, asset.vertexCount) * FLOATS_PER_VERTEX;
    const chunk = new Float32Array(length);
    for (let cursor = 0; cursor < length; cursor += FLOATS_PER_VERTEX) {
      for (let component = 0; component < FLOATS_PER_VERTEX; component += 1) {
        const sourceValue = sourceVertices[start + cursor + component];
        chunk[cursor + component] =
          component === VERTEX_MATERIAL_INDEX_COMPONENT && sourceValue >= ENGINE_BUILTIN_MATERIAL_COUNT
            ? sourceValue + materialIndexOffset
            : sourceValue;
      }
    }
    appendedVertices.push(chunk);
    appendedAssets.push({
      ...asset,
      sourceFile: "official-builder-surface",
      rawFile: null,
      rawSource: "builder-runtime-surface",
      vertexOffset: nextVertexOffset,
      vertexCount: asset.vertexCount,
      triangleCount: asset.triangleCount ?? asset.vertexCount / 3,
      meshCount: 1,
      materialCount: sourceUsedMaterialIndices.size,
      nodeCount: 0,
      skinCount: 0,
      animationClips: [],
      status: asset.status ?? "ready",
    });
    nextVertexOffset += asset.vertexCount;
    appendedVertexCount += asset.vertexCount;
    appendedTriangleCount += asset.triangleCount ?? asset.vertexCount / 3;
  }

  const mergedVertices = new Float32Array(
    officialVertices.length + appendedVertices.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  mergedVertices.set(officialVertices, 0);
  let writeOffset = officialVertices.length;
  for (const chunk of appendedVertices) {
    mergedVertices.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  await fs.writeFile(
    geometryOutputPath,
    Buffer.from(mergedVertices.buffer, mergedVertices.byteOffset, mergedVertices.byteLength),
  );

  const remappedMaterials = (sourceGeometry.materials ?? [])
    .filter((material) => sourceUsedMaterialIndices.has(material.index))
    .map((material) => remapBuilderMaterial(material, materialIndexOffset, textureLayerMap));
  const remappedTextures = [...textureLayerMap.values()].sort((a, b) => a.layer - b.layer);
  const mergedMaterials = [...(geometry.materials ?? []), ...remappedMaterials];
  const mergedBaseColorTextures = [...(geometry.baseColorTextures ?? []), ...remappedTextures];

  return {
    ...geometry,
    binaryByteLength: mergedVertices.byteLength,
    vertexCount: (geometry.vertexCount ?? 0) + appendedVertexCount,
    triangleCount: (geometry.triangleCount ?? 0) + appendedTriangleCount,
    assetCount: (geometry.assetCount ?? geometry.assets?.length ?? 0) + appendedAssets.length,
    readyAssetCount: (geometry.readyAssetCount ?? geometry.assets?.filter((asset) => asset.status === "ready").length ?? 0) + appendedAssets.length,
    materials: mergedMaterials,
    baseColorTextures: mergedBaseColorTextures,
    baseColorTextureStats: summarizeBaseColorTextures(mergedMaterials, mergedBaseColorTextures),
    assets: [...(geometry.assets ?? []), ...appendedAssets],
    officialBuilderSurfaceBridge: {
      roomIds: [...bridge.eligibleRoomIds].sort(),
      assetKeys: [...bridge.surfaceAssetKeys].sort(),
      materialCount: remappedMaterials.length,
      baseColorTextureCount: remappedTextures.length,
    },
  };
}

function emptyBuilderSurfaceBridge(reason) {
  return {
    enabled: false,
    reason,
    eligibleRoomIds: new Set(),
    runtimePack: null,
    surfaceAssetKeys: new Set(),
    instances: [],
    assets: [],
  };
}

function hasSurfaceOverride(room) {
  const overrides = room.env?.surfaceOverrides ?? {};
  return Boolean(overrides.floor?.presetId || overrides.wall?.presetId || overrides.ceiling?.presetId);
}

function isSurfaceAssetForEligibleRoom(modelKey, eligibleRoomIds) {
  if (typeof modelKey !== "string") return false;
  for (const roomId of eligibleRoomIds) {
    if (
      modelKey === `builder:floor:${roomId}` ||
      modelKey === `builder:walls:${roomId}` ||
      modelKey === `builder:ceiling:${roomId}`
    ) {
      return true;
    }
  }
  return false;
}

function usedMaterialIndicesForAssets(vertices, assets) {
  const used = new Set();
  for (const asset of assets) {
    const start = Math.max(0, asset.vertexOffset) * FLOATS_PER_VERTEX;
    const length = Math.max(0, asset.vertexCount) * FLOATS_PER_VERTEX;
    for (let cursor = start; cursor < start + length; cursor += FLOATS_PER_VERTEX) {
      const materialIndex = Math.round(vertices[cursor + VERTEX_MATERIAL_INDEX_COMPONENT]);
      if (Number.isFinite(materialIndex)) used.add(materialIndex);
    }
  }
  return used;
}

function usedBaseColorTextureLayers(materials, materialIndices) {
  const used = new Set();
  for (const material of materials) {
    if (!materialIndices.has(material.index)) continue;
    for (const texture of material.textures ?? []) {
      if (texture.semantic === "baseColor" && Number.isFinite(texture.layer) && texture.layer > 0) {
        used.add(texture.layer);
      }
    }
  }
  return used;
}

async function copySurfaceTextures({
  baseColorTextures,
  sourceLayers,
  gameRoot,
  textureOutputDir,
  texturePublicBase,
  textureLayerOffset,
}) {
  const textureLayerMap = new Map();
  await fs.mkdir(textureOutputDir, { recursive: true });
  for (const texture of baseColorTextures) {
    if (!sourceLayers.has(texture.layer)) continue;
    const sourceFile = viteUrlToFilePath(texture.url, gameRoot);
    const extension = fileExtensionForTextureUrl(texture.url);
    const baseName = `${slugFileName(texture.name ?? "surface")}-${hashString(texture.url)}${extension}`;
    const outputPath = path.join(textureOutputDir, baseName);
    const outputUrl = `${texturePublicBase}/${baseName}`;
    if (sourceFile) {
      await fs.copyFile(sourceFile, outputPath);
    }
    textureLayerMap.set(texture.layer, {
      ...texture,
      layer: texture.layer + textureLayerOffset,
      semantic: texture.semantic ?? "baseColor",
      colorSpace: texture.colorSpace ?? "srgb",
      url: sourceFile ? outputUrl : texture.url,
      sourceFile: sourceFile ? path.relative(gameRoot, sourceFile) : texture.sourceFile ?? null,
    });
  }
  return textureLayerMap;
}

function remapBuilderMaterial(material, materialIndexOffset, textureLayerMap) {
  const visualRole = material.visualRole ?? "default";
  return {
    ...material,
    index: material.index + materialIndexOffset,
    id: `official-builder-surface:${material.index + materialIndexOffset}:${material.id}`,
    category: "official-builder-surface",
    visualRole,
    semanticParams: material.semanticParams ?? defaultSemanticParams(visualRole),
    paletteColorFactor: material.paletteColorFactor ?? [0, 0, 0, 0],
    textures: (material.textures ?? []).map((texture) => {
      if (texture.semantic !== "baseColor" || !textureLayerMap.has(texture.layer)) return { ...texture };
      const remapped = textureLayerMap.get(texture.layer);
      return {
        ...texture,
        layer: remapped.layer,
        url: remapped.url,
        sourceFile: remapped.sourceFile ?? texture.sourceFile ?? null,
        mimeType: remapped.mimeType ?? texture.mimeType ?? null,
      };
    }),
  };
}

function defaultSemanticParams(visualRole) {
  const roleIds = {
    default: 0,
    neutral_surface: 1,
    floor_surface: 2,
    ceiling_surface: 3,
    structural_dark: 4,
    glass_shell: 5,
    exhibit_warm: 6,
    cyan_emissive: 7,
    route_gold: 8,
    danger_red: 9,
    screen_label: 10,
    robot_body: 11,
    door_locked_red: 12,
    door_access_cyan: 13,
    pickup_health: 14,
    pickup_energy: 15,
    pickup_ammo: 16,
    pickup_key: 17,
    switch_active: 18,
    switch_inactive: 19,
  };
  const presets = {
    default: [0.35, 0.08, 0.18],
    neutral_surface: [0.56, 0.05, 0.34],
    floor_surface: [0.70, 0.10, 0.30],
    ceiling_surface: [0.62, 0.08, 0.34],
    structural_dark: [0.82, 0.03, 0.48],
    glass_shell: [0.78, 0.18, 0.12],
    exhibit_warm: [0.76, 0.34, 0.18],
    cyan_emissive: [0.64, 0.30, 0.10],
    route_gold: [0.86, 0.42, 0.06],
    danger_red: [0.82, 0.26, 0.10],
    screen_label: [0.74, 0.36, 0.08],
    robot_body: [0.50, 0.18, 0.18],
    door_locked_red: [0.86, 0.36, 0.08],
    door_access_cyan: [0.82, 0.34, 0.08],
    pickup_health: [0.88, 0.30, 0.10],
    pickup_energy: [0.86, 0.38, 0.08],
    pickup_ammo: [0.72, 0.12, 0.20],
    pickup_key: [0.88, 0.40, 0.06],
    switch_active: [0.80, 0.34, 0.08],
    switch_inactive: [0.82, 0.30, 0.10],
  };
  const roleId = roleIds[visualRole] ?? roleIds.default;
  const params = presets[visualRole] ?? presets.default;
  return [roleId, params[0], params[1], params[2]];
}

function viteUrlToFilePath(url, gameRoot) {
  const normalized = String(url ?? "").split("?")[0].replaceAll("\\", "/");
  if (!normalized) return null;
  if (normalized.startsWith("/src/")) return path.join(gameRoot, normalized.slice(1));
  if (normalized.startsWith("src/")) return path.join(gameRoot, normalized);
  if (path.isAbsolute(normalized) && !normalized.startsWith("/assets/")) return normalized;
  return null;
}

function fileExtensionForTextureUrl(url) {
  const clean = String(url ?? "").split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return ".png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return ".jpg";
  return ".webp";
}

function slugFileName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "surface";
}

function summarizeBaseColorTextures(materials, baseColorTextures) {
  const materialCount = materials.length;
  const texturedMaterialCount = materials.filter((material) =>
    material.textures?.some((texture) => texture.semantic === "baseColor" && Number.isFinite(texture.layer)),
  ).length;
  const textureStats = baseColorTextures.map((texture) => texture.stats).filter(Boolean);
  return {
    layerCount: baseColorTextures.length,
    materialCount,
    texturedMaterialCount,
    texturedMaterialRatio: materialCount > 0 ? roundNumber(texturedMaterialCount / materialCount) : 0,
    averageLuma: averageTextureStat(textureStats, "lumaMean"),
    averageContrast: averageTextureStat(textureStats, "contrast"),
    averageChroma: averageTextureStat(textureStats, "chroma"),
    averageDetail: averageTextureStat(textureStats, "detail"),
  };
}

function averageTextureStat(textureStats, key) {
  if (textureStats.length === 0) return 0;
  return roundNumber(textureStats.reduce((sum, stats) => sum + (Number(stats?.[key]) || 0), 0) / textureStats.length);
}

function roundNumber(value, precision = 4) {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}
