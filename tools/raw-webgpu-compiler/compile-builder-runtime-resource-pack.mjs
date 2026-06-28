import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createAssetRecord } from "./raw-webgpu-plan-assets.mjs";
import { compileRawGeometryAssets } from "./raw-webgpu-plan-geometry.mjs";
import { git } from "./raw-webgpu-plan-utils.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(scriptPath), "../..");
const outputDir = path.join(gameRoot, "src/assets/manifests/generated/raw-webgpu");

const server = await createServer({
  root: gameRoot,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const [
    { humanProtocolBasePack },
    { environmentModelAssets },
    { enemyModelAssets },
    { rawViewmodelCookAssets },
    {
      BUILDER_ASSETS_V1_NATIVE_RAW_MODEL_KEYS,
      BUILDER_NATIVE_RAW_RESOURCE_PACK_ID,
      BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS,
      BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS,
      builderWgpuResourceIndexForLevels,
      isBuilderRuntimeProceduralMapped,
    },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    server.ssrLoadModule("/src/assets/environmentModelAssets.ts"),
    server.ssrLoadModule("/src/assets/enemyModelAssets.ts"),
    server.ssrLoadModule("/src/assets/rawViewmodelCookAssets.ts"),
    server.ssrLoadModule("/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts"),
  ]);

  const resourcePackId = BUILDER_NATIVE_RAW_RESOURCE_PACK_ID;
  const outputPath = path.join(outputDir, `render_plan_${resourcePackId}.json`);
  const geometryOutputPath = path.join(outputDir, `render_plan_${resourcePackId}_geometry.bin`);
  const texturePublicBase = `/assets/human-protocol/raw-webgpu/${resourcePackId}/base-color`;
  const textureOutputDir = path.join(gameRoot, "public", texturePublicBase.replace(/^\//, ""));
  const campaignLevels = humanProtocolBasePack.levels.filter((candidate) => humanProtocolBasePack.campaignLevelIds.includes(candidate.id));
  const resourceIndex = builderWgpuResourceIndexForLevels(campaignLevels);
  const officialReadyKeys = readOfficialReadyModelKeys(BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS);
  const assetTable = new Map();
  const issues = [];

  for (const entry of resourceIndex) {
    if (isBuilderRuntimeProceduralMapped(entry)) {
      continue;
    }
    // Builder playtests should not depend on an arbitrary official level being
    // available to source combat-hot runtime geometry. Keep enemies and
    // viewmodel/held utility assets in this resource pack even when official
    // Raw plans also contain them, so /build has a single auditable runtime
    // home for robots, hands, weapons, and skill deployables.
    if (
      !isBuilderRuntimeOwnedSupplemental(entry) &&
      !BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS.has(entry.modelKey) &&
      officialReadyKeys.has(entry.modelKey)
    ) {
      continue;
    }
    if (BUILDER_ASSETS_V1_NATIVE_RAW_MODEL_KEYS.has(entry.modelKey)) {
      continue;
    }
    const record = assetRecordForResource(entry, { enemyModelAssets, environmentModelAssets, gameRoot, rawViewmodelCookAssets });
    if (!record) {
      issues.push({
        severity: "warning",
        type: "builder_runtime_resource_missing_registry_asset",
        modelKey: entry.modelKey,
        role: entry.kind,
      });
      continue;
    }
    assetTable.set(record.modelKey, record);
  }

  const geometry = await compileRawGeometryAssets({
    assetTable,
    gameRoot,
    levelId: resourcePackId,
    outputPath: geometryOutputPath,
    outputFileName: path.basename(geometryOutputPath),
    textureOutputDir,
    texturePublicBase,
    textureSize: 512,
    rolePaletteTuning: null,
    materialPipeline: null,
  });
  const plan = {
    schemaVersion: "hp.raw-webgpu.render-plan.v1",
    generatedAt: new Date().toISOString(),
    generator: {
      script: "tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs",
      gitBranch: git("branch --show-current", gameRoot),
      gitCommit: git("rev-parse --short HEAD", gameRoot),
      workingTreeDirty: git("status --short", gameRoot).length > 0,
    },
    intent: {
      backend: "raw-webgpu",
      phase: "compiled-builder-runtime-resource-pack",
      targetRendererFlag: "?renderer=raw-webgpu",
      notes: [
        "Resource-only pack for /build fast Raw playtests.",
        "Static furniture modelKeys already present in official Raw level packs are reused by modelKey.",
        "Runtime-hot enemies, viewmodels, hands, and skill deployables are included directly for /build playtests.",
      ],
    },
    level: {
      id: resourcePackId,
      title: "Builder Runtime Resources",
      spawnPoint: { position: [0, 0, 0], yaw: 0 },
      mapId: resourcePackId,
      roomCount: 0,
      doorCount: 0,
    },
    presentation: null,
    rooms: [],
    roomGraph: { nodes: [], edges: [] },
    assets: [...assetTable.values()].sort((a, b) => a.modelKey.localeCompare(b.modelKey)),
    instances: [],
    batches: [],
    geometry,
    lights: [],
    lightingProfiles: {},
    rawLightingAlgorithmTuning: null,
    rawVisualColorTuning: null,
    rawRolePaletteTuning: null,
    rawMaterialPipeline: null,
    runtimeAssetRules: null,
    assetRuleCoverage: null,
    rawArtDirection: null,
    visibilityScenarios: [],
    budgets: {
      estimatedTriangles: { total: 0 },
      assetCount: assetTable.size,
      instanceCount: 0,
    },
    issues,
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log(`PASS builder runtime WGPU resource pack id=${resourcePackId}`);
  console.log(`  output=${path.relative(gameRoot, outputPath)}`);
  console.log(`  officialReadyModelKeys=${officialReadyKeys.size}`);
  console.log(`  sourceIndex=${resourceIndex.length} supplementalAssets=${assetTable.size}`);
  console.log(`  geometryVertices=${geometry.vertexCount} geometryTriangles=${geometry.triangleCount} geometryBytes=${geometry.binaryByteLength}`);
  console.log(`  baseColorTextureLayers=${geometry.baseColorTextures.length} baseColorTextureSize=${geometry.baseColorTextureSize}`);
  console.log(`  materialTextureLayers=${geometry.materialTextures.length} materialTextureSize=${geometry.materialTextureSize}`);
  console.log(`  issues=${issues.length}`);
} finally {
  await server.close();
}

function isBuilderRuntimeOwnedSupplemental(entry) {
  return entry.kind === "enemy" || entry.kind === "viewmodel" || entry.kind === "hand" || entry.roles?.includes("viewmodel") || entry.roles?.includes("hand");
}

function readOfficialReadyModelKeys(levelIds) {
  const keys = new Set();
  for (const levelId of levelIds) {
    const planPath = path.join(outputDir, `render_plan_${levelId}.json`);
    if (!fsSync.existsSync(planPath)) continue;
    const plan = JSON.parse(fsSync.readFileSync(planPath, "utf8"));
    const planAssetCategory = new Map((plan.assets ?? []).map((asset) => [asset.modelKey, asset.category]));
    for (const asset of plan.geometry?.assets ?? []) {
      if (asset.status !== "ready" || (asset.vertexCount ?? 0) <= 0) continue;
      if (planAssetCategory.get(asset.modelKey) === "builder-resource") continue;
      keys.add(asset.modelKey);
    }
  }
  return keys;
}

function assetRecordForResource(entry, { enemyModelAssets, environmentModelAssets, gameRoot, rawViewmodelCookAssets }) {
  if (entry.kind === "hand") {
    const asset = rawViewmodelCookAssets[entry.modelKey];
    return asset
      ? createAssetRecord(
          {
            modelKey: asset.modelKey,
            category: "builder-resource",
            url: asset.url,
            sizeMeters: asset.sizeMeters,
          },
          gameRoot,
        )
      : null;
  }
  if (entry.kind === "enemy") {
    const asset = enemyModelAssets[entry.modelKey];
    return asset
      ? createAssetRecord(
          {
            modelKey: asset.modelKey,
            category: "enemy",
            url: asset.url,
            sizeMeters: [1, asset.warmupTargetHeight, 1],
          },
          gameRoot,
        )
      : null;
  }
  const asset = environmentModelAssets[entry.modelKey];
  return asset
    ? createAssetRecord(
        {
          ...asset,
          category: "builder-resource",
        },
        gameRoot,
      )
    : null;
}
