import fs from "node:fs/promises";
import path from "node:path";

const sidecarFolderName = ".raw-webgpu";

export async function writeRawWebGpuAssetSidecars({ gameRoot, levelId, outputDir, plan }) {
  const coverage = plan.assetRuleCoverage ?? [];
  const geometryByModelKey = new Map((plan.geometry?.assets ?? []).map((asset) => [asset.modelKey, asset]));
  const assetByModelKey = new Map((plan.assets ?? []).map((asset) => [asset.modelKey, asset]));
  const instancesByModelKey = groupBy(plan.instances ?? [], (instance) => instance.modelKey);
  const sidecars = [];

  for (const asset of coverage) {
    if (!asset.file) continue;
    const geometry = geometryByModelKey.get(asset.modelKey) ?? null;
    const sourceAsset = assetByModelKey.get(asset.modelKey) ?? null;
    const sidecarPath = rawWebGpuAssetSidecarPath({ gameRoot, levelId, assetFile: asset.file });
    const document = {
      schemaVersion: "hp.raw-webgpu.asset-sidecar.v1",
      levelId,
      modelKey: asset.modelKey,
      category: asset.category,
      file: asset.file,
      fileName: asset.fileName,
      sourceAsset,
      rule: {
        modelKey: asset.ruleModelKey,
        fileName: asset.ruleFileName,
        compileHiddenNodeExactCount: asset.compileHiddenNodeExactCount,
        compileHiddenNodePrefixCount: asset.compileHiddenNodePrefixCount,
      },
      geometry: geometry ? summarizeGeometryAsset(geometry) : null,
      instances: (instancesByModelKey.get(asset.modelKey) ?? []).map(summarizeInstance),
    };
    await fs.mkdir(path.dirname(sidecarPath), { recursive: true });
    await fs.writeFile(sidecarPath, `${JSON.stringify(document, null, 2)}\n`);
    sidecars.push({
      modelKey: asset.modelKey,
      category: asset.category,
      file: asset.file,
      fileName: asset.fileName,
      sidecar: path.relative(gameRoot, sidecarPath),
      ruleModelKey: asset.ruleModelKey,
      ruleFileName: asset.ruleFileName,
    });
  }

  const index = {
    schemaVersion: "hp.raw-webgpu.asset-sidecar-index.v1",
    levelId,
    generatedBy: "tools/raw-webgpu-compiler/compile-raw-webgpu-render-plan.mjs",
    sidecarCount: sidecars.length,
    sidecars: sidecars.sort((a, b) => a.category.localeCompare(b.category) || a.modelKey.localeCompare(b.modelKey)),
  };
  const indexPath = path.join(outputDir, `asset_sidecars_${levelId}.json`);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return {
    count: sidecars.length,
    indexPath,
  };
}

function rawWebGpuAssetSidecarPath({ gameRoot, levelId, assetFile }) {
  const absoluteAssetPath = path.join(gameRoot, assetFile);
  const parsed = path.parse(absoluteAssetPath);
  return path.join(parsed.dir, `${parsed.name}${parsed.ext ? "" : "-asset"}`, sidecarFolderName, `${levelId}.json`);
}

function summarizeGeometryAsset(asset) {
  return {
    rawFile: asset.rawFile,
    rawSource: asset.rawSource,
    status: asset.status,
    vertexOffset: asset.vertexOffset,
    vertexCount: asset.vertexCount,
    triangleCount: asset.triangleCount,
    meshCount: asset.meshCount,
    materialCount: asset.materialCount,
    nodeCount: asset.nodeCount,
    skinCount: asset.skinCount,
    rigidSkin: asset.rigidSkin,
    bounds: asset.bounds,
    animationClips: asset.animationClips ?? [],
    nodeChunks: asset.nodeChunks ?? [],
  };
}

function summarizeInstance(instance) {
  return {
    id: instance.id,
    source: instance.source,
    role: instance.role,
    roomId: instance.roomId,
    secondaryRoomId: instance.secondaryRoomId,
    position: instance.position,
    localOffset: instance.localOffset,
    rotation: instance.rotation,
    scale: instance.scale,
    tags: instance.tags,
    visibility: instance.visibility,
    state: instance.state,
    estimatedBounds: instance.estimatedBounds,
  };
}

function groupBy(values, keyForValue) {
  const groups = new Map();
  for (const value of values) {
    const key = keyForValue(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return groups;
}
