import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { Vector3 } from "three";

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = path.join(gameRoot, "src/assets/manifests/runtime/human_protocol_enemy_horror_assets.json");
const enemyManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const manifestByModelKey = new Map(enemyManifest.assets.map((asset) => [asset.modelKey, asset]));

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const [
    { humanProtocolBasePack },
    { createEnemyRobot },
    { enemyModelAssets, modelKeyForEnemy },
    { enemyArchetypes },
    { enemyVisualProfiles },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    server.ssrLoadModule("/src/game/entities/createEnemyRobot.ts"),
    server.ssrLoadModule("/src/assets/enemyModelAssets.ts"),
    server.ssrLoadModule("/src/game/config/enemyArchetypes.ts"),
    server.ssrLoadModule("/src/game/visual/VisualProfile.ts"),
  ]);

  assertManifestFiles(enemyModelAssets);
  assertRuntimeEnemyAssetsAvoidDecodeCompression(enemyModelAssets);
  assertRuntimeEnemyWarmupMetadata(enemyModelAssets);
  assertArchetypeVisualModels(enemyArchetypes, enemyVisualProfiles, enemyModelAssets);
  assertCampaignEnemyModels(humanProtocolBasePack, createEnemyRobot, modelKeyForEnemy, enemyModelAssets);
} finally {
  await server.close();
}

function assertManifestFiles(enemyModelAssets) {
  for (const modelKey of Object.keys(enemyModelAssets)) {
    const manifestEntry = manifestByModelKey.get(modelKey);
    if (!manifestEntry) fail(`Enemy model "${modelKey}" missing from human_protocol_enemy_horror_assets.json`);
    const filePath = path.join(gameRoot, manifestEntry.file.replace(/^src\//, "src/"));
    if (!fs.existsSync(filePath)) fail(`Enemy model "${modelKey}" file missing: ${manifestEntry.file}`);
  }
  console.log(`PASS enemy GLB manifest files=${Object.keys(enemyModelAssets).length}`);
}

function assertRuntimeEnemyAssetsAvoidDecodeCompression(enemyModelAssets) {
  for (const asset of Object.values(enemyModelAssets)) {
    const filePath = runtimeAssetPath(asset.url);
    const json = readGlbJson(filePath);
    const extensions = new Set([...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])]);
    for (const blockedExtension of ["EXT_meshopt_compression", "KHR_draco_mesh_compression", "KHR_mesh_quantization"]) {
      if (extensions.has(blockedExtension)) {
        fail(`Enemy runtime model "${asset.modelKey}" uses decode-heavy extension ${blockedExtension}: ${asset.url}`);
      }
    }
  }
  console.log(`PASS enemy runtime GLBs avoid meshopt/draco/quantization decode compression`);
}

function assertRuntimeEnemyWarmupMetadata(enemyModelAssets) {
  for (const asset of Object.values(enemyModelAssets)) {
    if (asset.runtimePreload !== true) fail(`Enemy runtime model "${asset.modelKey}" must opt into runtimePreload`);
    if (!Number.isFinite(asset.warmupTargetHeight) || asset.warmupTargetHeight <= 0) {
      fail(`Enemy runtime model "${asset.modelKey}" must declare a positive warmupTargetHeight`);
    }
  }
  console.log(`PASS enemy runtime warmup metadata=${Object.keys(enemyModelAssets).length}`);
}

function assertArchetypeVisualModels(enemyArchetypes, enemyVisualProfiles, enemyModelAssets) {
  for (const archetype of Object.values(enemyArchetypes)) {
    if (archetype.id === "signal_turret") continue;
    const visual = enemyVisualProfiles[archetype.visualKey];
    if (!visual) fail(`Enemy archetype "${archetype.id}" references missing visualKey "${archetype.visualKey}"`);
    if (!visual.modelKey) fail(`Enemy visual "${archetype.visualKey}" must declare a GLB modelKey`);
    if (!enemyModelAssets[visual.modelKey]) fail(`Enemy visual "${archetype.visualKey}" references unknown modelKey "${visual.modelKey}"`);
  }
  console.log(`PASS enemy archetype visual model keys=${Object.keys(enemyArchetypes).length - 1}`);
}

function assertCampaignEnemyModels(basePack, createEnemyRobot, modelKeyForEnemy, enemyModelAssets) {
  const campaignLevels = basePack.campaignLevelIds.map((levelId) => {
    const level = basePack.levels.find((candidate) => candidate.id === levelId);
    if (!level) fail(`Missing campaign level "${levelId}"`);
    return level;
  });
  const used = new Map();
  let id = 1;
  let spawnCount = 0;

  for (const level of campaignLevels) {
    for (const wave of level.waves) {
      const spawns = [...wave.enemies, ...(wave.reinforcements ?? [])];
      for (const spawn of spawns) {
        spawnCount += 1;
        if (spawn.archetype === "signal_turret") continue;
        const enemy = createEnemyRobot(id++, spawn.archetype, wave.id, new Vector3(0, 0, 0), 0, spawn);
        const modelKey = modelKeyForEnemy(enemy);
        if (!modelKey) fail(`${level.id}/${wave.id}: enemy "${spawn.archetype}" resolved no GLB modelKey`);
        if (!enemyModelAssets[modelKey]) fail(`${level.id}/${wave.id}: enemy "${spawn.archetype}" resolved unknown modelKey "${modelKey}"`);
        used.set(modelKey, (used.get(modelKey) ?? 0) + spawn.count);
      }
    }
  }

  const usedSummary = [...used.entries()].map(([modelKey, count]) => `${modelKey}=${count}`).join(", ");
  console.log(`PASS campaign enemy model resolution spawns=${spawnCount} used=${usedSummary}`);
}

function runtimeAssetPath(url) {
  const cleanUrl = url.split("?")[0];
  const rel = cleanUrl.replace(/^\//, "").replace(/^src\//, "src/");
  const filePath = path.join(gameRoot, rel);
  if (!fs.existsSync(filePath)) fail(`Enemy runtime asset missing: ${url}`);
  return filePath;
}

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  let offset = 12;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    if (chunkType === "JSON") {
      return JSON.parse(buffer.toString("utf8", offset + 8, offset + 8 + chunkLength).replace(/\0+$/g, ""));
    }
    offset += 8 + chunkLength;
  }
  fail(`GLB JSON chunk missing: ${filePath}`);
}

function fail(message) {
  throw new Error(message);
}
