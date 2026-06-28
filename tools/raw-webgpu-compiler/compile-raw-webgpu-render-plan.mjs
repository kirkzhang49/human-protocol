import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createAssetRecord, createInstanceWriter } from "./raw-webgpu-plan-assets.mjs";
import { compileRawGeometryAssets, createGeometryAssetTable } from "./raw-webgpu-plan-geometry.mjs";
import { addConfigDrivenInstances } from "./raw-webgpu-plan-instances.mjs";
import {
  appendOfficialBuilderSurfaceGeometry,
  createOfficialBuilderSurfaceBridge,
  replaceOfficialShellSurfacesWithBuilderSurfaces,
} from "./raw-webgpu-builder-surfaces.mjs";
import {
  createLightPlan,
  createRawLightingProfiles,
} from "./raw-webgpu-plan-lighting.mjs";
import { summarizeRawWebGpuAssetRuleCoverage, summarizeRawWebGpuRuntimeAssetRules } from "./raw-webgpu-render-plan-rules.mjs";
import { writeRawWebGpuAssetSidecars } from "./raw-webgpu-asset-sidecars.mjs";
import {
  clampInteger,
  git,
  hasArg,
  readArg,
  roundNumber,
  roundTuple,
} from "./raw-webgpu-plan-utils.mjs";
import {
  applyRawLightingAlgorithmTuning,
  loadRawLightingAlgorithmTuning,
  loadRawMaterialPipeline,
  loadRawRolePaletteTuning,
  loadRawVisualColorTuning,
  summarizeRawLightingAlgorithmTuning,
  summarizeRawMaterialPipeline,
  summarizeRawRolePaletteTuning,
  summarizeRawVisualColorTuning,
} from "./raw-webgpu-tuning-inputs.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(scriptPath), "../..");
const defaultLevelId = "level_03_human_museum";
const levelId = readArg("--level") ?? defaultLevelId;
const outputDir = path.join(gameRoot, "src/assets/manifests/generated/raw-webgpu");
const outputPath = path.join(outputDir, `render_plan_${levelId}.json`);
const geometryOutputPath = path.join(outputDir, `render_plan_${levelId}_geometry.bin`);
const rawLightingTuningPath = path.join(outputDir, `raw_lighting_algorithm_tuning_${levelId}.json`);
const rawVisualColorTuningPath = path.join(outputDir, `raw_visual_color_tuning_${levelId}.json`);
const rawRolePaletteTuningPath = path.join(outputDir, `raw_role_palette_tuning_${levelId}.json`);
const rawMaterialPipelinePath = path.join(outputDir, `raw_material_pipeline_${levelId}.json`);
const shouldApplyRawLightingTuning =
  !hasArg("--no-raw-lighting-tuning") && process.env.HP_RAW_WEBGPU_APPLY_LIGHTING_TUNING !== "0";
const shouldApplyRawVisualColorTuning =
  !hasArg("--no-raw-visual-color-tuning") && process.env.HP_RAW_WEBGPU_APPLY_VISUAL_COLOR_TUNING !== "0";
const shouldApplyRawRolePaletteTuning =
  !hasArg("--no-raw-role-palette-tuning") && process.env.HP_RAW_WEBGPU_APPLY_ROLE_PALETTE_TUNING !== "0";
const shouldApplyRawMaterialPipeline =
  !hasArg("--no-raw-material-pipeline") && process.env.HP_RAW_WEBGPU_APPLY_MATERIAL_PIPELINE !== "0";
const qualityTiers = ["high", "balanced", "rescue"];
const rawBaseColorTextureSize = clampInteger(Number.parseInt(readArg("--base-color-texture-size") ?? process.env.HP_RAW_WEBGPU_BASE_COLOR_TEXTURE_SIZE ?? "512", 10), 128, 1024);
const rawBaseColorTexturePublicBase = `/assets/human-protocol/raw-webgpu/${levelId}/base-color`;
const rawBaseColorTextureOutputDir = path.join(gameRoot, "public", rawBaseColorTexturePublicBase.replace(/^\//, ""));

const server = await createServer({
  root: gameRoot,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const [
    { GameWorld },
    { humanProtocolBasePack },
    { resolveRoomPresentation, resolveRenderLightPosition, resolveRoomRelativePosition },
    { createPropLocalLights },
    { selectRenderLights, resolveRenderLightPosition: resolveBudgetLightPosition },
    { createRoomWallSegments },
    { captureRenderBudgetSnapshot },
    {
      environmentModelAssets,
      getEnvironmentModelAsset,
      isEnvironmentModelKey,
      modelKeyForDoor,
      modelKeyForInteraction,
      modelKeyForKeyVisual,
      modelKeyForPickupType,
    },
    { enemyModelAssets },
    { isDoorRenderVisible, isRoomRenderVisible },
    { rawViewmodelCookAssets },
    { RAW_VIEWMODEL_HAND_MODEL_KEYS, RAW_VIEWMODEL_MODEL_KEYS, RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS },
    { builderProjectFromBuiltInLevel },
    { compileBuilderRuntimePack },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/core/GameWorld.ts"),
    server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    server.ssrLoadModule("/src/game/config/RoomPresentationRegistry.ts"),
    server.ssrLoadModule("/src/game/config/PropLocalLightRegistry.ts"),
    server.ssrLoadModule("/src/game/core/RenderLightBudget.ts"),
    server.ssrLoadModule("/src/game/config/MapGeometry.ts"),
    server.ssrLoadModule("/src/game/core/RenderBudgetSnapshot.ts"),
    server.ssrLoadModule("/src/assets/environmentModelAssets.ts"),
    server.ssrLoadModule("/src/assets/enemyModelAssets.ts"),
    server.ssrLoadModule("/src/game/core/RenderVisibility.ts"),
    server.ssrLoadModule("/src/assets/rawViewmodelCookAssets.ts"),
    server.ssrLoadModule("/src/render/raw-webgpu/RawViewmodelMode.ts"),
    server.ssrLoadModule("/src/build/BuilderLevelImport.ts"),
    server.ssrLoadModule("/src/build/runtime-pack/compileBuilderRuntimePack.ts"),
  ]);

  if (!humanProtocolBasePack.campaignLevelIds.includes(levelId)) {
    throw new Error(`Level "${levelId}" is not in the Human Protocol campaign pack.`);
  }

  const world = new GameWorld();
  world.loadLevel(levelId, "playing");
  const level = world.level;
  const map = level.map;
  if (!map) throw new Error(`Level "${levelId}" does not have a map config.`);

  const presentation = resolveRoomPresentation(map);
  const assetTable = new Map();
  const instances = [];
  const issues = [];

  const addInstance = createInstanceWriter({
    assetTable,
    environmentModelAssets,
    gameRoot,
    getEnvironmentModelAsset,
    instances,
    issues,
  });

  addConfigDrivenInstances({
    addInstance,
    createRoomWallSegments,
    getEnvironmentModelAsset,
    isEnvironmentModelKey,
    level,
    map,
    modelKeyForDoor,
    modelKeyForInteraction,
    modelKeyForKeyVisual,
    modelKeyForPickupType,
    presentation,
    issues,
  });

  const officialBuilderProject = builderProjectFromBuiltInLevel(levelId);
  const officialBuilderSurfaceBridge = createOfficialBuilderSurfaceBridge({
    compileBuilderRuntimePack,
    level,
    project: officialBuilderProject,
  });
  const officialBuilderSurfaceReplacement = replaceOfficialShellSurfacesWithBuilderSurfaces({
    assetTable,
    bridge: officialBuilderSurfaceBridge,
    instances,
  });

  addRuntimeOnlyEnvironmentAssets({
    assetTable,
    environmentModelAssets,
    gameRoot,
    getEnvironmentModelAsset,
    issues,
    modelKeys: [...Object.values(RAW_VIEWMODEL_MODEL_KEYS), ...Object.values(RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS)],
    source: "raw_viewmodel_environment",
  });
  addRuntimeOnlyHandAssets({
    assetTable,
    gameRoot,
    issues,
    modelKeys: Object.values(RAW_VIEWMODEL_HAND_MODEL_KEYS),
    rawViewmodelCookAssets,
  });

  const batches = createBatches(instances);
  const propLocalLights = createPropLocalLights(map);
  const rawPresentation = presentation;
  const roomGraph = createRoomGraph(map);
  const visibilityScenarios = createVisibilityScenarios({
    captureRenderBudgetSnapshot,
    isDoorRenderVisible,
    isRoomRenderVisible,
    map,
    qualityTiers,
    selectRenderLights,
    extraLights: propLocalLights,
    presentation: rawPresentation,
    resolveLightPosition: resolveBudgetLightPosition ?? resolveRenderLightPosition,
    world,
  });
  const lights = createLightPlan({
    map,
    presentation: rawPresentation,
    extraLights: propLocalLights,
    resolveLightPosition: resolveBudgetLightPosition ?? resolveRenderLightPosition,
    resolveRoomRelativePosition,
  });
  const rawLightingAlgorithmTuning = loadRawLightingAlgorithmTuning({
    enabled: shouldApplyRawLightingTuning,
    gameRoot,
    filePath: rawLightingTuningPath,
  });
  const rawVisualColorTuning = loadRawVisualColorTuning({
    enabled: shouldApplyRawVisualColorTuning,
    gameRoot,
    filePath: rawVisualColorTuningPath,
  });
  const rawRolePaletteTuning = loadRawRolePaletteTuning({
    enabled: shouldApplyRawRolePaletteTuning,
    gameRoot,
    filePath: rawRolePaletteTuningPath,
  });
  const rawMaterialPipeline = loadRawMaterialPipeline({
    enabled: shouldApplyRawMaterialPipeline,
    gameRoot,
    filePath: rawMaterialPipelinePath,
  });
  const lightingProfiles = applyRawLightingAlgorithmTuning(
    createRawLightingProfiles({ map, presentation, lights, visibilityScenarios }),
    rawLightingAlgorithmTuning,
  );
  const geometryAssetTable = createGeometryAssetTable({ assetTable, enemyModelAssets, gameRoot });
  let geometry = await compileRawGeometryAssets({
    assetTable: geometryAssetTable,
    gameRoot,
    levelId,
    outputPath: geometryOutputPath,
    outputFileName: path.basename(geometryOutputPath),
    textureOutputDir: rawBaseColorTextureOutputDir,
    texturePublicBase: rawBaseColorTexturePublicBase,
    textureSize: rawBaseColorTextureSize,
    rolePaletteTuning: rawRolePaletteTuning,
    materialPipeline: rawMaterialPipeline,
  });
  geometry = await appendOfficialBuilderSurfaceGeometry({
    bridge: officialBuilderSurfaceBridge,
    gameRoot,
    geometry,
    geometryOutputPath,
    textureOutputDir: rawBaseColorTextureOutputDir,
    texturePublicBase: rawBaseColorTexturePublicBase,
  });
  const rawArtDirection = null;
  const budgets = createBudgets({ assetTable, batches, instances, map, visibilityScenarios });
  const plan = {
    schemaVersion: "hp.raw-webgpu.render-plan.v1",
    generatedAt: new Date().toISOString(),
    generator: {
      script: "tools/raw-webgpu-compiler/compile-raw-webgpu-render-plan.mjs",
      gitBranch: git("branch --show-current", gameRoot),
      gitCommit: git("rev-parse --short HEAD", gameRoot),
      workingTreeDirty: git("status --short", gameRoot).length > 0,
    },
    intent: {
      backend: "raw-webgpu",
      phase: "compiled-static-level-prototype",
      targetRendererFlag: "?renderer=raw-webgpu",
      notes: [
        "This first plan compiles Human Protocol map config into static render batches.",
        "GLB mesh payloads are summarized here; buffer flattening is the next compiler phase.",
        "Three/R3F remains the default runtime unless the renderer flag is explicitly enabled.",
      ],
    },
    level: {
      id: level.id,
      title: level.title,
      spawnPoint: level.spawnPoint,
      mapId: map.id,
      roomCount: map.rooms.length,
      doorCount: map.doors.length,
    },
    presentation: summarizePresentation(presentation),
    rooms: map.rooms.map((room, index) => ({
      index,
      id: room.id,
      label: room.label,
      bounds: room.bounds,
      mood: room.mood,
      skinKey: room.skinKey ?? null,
      geometry: room.geometry ?? null,
    })),
    roomGraph,
    assets: [...assetTable.values(), ...(officialBuilderSurfaceBridge.assets ?? [])].sort((a, b) => a.modelKey.localeCompare(b.modelKey)),
    instances,
    batches,
    geometry,
    lights,
    lightingProfiles,
    rawLightingAlgorithmTuning: summarizeRawLightingAlgorithmTuning(rawLightingAlgorithmTuning, {
      gameRoot,
      fallbackPath: rawLightingTuningPath,
    }),
    rawVisualColorTuning: summarizeRawVisualColorTuning(rawVisualColorTuning, {
      gameRoot,
      fallbackPath: rawVisualColorTuningPath,
    }),
    rawRolePaletteTuning: summarizeRawRolePaletteTuning(rawRolePaletteTuning, {
      gameRoot,
      fallbackPath: rawRolePaletteTuningPath,
    }),
    officialBuilderSurfaceBridge: {
      enabled: officialBuilderSurfaceBridge.enabled,
      reason: officialBuilderSurfaceBridge.reason,
      roomIds: [...(officialBuilderSurfaceBridge.eligibleRoomIds ?? [])].sort(),
      surfaceAssetKeys: [...(officialBuilderSurfaceBridge.surfaceAssetKeys ?? [])].sort(),
      insertedInstances: officialBuilderSurfaceBridge.instances?.length ?? 0,
      removedShellInstances: officialBuilderSurfaceReplacement.removedInstances,
      prunedShellAssets: officialBuilderSurfaceReplacement.prunedAssets,
    },
    rawMaterialPipeline: summarizeRawMaterialPipeline(rawMaterialPipeline, {
      gameRoot,
      fallbackPath: rawMaterialPipelinePath,
    }),
    runtimeAssetRules: summarizeRawWebGpuRuntimeAssetRules(),
    assetRuleCoverage: summarizeRawWebGpuAssetRuleCoverage(geometryAssetTable.values()),
    rawArtDirection,
    visibilityScenarios,
    budgets,
    issues,
  };

  await fs.mkdir(outputDir, { recursive: true });
  const assetSidecars = await writeRawWebGpuAssetSidecars({ gameRoot, levelId, outputDir, plan });
  await fs.writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log(`PASS raw WebGPU render plan level=${level.id}`);
  console.log(`  output=${path.relative(gameRoot, outputPath)}`);
  console.log(`  assetSidecars=${assetSidecars.count} index=${path.relative(gameRoot, assetSidecars.indexPath)}`);
  console.log(`  instances=${instances.length} batches=${batches.length} assets=${assetTable.size}`);
  console.log(`  geometryVertices=${geometry.vertexCount} geometryTriangles=${geometry.triangleCount} geometryBytes=${geometry.binaryByteLength}`);
  console.log(`  baseColorTextureLayers=${geometry.baseColorTextures.length} baseColorTextureSize=${geometry.baseColorTextureSize}`);
  console.log(`  materialTextureLayers=${geometry.materialTextures.length} materialTextureSize=${geometry.materialTextureSize}`);
  console.log(`  estimatedTriangles=${budgets.estimatedTriangles.total}`);
  console.log(`  issues=${issues.length}`);
} finally {
  await server.close();
}

function addRuntimeOnlyEnvironmentAssets({ assetTable, environmentModelAssets, gameRoot, getEnvironmentModelAsset, issues, modelKeys, source }) {
  for (const modelKey of modelKeys) {
    if (!modelKey || assetTable.has(modelKey)) continue;
    if (!environmentModelAssets[modelKey]) {
      issues.push({
        severity: "error",
        type: "unknown_runtime_model_key",
        source,
        modelKey,
      });
      continue;
    }
    const asset = getEnvironmentModelAsset(modelKey);
    assetTable.set(asset.modelKey, {
      ...createAssetRecord(asset, gameRoot),
      runtimeOnly: true,
      runtimeSource: source,
    });
  }
}

function addRuntimeOnlyHandAssets({ assetTable, gameRoot, issues, modelKeys, rawViewmodelCookAssets }) {
  for (const modelKey of modelKeys) {
    if (!modelKey || assetTable.has(modelKey)) continue;
    const asset = rawViewmodelCookAssets[modelKey];
    if (!asset?.url) {
      issues.push({
        severity: "error",
        type: "unknown_runtime_hand_model_key",
        source: "raw_viewmodel_hand",
        modelKey,
      });
      continue;
    }
    assetTable.set(asset.modelKey, {
      ...createAssetRecord(
        {
          modelKey: asset.modelKey,
          category: "viewmodel",
          url: asset.url,
          sizeMeters: asset.sizeMeters,
        },
        gameRoot,
      ),
      runtimeOnly: true,
      runtimeSource: "raw_viewmodel_hand",
    });
  }
}

function createBatches(instances) {
  const batchMap = new Map();
  for (const instance of instances) {
    const key = [
      instance.modelKey,
      instance.role,
      instance.castShadow ? "cast" : "no-cast",
      instance.receiveShadow ? "receive" : "no-receive",
      instance.visibility.type,
    ].join("|");
    let batch = batchMap.get(key);
    if (!batch) {
      batch = {
        id: `batch:${batchMap.size.toString().padStart(3, "0")}`,
        modelKey: instance.modelKey,
        role: instance.role,
        castShadow: instance.castShadow,
        receiveShadow: instance.receiveShadow,
        visibilityType: instance.visibility.type,
        instanceIds: [],
        roomIds: [],
      };
      batchMap.set(key, batch);
    }
    batch.instanceIds.push(instance.id);
    if (instance.roomId && !batch.roomIds.includes(instance.roomId)) batch.roomIds.push(instance.roomId);
    if (instance.secondaryRoomId && !batch.roomIds.includes(instance.secondaryRoomId)) batch.roomIds.push(instance.secondaryRoomId);
  }
  return [...batchMap.values()].map((batch) => ({
    ...batch,
    instanceCount: batch.instanceIds.length,
    roomIds: batch.roomIds.sort(),
  }));
}

function createRoomGraph(map) {
  return map.rooms.map((room, index) => ({
    index,
    roomId: room.id,
    adjacentRoomIds: map.doors
      .filter((door) => door.fromRoomId === room.id || door.toRoomId === room.id)
      .map((door) => (door.fromRoomId === room.id ? door.toRoomId : door.fromRoomId))
      .filter((roomId, linkedIndex, list) => list.indexOf(roomId) === linkedIndex)
      .sort(),
  }));
}

function createVisibilityScenarios({
  captureRenderBudgetSnapshot,
  isDoorRenderVisible,
  isRoomRenderVisible,
  map,
  qualityTiers,
  selectRenderLights,
  extraLights = [],
  presentation,
  resolveLightPosition,
  world,
}) {
  const scenarios = [];
  const lights = [...(presentation?.lighting?.lights ?? []), ...extraLights];
  for (const tier of qualityTiers) {
    world.renderPerformance.setDiagnosticTier(tier);
    for (const room of map.rooms) {
      world.session.mapProgress.currentRoomId = room.id;
      if (!world.session.mapProgress.visitedRoomIds.includes(room.id)) {
        world.session.mapProgress.visitedRoomIds.push(room.id);
      }
      world.player.position.set(room.bounds.center[0], world.level.spawnPoint[1], room.bounds.center[2]);
      const selectedLights = selectRenderLights(lights, map, world);
      scenarios.push({
        id: `${tier}:${room.id}`,
        qualityTier: tier,
        currentRoomId: room.id,
        snapshot: captureRenderBudgetSnapshot(world),
        visibleRoomIds: map.rooms.filter((candidate) => isRoomRenderVisible(world, candidate.id)).map((candidate) => candidate.id),
        visibleDoorIds: map.doors.filter((door) => isDoorRenderVisible(world, door)).map((door) => door.id),
        selectedLightIds: selectedLights.map((selected) => selected.light.id),
        selectedLights: selectedLights.map((selected) => ({
          id: selected.light.id,
          type: selected.light.type,
          roomId: selected.light.roomId ?? null,
          position: roundTuple(resolveLightPosition(map, selected.light)),
          score: roundNumber(selected.score),
          canCastShadow: selected.canCastShadow,
        })),
      });
    }
  }
  return scenarios;
}
function createBudgets({ assetTable, batches, instances, map, visibilityScenarios }) {
  const assetByModelKey = new Map([...assetTable.values()].map((asset) => [asset.modelKey, asset]));
  const trianglesByRole = {};
  let totalTriangles = 0;
  for (const instance of instances) {
    const triangles = assetByModelKey.get(instance.modelKey)?.glb?.estimatedTriangles ?? 0;
    totalTriangles += triangles;
    trianglesByRole[instance.role] = (trianglesByRole[instance.role] ?? 0) + triangles;
  }
  const maxVisible = visibilityScenarios.reduce(
    (max, scenario) => ({
      rooms: Math.max(max.rooms, scenario.snapshot.visible.rooms),
      doors: Math.max(max.doors, scenario.snapshot.visible.doors),
      props: Math.max(max.props, scenario.snapshot.visible.props),
      dynamicLights: Math.max(max.dynamicLights, scenario.snapshot.visible.dynamicLights),
      floorGlows: Math.max(max.floorGlows, scenario.snapshot.visible.floorGlows),
      shadowLights: Math.max(max.shadowLights, scenario.snapshot.visible.shadowLights),
    }),
    { rooms: 0, doors: 0, props: 0, dynamicLights: 0, floorGlows: 0, shadowLights: 0 },
  );
  return {
    batchCount: batches.length,
    instanceCount: instances.length,
    roomCount: map.rooms.length,
    estimatedDrawCalls: {
      staticBatches: batches.length,
      note: "Raw WebGPU should collapse per-instance React objects into batch-level draw calls; GLB primitive fan-out is tracked in asset records.",
    },
    estimatedTriangles: {
      total: totalTriangles,
      byRole: Object.fromEntries(Object.entries(trianglesByRole).sort(([a], [b]) => a.localeCompare(b))),
      note: "Triangle counts are estimated from GLB index accessor counts before meshopt decode; exact flattened geometry appears in compiler phase 2.",
    },
    maxVisible,
  };
}

function summarizePresentation(presentation) {
  if (!presentation) return null;
  return {
    roomKitId: presentation.roomKitId ?? null,
    shellKitId: presentation.shellKitId ?? null,
    lightingPresetId: presentation.lightingPresetId ?? null,
    doorKitId: presentation.doorKitId ?? null,
    propSetId: presentation.propSetId ?? null,
    spawnLayoutId: presentation.spawnLayoutId ?? null,
    pickupLayoutId: presentation.pickupLayoutId ?? null,
    overrides: presentation.overrides,
    shell: presentation.shell,
    lighting: presentation.lighting
      ? {
          mood: presentation.lighting.mood,
          ambient: presentation.lighting.ambient,
          hemisphereIntensity: presentation.lighting.hemisphereIntensity ?? null,
          directional: presentation.lighting.directional ?? null,
          fog: presentation.lighting.fog,
          bloom: presentation.lighting.bloom,
          shadows: presentation.lighting.shadows,
          lightCount: presentation.lighting.lights.length,
        }
      : null,
  };
}
