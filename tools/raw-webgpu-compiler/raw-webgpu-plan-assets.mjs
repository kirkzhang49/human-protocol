import path from "node:path";
import { readGlbMetadataSync } from "./raw-webgpu-glb-metadata.mjs";
import { roundTuple, toScaleVector } from "./raw-webgpu-plan-utils.mjs";

export function createInstanceWriter({
  assetTable,
  environmentModelAssets,
  gameRoot,
  getEnvironmentModelAsset,
  instances,
  issues,
}) {
  return function addInstance(input) {
    if (!environmentModelAssets[input.modelKey]) {
      issues.push({
        severity: "error",
        type: "unknown_model_key",
        id: input.id,
        modelKey: input.modelKey,
      });
      return;
    }

    const asset = getEnvironmentModelAsset(input.modelKey);
    if (!assetTable.has(asset.modelKey)) {
      assetTable.set(asset.modelKey, createAssetRecord(asset, gameRoot));
    }

    const scale = toScaleVector(input.scale ?? 1);
    const instance = {
      id: input.id,
      source: input.source,
      role: input.role,
      roomId: input.roomId ?? null,
      secondaryRoomId: input.secondaryRoomId ?? null,
      modelKey: asset.modelKey,
      position: roundTuple(input.position ?? [0, 0, 0]),
      localOffset: input.localOffset ? roundTuple(input.localOffset) : [0, 0, 0],
      rotation: roundTuple(input.rotation ?? [0, 0, 0]),
      scale: roundTuple(scale),
      castShadow: Boolean(input.castShadow),
      receiveShadow: Boolean(input.receiveShadow),
      tags: input.tags ?? [],
      visibility: input.visibility ?? { type: "always" },
      state: input.state ?? null,
      estimatedBounds: estimateBounds(asset.sizeMeters, scale, input.position ?? [0, 0, 0]),
    };
    instances.push(instance);
  };
}

export function createAssetRecord(asset, gameRoot) {
  const filePath = viteUrlToFilePath(asset.url, gameRoot);
  const glb = filePath ? readGlbMetadataSync(filePath) : null;
  return {
    modelKey: asset.modelKey,
    category: asset.category,
    url: normalizeViteUrl(asset.url),
    file: filePath ? path.relative(gameRoot, filePath) : null,
    sizeMeters: asset.sizeMeters,
    glb,
  };
}

export function viteUrlToFilePath(url, gameRoot) {
  const normalized = normalizeViteUrl(url);
  const noQuery = normalized.split("?")[0];
  if (noQuery.startsWith("/src/")) return path.join(gameRoot, noQuery.slice(1));
  if (noQuery.startsWith("src/")) return path.join(gameRoot, noQuery);
  if (noQuery.startsWith("/assets/")) return null;
  return path.isAbsolute(noQuery) ? noQuery : path.join(gameRoot, noQuery);
}

export function normalizeViteUrl(url) {
  return String(url).replaceAll("\\\\", "/");
}

function estimateBounds(sizeMeters, scale, position) {
  const halfSize = [
    Math.abs(sizeMeters[0] * scale[0]) / 2,
    Math.abs(sizeMeters[1] * scale[1]) / 2,
    Math.abs(sizeMeters[2] * scale[2]) / 2,
  ];
  return {
    center: roundTuple(position),
    halfSize: roundTuple(halfSize),
  };
}
