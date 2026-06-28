#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const DEFAULT_REPORT_PATH = join(PKG_ROOT, "src/assets/manifests/generated/raw-webgpu/qa/visual_bake_contract_report.json");
const BUILDER_RESOURCE_PLAN_PATH = join(PKG_ROOT, "src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json");
const DEV_REMAKE_PROJECTS_PATH = join(PKG_ROOT, "src/build/devRemakeProjects.ts");
const MAX_EXIT_FLOOR_GLOW_OPACITY = 0.012;
const FORMAL_OFFICIAL_CAMPAIGN_COUNT = 5;

const args = parseArgs(process.argv.slice(2));
const reportPath = args.report ? resolve(PKG_ROOT, args.report) : DEFAULT_REPORT_PATH;
const focusLevelId = args.level ?? null;

const checks = [];
const findings = [];
const levelReports = [];

const server = await createServer({
  root: PKG_ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

try {
  const modules = await loadRuntimeModules(server);
  const formalLevels = modules.humanProtocolBasePack.campaignLevelIds
    .slice(0, FORMAL_OFFICIAL_CAMPAIGN_COUNT)
    .map((levelId, index) => ({
      ordinal: index + 1,
      levelId,
      trialStem: `rb_l${index + 1}`,
      level: modules.humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId),
    }))
    .filter((entry) => entry.level);

  const levels = focusLevelId
    ? formalLevels.filter((entry) => entry.levelId === focusLevelId)
    : formalLevels;
  if (focusLevelId && levels.length === 0) {
    addFinding("error", "contract.level.unknown", `Requested level ${focusLevelId} is not in the formal official VisualBakeContract set.`, {
      sourceLayers: ["official"],
      requestedLevelId: focusLevelId,
      coveredLevelIds: formalLevels.map((entry) => entry.levelId),
    });
  }

  const builderResourcePlan = readJsonIfExists(BUILDER_RESOURCE_PLAN_PATH);
  const devRemakeProjectsSource = existsSync(DEV_REMAKE_PROJECTS_PATH) ? readFileSync(DEV_REMAKE_PROJECTS_PATH, "utf8") : "";
  const readySources = readReadyWgpuSources(modules, builderResourcePlan);
  const builderResourceReadyByKey = readyGeometryByKey(builderResourcePlan);
  const builderSourceIndex = focusLevelId
    ? dedupeSourceIndex(levels.flatMap((entry) => modules.builderRuntimeAssetIndexForLevel(entry.level)))
    : modules.builderWgpuResourceIndexForLevels(formalLevels.map((entry) => entry.level));

  checkBuilderRuntimeResourceIndex(builderSourceIndex, readySources);
  checkBuilderRuntimeRobotResources(modules.enemyModelAssets, builderResourcePlan, builderResourceReadyByKey);
  checkSkillRuntimeVisualContract(modules, builderSourceIndex, readySources);

  for (const entry of levels) {
    const context = createLevelContext(entry, modules, builderResourcePlan, readySources);
    levelReports.push(context.report);
    checkOfficialRawCoverage(context);
    checkThreejsLosslessBundle(context);
    checkOfficialBuilderImport(context, modules);
    checkTrialJsonDrift(context, modules);
    checkExitRoomContract(context);
    checkLevelFixtures(context, modules, devRemakeProjectsSource);
  }
} finally {
  await server.close();
}

const errors = findings.filter((finding) => finding.severity === "error");
const warnings = findings.filter((finding) => finding.severity === "warning");
const report = {
  schemaVersion: "human-protocol/visual-bake-contract@1",
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 ? "pass" : "fail",
  mode: focusLevelId ? "focused" : "all-formal-official",
  focusLevelId,
  coverage: {
    officialLevelIds: levelReports.map((level) => level.levelId),
    formalOfficialCampaignCount: FORMAL_OFFICIAL_CAMPAIGN_COUNT,
    sourceLayers: ["official", "builder-import", "trial-json", "raw-plan", "runtime-pack"],
  },
  inputs: {
    officialConfig: "src/game/config/ConfigPackStore.ts#humanProtocolBasePack",
    builderImport: "src/build/BuilderLevelImport.ts#builderProjectFromBuiltInLevel",
    builderResourcePlan: relativePath(BUILDER_RESOURCE_PLAN_PATH),
    devRemakeProjects: relativePath(DEV_REMAKE_PROJECTS_PATH),
    rawPlans: Object.fromEntries(levelReports.map((level) => [level.levelId, relativePath(level.inputs.rawPlanPath)])),
    trialBuilderJson: Object.fromEntries(
      levelReports.filter((level) => level.inputs.trialBuilderPath).map((level) => [level.levelId, relativePath(level.inputs.trialBuilderPath)]),
    ),
    trialLevelJson: Object.fromEntries(
      levelReports.filter((level) => level.inputs.trialLevelPath).map((level) => [level.levelId, relativePath(level.inputs.trialLevelPath)]),
    ),
  },
  thresholds: {
    maxExitFloorGlowOpacity: MAX_EXIT_FLOOR_GLOW_OPACITY,
  },
  summary: {
    checks: checks.length,
    errors: errors.length,
    warnings: warnings.length,
  },
  levels: levelReports,
  checks,
  findings,
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (errors.length > 0) {
  console.error(`FAIL VisualBakeContract: ${errors.length} error(s), ${warnings.length} warning(s), report ${relativePath(reportPath)}`);
  for (const finding of errors) {
    console.error(`  - ${finding.code}: ${finding.message}`);
  }
  process.exit(1);
}

console.log(
  `PASS VisualBakeContract: levels=${levelReports.length}, checks=${checks.length}, warnings=${warnings.length}, report ${relativePath(reportPath)}`,
);

async function loadRuntimeModules(viteServer) {
  const [
    { humanProtocolBasePack },
    { builderProjectFromBuiltInLevel },
    { compileBuilderProjectToLevel },
    { validateLevelConfig },
    { auditBuilderOfficialBridge },
    { resolveBuilderBakePlan },
    {
      BUILDER_NATIVE_RAW_RESOURCE_PACK_ID,
      BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS,
      BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS,
      BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS,
      builderRuntimeAssetIndexForLevel,
      builderRuntimeAssetIndexForProject,
      builderWgpuResourceIndexForLevels,
    },
    { compileBuilderRuntimePack },
    {
      modelKeyForDoor,
      modelKeyForInteraction,
      modelKeyForKeyVisual,
      modelKeyForPickupType,
      modelKeyForPuzzleOrbTarget,
    },
    { ultimateAbilityConfig },
    { RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS },
    { enemyModelAssets },
    { devRemakeProjects },
    { normalizeLevelExitRoomReference },
  ] = await Promise.all([
    viteServer.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    viteServer.ssrLoadModule("/src/build/BuilderLevelImport.ts"),
    viteServer.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts"),
    viteServer.ssrLoadModule("/src/game/config/ConfigValidator.ts"),
    viteServer.ssrLoadModule("/src/build/official-bridge/OfficialBridgeAudit.ts"),
    viteServer.ssrLoadModule("/src/build/official-bridge/ResolvedBakePlan.ts"),
    viteServer.ssrLoadModule("/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts"),
    viteServer.ssrLoadModule("/src/build/runtime-pack/compileBuilderRuntimePack.ts"),
    viteServer.ssrLoadModule("/src/assets/environmentModelAssets.ts"),
    viteServer.ssrLoadModule("/src/game/config/ultimateAbilityConfig.ts"),
    viteServer.ssrLoadModule("/src/render/raw-webgpu/RawViewmodelMode.ts"),
    viteServer.ssrLoadModule("/src/assets/enemyModelAssets.ts"),
    viteServer.ssrLoadModule("/src/build/devRemakeProjects.ts"),
    viteServer.ssrLoadModule("/src/game/config/shared/exitRoomReference.ts"),
  ]);
  return {
    humanProtocolBasePack,
    builderProjectFromBuiltInLevel,
    compileBuilderProjectToLevel,
    validateLevelConfig,
    auditBuilderOfficialBridge,
    resolveBuilderBakePlan,
    BUILDER_NATIVE_RAW_RESOURCE_PACK_ID,
    BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS,
    BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS,
    BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS,
    builderRuntimeAssetIndexForLevel,
    builderRuntimeAssetIndexForProject,
    builderWgpuResourceIndexForLevels,
    compileBuilderRuntimePack,
    modelKeyForDoor,
    modelKeyForInteraction,
    modelKeyForKeyVisual,
    modelKeyForPickupType,
    modelKeyForPuzzleOrbTarget,
    ultimateAbilityConfig,
    RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS,
    enemyModelAssets,
    devRemakeProjects,
    normalizeLevelExitRoomReference,
  };
}

function dedupeSourceIndex(entries) {
  const byModelKey = new Map();
  for (const entry of entries) {
    const existing = byModelKey.get(entry.modelKey);
    if (!existing) {
      byModelKey.set(entry.modelKey, entry);
      continue;
    }
    byModelKey.set(entry.modelKey, {
      ...existing,
      roles: [...new Set([...(existing.roles ?? []), ...(entry.roles ?? [])])],
      glbUrl: existing.glbUrl ?? entry.glbUrl,
      nativeRawEligible: existing.nativeRawEligible || entry.nativeRawEligible,
    });
  }
  return [...byModelKey.values()];
}

function createLevelContext(entry, modules, builderResourcePlan, readySources) {
  const { level, ordinal, trialStem } = entry;
  const rawPlanPath = join(PKG_ROOT, `src/assets/manifests/generated/raw-webgpu/render_plan_${level.id}.json`);
  const trialBuilderPath = join(PKG_ROOT, `data/ai/campaign/${trialStem}.builder.json`);
  const trialLevelPath = join(PKG_ROOT, `data/ai/campaign/${trialStem}.level.json`);
  const rawPlan = readJsonIfExists(rawPlanPath);
  const trialBuilder = readJsonIfExists(trialBuilderPath);
  const rawTrialLevel = readJsonIfExists(trialLevelPath);
  const trialLevel = rawTrialLevel ? modules.normalizeLevelExitRoomReference(rawTrialLevel) : null;
  const officialEntries = collectOfficialSemanticEntries(level, modules);
  const rawInstanceKeys = new Set((rawPlan?.instances ?? []).map((instance) => instance.modelKey).filter(Boolean));
  const rawReadyKeys = readyGeometryByKey(rawPlan);
  const context = {
    ordinal,
    trialStem,
    level,
    rawPlan,
    trialBuilder,
    trialLevel,
    builderResourcePlan,
    readySources,
    officialEntries,
    rawInstanceKeys,
    rawReadyKeys,
    report: {
      levelId: level.id,
      title: level.title,
      ordinal,
      inputs: {
        rawPlanPath,
        trialBuilderPath: existsSync(trialBuilderPath) ? trialBuilderPath : null,
        trialLevelPath: existsSync(trialLevelPath) ? trialLevelPath : null,
      },
      counts: {
        officialRooms: level.map?.rooms?.length ?? 0,
        officialDoors: level.map?.doors?.length ?? 0,
        officialSemanticModelKeys: uniqueModelKeys(officialEntries).length,
        rawInstances: rawPlan?.instances?.length ?? 0,
        rawReadyAssets: rawReadyKeys.size,
        trialBuilderRooms: trialBuilder?.rooms?.length ?? null,
        trialBuilderProps: trialBuilder?.props?.length ?? null,
        trialLevelRooms: trialLevel?.map?.rooms?.length ?? null,
        trialLevelProps: trialLevel?.map?.props?.length ?? null,
      },
      drift: {},
    },
  };
  return context;
}

function checkOfficialRawCoverage(context) {
  const { level, rawPlan, officialEntries, rawInstanceKeys, rawReadyKeys } = context;
  if (!rawPlan) {
    recordCheck(`raw:${level.id}:plan_exists`, false, { levelId: level.id, sourceLayers: ["raw-plan"] });
    addFinding("error", "raw.plan.missing", `${level.id} is missing its generated Raw WebGPU render plan.`, {
      levelId: level.id,
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
    });
    return;
  }
  recordCheck(`raw:${level.id}:plan_exists`, true, { levelId: level.id, sourceLayers: ["raw-plan"] });

  const requiredEntries = officialEntries.filter((entry) => entry.modelKey && entry.role !== "robot");
  const requiredKeys = uniqueModelKeys(requiredEntries);
  const missingKeys = requiredKeys.filter((modelKey) => !rawInstanceKeys.has(modelKey) && !rawReadyKeys.has(modelKey));
  context.report.drift.officialToRawMissingModelKeys = missingKeys;
  recordCheck(`raw:${level.id}:official_modelkey_coverage`, missingKeys.length === 0 ? "pass" : "warn", {
    levelId: level.id,
    sourceLayers: ["official", "raw-plan"],
    missing: missingKeys.length,
  });
  if (missingKeys.length > 0) {
    addFinding("warning", "raw.official_modelkey.missing", `${level.id} has official semantic modelKeys not present in its Raw plan.`, {
      levelId: level.id,
      semanticRole: "official-model-key",
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
      missingModelKeys: missingKeys,
      examples: requiredEntries.filter((entry) => missingKeys.includes(entry.modelKey)).slice(0, 12),
    });
  }

  const missingInstanceAssets = (rawPlan.instances ?? []).filter(
    (instance) => instance.modelKey && instance.source !== "procedural-placeholder" && !rawReadyKeys.has(instance.modelKey),
  );
  recordCheck(`raw:${level.id}:instances_have_ready_assets`, missingInstanceAssets.length === 0, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });
  if (missingInstanceAssets.length > 0) {
    addFinding("error", "raw.instance.asset_missing", `${level.id} has baked instances whose modelKey has no ready geometry asset.`, {
      levelId: level.id,
      semanticRole: "raw-instance",
      sourceLayers: ["raw-plan"],
      sourceLayer: "raw-plan",
      instances: missingInstanceAssets.slice(0, 24).map((instance) => ({
        id: instance.id,
        roomId: instance.roomId,
        modelKey: instance.modelKey,
        source: instance.source,
        role: instance.role,
      })),
    });
  }
}

function checkThreejsLosslessBundle(context) {
  const { level, rawPlan } = context;
  const bridgePath = join(PKG_ROOT, `src/assets/manifests/generated/raw-webgpu/raw_threejs_resource_bridge_${level.id}.json`);
  const bridge = readJsonIfExists(bridgePath);
  if (!bridge || !rawPlan) {
    recordCheck(`raw:${level.id}:threejs_lossless_bridge`, "skip", {
      levelId: level.id,
      sourceLayers: ["raw-plan"],
      reason: bridge ? "missing_raw_plan" : "missing_bridge",
    });
    return;
  }

  const shouldHaveBundle = level.id === "level_03_human_museum" || bridge.generator?.options?.writeOutputs === true;
  if (!shouldHaveBundle) {
    recordCheck(`raw:${level.id}:threejs_lossless_bundle`, "skip", {
      levelId: level.id,
      sourceLayers: ["raw-plan"],
      reason: "bridge_audit_only",
    });
    return;
  }

  const renderPlanGlbFiles = new Set(
    (bridge.resources ?? [])
      .filter((resource) => resource.kind === "model" && resource.extension === ".glb")
      .filter((resource) =>
        (resource.usages ?? []).some(
          (usage) => usage.usage === "render-plan-instance" || usage.usage === "render-plan-geometry-asset",
        ),
      )
      .map((resource) => resource.file),
  );
  const compressionByFile = new Map((bridge.compression?.entries ?? []).map((entry) => [entry.file, entry]));
  const missing = [];
  for (const file of renderPlanGlbFiles) {
    const entry = compressionByFile.get(file);
    const sidecars = entry?.sidecars ?? [];
    const originalExists = entry?.originalPublicUrl ? existsSync(publicUrlToFilePath(entry.originalPublicUrl)) : false;
    const sidecarExists = sidecars.some((sidecar) => existsSync(publicUrlToFilePath(sidecar.publicUrl)));
    if (!entry || (!originalExists && !sidecarExists)) {
      missing.push({
        file,
        entryPresent: Boolean(entry),
        sidecarCount: sidecars.length,
      });
    }
  }

  recordCheck(`raw:${level.id}:threejs_lossless_bundle`, missing.length === 0, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
    checkedFiles: renderPlanGlbFiles.size,
    missing: missing.length,
  });
  if (missing.length > 0) {
    addFinding("error", "raw.threejs_lossless_bundle.missing", `${level.id} Raw Three.js lossless bundle is stale or missing render-plan GLB sidecars.`, {
      levelId: level.id,
      semanticRole: "raw-lossless-resource",
      sourceLayers: ["raw-plan"],
      sourceLayer: "raw-plan",
      bridgePath: relativePath(bridgePath),
      outputDir: bridge.compression?.outputDir ?? null,
      missing: missing.slice(0, 24),
    });
  }
}

function checkOfficialBuilderImport(context, modules) {
  const { level } = context;
  const project = modules.builderProjectFromBuiltInLevel(level.id);
  recordCheck(`builder-import:${level.id}:project_exists`, Boolean(project), {
    levelId: level.id,
    sourceLayers: ["official", "builder-import"],
  });
  if (!project) {
    addFinding("error", "builder_import.project.missing", `${level.id} cannot be imported by builderProjectFromBuiltInLevel.`, {
      levelId: level.id,
      sourceLayers: ["official", "builder-import"],
      sourceLayer: "builder-import",
    });
    return;
  }

  const officialRoomIds = (level.map?.rooms ?? []).map((room) => room.id);
  const projectRoomIds = (project.rooms ?? []).map((room) => room.id);
  const officialDoorIds = (level.map?.doors ?? []).map((door) => door.id);
  const projectDoorIds = (project.doors ?? []).map((door) => door.id);
  const officialPropKeys = uniqueStrings((level.map?.props ?? []).map((prop) => prop.modelKey));
  const projectPropKeys = uniqueStrings((project.props ?? []).map((prop) => prop.modelKey));
  const propDiff = diffArrays(officialPropKeys, projectPropKeys);
  context.report.drift.officialToBuilderImportPropModelKeys = propDiff;

  const identityOk = sameArray(officialRoomIds, projectRoomIds) && sameArray(officialDoorIds, projectDoorIds) && propDiff.missing.length === 0 && propDiff.extra.length === 0;
  recordCheck(`builder-import:${level.id}:semantic_identity`, identityOk, {
    levelId: level.id,
    sourceLayers: ["official", "builder-import"],
  });
  if (!identityOk) {
    addFinding("error", "builder_import.semantic_drift", `${level.id} builder official import does not preserve official room/door/prop semantics.`, {
      levelId: level.id,
      semanticRole: "official-import",
      sourceLayers: ["official", "builder-import"],
      sourceLayer: "builder-import",
      roomDiff: diffArrays(officialRoomIds, projectRoomIds),
      doorDiff: diffArrays(officialDoorIds, projectDoorIds),
      propModelKeyDiff: propDiff,
    });
  }

  const compileResult = modules.compileBuilderProjectToLevel(project);
  const compileIssues = compileResult.issues ?? [];
  context.report.drift.builderImportCompileIssues = compileIssues;
  recordCheck(`builder-import:${level.id}:compiles`, compileIssues.length === 0 && Boolean(compileResult.level) ? "pass" : "warn", {
    levelId: level.id,
    sourceLayers: ["builder-import"],
    issueCount: compileIssues.length,
  });
  if (compileIssues.length > 0 || !compileResult.level) {
    addFinding("warning", "builder_import.compile_issue", `${level.id} imports into /build but does not compile cleanly yet.`, {
      levelId: level.id,
      semanticRole: "builder-import-compile",
      sourceLayers: ["official", "builder-import"],
      sourceLayer: "builder-import",
      issues: compileIssues,
    });
    return;
  }

  const validationReport = modules.validateLevelConfig(compileResult.level, { authoringProfile: "generated" });
  const bridgeAudit = modules.auditBuilderOfficialBridge(compileResult.level, project);
  const validationErrors = validationReport.errors ?? [];
  const bridgeErrors = bridgeAudit.errors ?? [];
  recordCheck(`builder-import:${level.id}:generated_level_valid`, validationErrors.length === 0 ? "pass" : "warn", {
    levelId: level.id,
    sourceLayers: ["builder-import"],
    errorCount: validationErrors.length,
  });
  recordCheck(`builder-import:${level.id}:bridge_audit`, bridgeErrors.length === 0 ? "pass" : "warn", {
    levelId: level.id,
    sourceLayers: ["builder-import"],
    errorCount: bridgeErrors.length,
  });
  if (validationErrors.length > 0 || bridgeErrors.length > 0) {
    addFinding("warning", "builder_import.generated_level_drift", `${level.id} imported builder level has generated validation or bridge audit drift.`, {
      levelId: level.id,
      semanticRole: "generated-level",
      sourceLayers: ["official", "builder-import"],
      sourceLayer: "builder-import",
      validationErrors,
      bridgeErrors,
    });
  }

  const assetIndex = modules.builderRuntimeAssetIndexForProject(compileResult.level, project);
  context.report.counts.builderRuntimeAssetIndex = assetIndex.length;
  const runtimePack = modules.compileBuilderRuntimePack(compileResult.level, project, { assetIndex });
  context.report.counts.builderRuntimePackInstances = runtimePack.renderPlan.instances.length;
  checkBuilderRuntimePackExitArtifacts(context, runtimePack);
}

function checkTrialJsonDrift(context, modules) {
  const { level, trialBuilder, trialLevel } = context;
  if (!trialBuilder) {
    recordCheck(`trial-json:${level.id}:builder_exists`, false, { levelId: level.id, sourceLayers: ["trial-json"] });
    addFinding("warning", "trial_json.builder.missing", `${level.id} has no rb_l*.builder.json trial source.`, {
      levelId: level.id,
      sourceLayers: ["official", "trial-json"],
      sourceLayer: "trial-json",
    });
  } else {
    recordCheck(`trial-json:${level.id}:builder_exists`, true, { levelId: level.id, sourceLayers: ["trial-json"] });
    const officialPropKeys = uniqueStrings((level.map?.props ?? []).map((prop) => prop.modelKey));
    const trialPropKeys = uniqueStrings((trialBuilder.props ?? []).map((prop) => prop.modelKey).filter(Boolean));
    const diff = diffArrays(officialPropKeys, trialPropKeys);
    context.report.drift.officialToTrialBuilderPropModelKeys = diff;
    recordCheck(`trial-json:${level.id}:builder_prop_semantics`, diff.missing.length === 0 && diff.extra.length === 0 ? "pass" : "warn", {
      levelId: level.id,
      sourceLayers: ["official", "trial-json"],
      missing: diff.missing.length,
      extra: diff.extra.length,
    });
    if (diff.missing.length > 0 || diff.extra.length > 0) {
      addFinding("warning", "trial_json.builder.prop_modelkey_drift", `${level.id} rb builder JSON prop modelKeys diverge from official config.`, {
        levelId: level.id,
        semanticRole: "prop",
        sourceLayers: ["official", "trial-json"],
        sourceLayer: "trial-json",
        diff,
      });
    }
  }

  if (!trialLevel) {
    recordCheck(`trial-json:${level.id}:level_exists`, false, { levelId: level.id, sourceLayers: ["trial-json"] });
    addFinding("warning", "trial_json.level.missing", `${level.id} has no rb_l*.level.json compiled trial source.`, {
      levelId: level.id,
      sourceLayers: ["official", "trial-json"],
      sourceLayer: "trial-json",
    });
    return;
  }

  recordCheck(`trial-json:${level.id}:level_exists`, true, { levelId: level.id, sourceLayers: ["trial-json"] });
  const officialPropKeys = uniqueStrings((level.map?.props ?? []).map((prop) => prop.modelKey));
  const trialLevelPropKeys = uniqueStrings((trialLevel.map?.props ?? []).map((prop) => prop.modelKey).filter(Boolean));
  const diff = diffArrays(officialPropKeys, trialLevelPropKeys);
  context.report.drift.officialToTrialLevelPropModelKeys = diff;
  recordCheck(`trial-json:${level.id}:level_prop_semantics`, diff.missing.length === 0 && diff.extra.length === 0 ? "pass" : "warn", {
    levelId: level.id,
    sourceLayers: ["official", "trial-json"],
    missing: diff.missing.length,
    extra: diff.extra.length,
  });
  if (diff.missing.length > 0 || diff.extra.length > 0) {
    addFinding("warning", "trial_json.level.prop_modelkey_drift", `${level.id} rb level JSON prop modelKeys diverge from official config.`, {
      levelId: level.id,
      semanticRole: "prop",
      sourceLayers: ["official", "trial-json"],
      sourceLayer: "trial-json",
      diff,
    });
  }

  if (trialBuilder) checkTrialHostedPuzzleInteractions(context, modules);
}

function checkTrialHostedPuzzleInteractions(context, modules) {
  const { level, trialBuilder } = context;
  const hostedPuzzles = (trialBuilder.puzzles ?? []).filter((puzzle) => puzzle.sourceInteraction?.hostPropId);
  recordCheck(`trial-json:${level.id}:hosted_puzzle_sources`, true, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
    hostedCount: hostedPuzzles.length,
  });
  if (hostedPuzzles.length === 0) return;

  const trialPropIds = new Set((trialBuilder.props ?? []).map((prop) => prop.id));
  const missingHostProps = hostedPuzzles
    .map((puzzle) => ({ puzzleId: puzzle.id, hostPropId: puzzle.sourceInteraction?.hostPropId }))
    .filter((entry) => !trialPropIds.has(entry.hostPropId));
  recordCheck(`trial-json:${level.id}:hosted_puzzle_props_exist`, missingHostProps.length === 0, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
    missing: missingHostProps.length,
  });
  if (missingHostProps.length > 0) {
    addFinding("error", "trial_json.hosted_puzzle.missing_prop", `${level.id} hosted trial puzzle references missing host props.`, {
      levelId: level.id,
      semanticRole: "hosted-puzzle",
      sourceLayers: ["trial-json"],
      sourceLayer: "trial-json",
      missingHostProps,
    });
    return;
  }

  const compileResult = modules.compileBuilderProjectToLevel(trialBuilder);
  if ((compileResult.issues ?? []).length > 0 || !compileResult.level) {
    recordCheck(`trial-json:${level.id}:hosted_puzzle_compile`, "warn", {
      levelId: level.id,
      sourceLayers: ["trial-json"],
      issueCount: compileResult.issues?.length ?? 0,
    });
    return;
  }

  const compiledInteractions = new Map((compileResult.level.map?.interactions ?? []).map((interaction) => [interaction.id, interaction]));
  const compiledPuzzles = new Map((compileResult.level.puzzles ?? []).map((puzzle) => [puzzle.id, puzzle]));
  const assetIndex = modules.builderRuntimeAssetIndexForProject(compileResult.level, trialBuilder);
  const runtimePack = modules.compileBuilderRuntimePack(compileResult.level, trialBuilder, { assetIndex });
  const runtimeInstanceIds = new Set((runtimePack.renderPlan.instances ?? []).map((instance) => instance.id));
  const runtimeLightIds = new Set((runtimePack.renderPlan.lights ?? []).map((light) => light.id));

  const badHosted = [];
  for (const hosted of hostedPuzzles) {
    const compiledPuzzle = compiledPuzzles.get(hosted.id);
    const interactionId = compiledPuzzle
      ? compiledPuzzle.type === "hit_sequence"
        ? compiledPuzzle.clue?.interactionId
        : "interactionId" in compiledPuzzle
        ? compiledPuzzle.interactionId
        : null
      : hosted.interactionId ?? `pz_${hosted.linkedDoorId}_panel`;
    const interaction = interactionId ? compiledInteractions.get(interactionId) : null;
    const expectedHostPropId = hosted.sourceInteraction?.hostPropId;
    const standaloneInstanceId = interactionId ? `terminal_${interactionId}` : null;
    const standaloneLightId = interactionId ? `light_puzzle_${interactionId}` : null;
    if (
      !interaction ||
      interaction.visualKey !== "none" ||
      interaction.anchorPropId !== expectedHostPropId ||
      (standaloneInstanceId && runtimeInstanceIds.has(standaloneInstanceId)) ||
      (standaloneLightId && runtimeLightIds.has(standaloneLightId))
    ) {
      badHosted.push({
        puzzleId: hosted.id,
        interactionId,
        expectedHostPropId,
        visualKey: interaction?.visualKey ?? null,
        anchorPropId: interaction?.anchorPropId ?? null,
        standaloneInstanceId,
        standaloneInstancePresent: standaloneInstanceId ? runtimeInstanceIds.has(standaloneInstanceId) : false,
        standaloneLightPresent: standaloneLightId ? runtimeLightIds.has(standaloneLightId) : false,
      });
    }
  }

  recordCheck(`trial-json:${level.id}:hosted_puzzle_no_standalone_console`, badHosted.length === 0, {
    levelId: level.id,
    sourceLayers: ["trial-json", "runtime-pack"],
    badHosted: badHosted.length,
  });
  if (badHosted.length > 0) {
    addFinding("error", "trial_json.hosted_puzzle.standalone_console", `${level.id} hosted trial puzzle baked a standalone puzzle console over its prop.`, {
      levelId: level.id,
      semanticRole: "hosted-puzzle",
      sourceLayers: ["trial-json", "runtime-pack"],
      sourceLayer: "runtime-pack",
      badHosted,
    });
  }
}

function checkExitRoomContract(context) {
  const { level, rawPlan, trialBuilder, trialLevel } = context;
  const exitRoomId = exitRoomIdForLevel(level);
  recordCheck(`exit:${level.id}:room_resolved`, Boolean(exitRoomId), {
    levelId: level.id,
    sourceLayers: ["official"],
  });
  if (!exitRoomId || !rawPlan) return;

  const declaredExitModelKeys = collectDeclaredExitModelKeys(level, exitRoomId, context);
  const hiddenFixtureInstances = (rawPlan.instances ?? []).filter((instance) => {
    if (instance.roomId !== exitRoomId) return false;
    if (!isSuspiciousExitFixtureModelKey(instance.modelKey)) return false;
    if (declaredExitModelKeys.has(instance.modelKey)) return false;
    return instance.source !== "map.props" && instance.source !== "map.interactions" && instance.source !== "map.doors";
  });
  recordCheck(`exit:${level.id}:no_hidden_fixture_geometry`, hiddenFixtureInstances.length === 0, {
    levelId: level.id,
    sourceLayers: ["official", "raw-plan"],
  });
  if (hiddenFixtureInstances.length > 0) {
    addFinding("error", "exit.hidden_fixture_geometry", `${level.id} exit room has undeclared fixture geometry in the Raw plan.`, {
      levelId: level.id,
      semanticRole: "exit-room-fixture",
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
      exitRoomId,
      instances: hiddenFixtureInstances.map(publicInstance),
    });
  }

  const visibleExitFloorGlows = (rawPlan.lights ?? []).filter(
    (light) => light.roomId === exitRoomId && light.type === "floor_glow" && floorGlowOpacity(light) > MAX_EXIT_FLOOR_GLOW_OPACITY,
  );
  recordCheck(`exit:${level.id}:floor_glow_opacity`, visibleExitFloorGlows.length === 0, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });
  if (visibleExitFloorGlows.length > 0) {
    addFinding("error", "exit.floor_glow.visible", `${level.id} exit room has high-opacity floor_glow lighting.`, {
      levelId: level.id,
      semanticRole: "exit-room-floor-glow",
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
      exitRoomId,
      lights: visibleExitFloorGlows.map((light) => ({
        id: light.id,
        opacity: floorGlowOpacity(light),
        semanticRole: light.semanticRole ?? null,
      })),
    });
  }

  const duplicatePads = (rawPlan.instances ?? []).filter(
    (instance) => instance.roomId === exitRoomId && (instance.id === `exit_${level.exit?.id}` || /^exit_panel_/.test(instance.id)),
  );
  const duplicatePadLights = (rawPlan.lights ?? []).filter(
    (light) => light.roomId === exitRoomId && (light.semanticRole === "builder_exit" || light.id === `light_exit_${level.exit?.id}`),
  );
  recordCheck(`exit:${level.id}:no_duplicate_pad`, duplicatePads.length === 0 && duplicatePadLights.length === 0, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });
  if (duplicatePads.length > 0 || duplicatePadLights.length > 0) {
    addFinding("error", "exit.duplicate_pad", `${level.id} exit interaction synthesized a duplicate pad/panel/floor glow.`, {
      levelId: level.id,
      semanticRole: "exit-pad",
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
      exitRoomId,
      instances: duplicatePads.map(publicInstance),
      lights: duplicatePadLights.map((light) => light.id),
    });
  }

  if (trialBuilder) checkTrialExitFixtures(context, trialBuilder, "builder");
  if (trialLevel) checkTrialExitFixtures(context, trialLevel, "level");
}

function checkTrialExitFixtures(context, trial, kind) {
  const { level } = context;
  const forbidden = ["light_residential_lamp_warm"];
  const exitRoomIds = new Set(
    [
      trial.exitRoomId,
      trial.exit?.roomId,
      ...(trial.rooms ?? []).filter((room) => room.style === "exit").map((room) => room.id),
      ...(trial.map?.rooms ?? []).filter((room) => room.aesthetic?.style === "exit").map((room) => room.id),
    ].filter(Boolean),
  );
  const props = kind === "builder" ? trial.props ?? [] : trial.map?.props ?? [];
  const badProps = props.filter((prop) => exitRoomIds.has(prop.roomId) && forbidden.includes(prop.modelKey));
  recordCheck(`trial-json:${level.id}:${kind}_exit_no_auto_lamp`, badProps.length === 0, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  if (badProps.length > 0) {
    addFinding("error", "trial_json.exit.auto_lamp", `${level.id} ${kind} trial exit room contains generated residential lamp props.`, {
      levelId: level.id,
      semanticRole: "exit-room-fixture",
      sourceLayers: ["trial-json"],
      sourceLayer: "trial-json",
      props: badProps.map((prop) => ({ id: prop.id, roomId: prop.roomId, modelKey: prop.modelKey })),
    });
  }
}

function checkBuilderRuntimePackExitArtifacts(context, runtimePack) {
  const { level } = context;
  const exitRoomId = exitRoomIdForLevel(runtimePack.renderPlan.level ? { ...level, id: runtimePack.renderPlan.level.id } : level) ?? exitRoomIdForLevel(level);
  const forbiddenInstanceIds = new Set([
    "prop_builder_exit_elevator_button_panel",
    "prop_builder_exit_elevator_ceiling_light_front",
    "prop_builder_exit_elevator_ceiling_light_back",
    `exit_${level.exit?.id}`,
    `exit_panel_${level.exit?.id}`,
  ]);
  const badInstances = runtimePack.renderPlan.instances.filter((instance) => forbiddenInstanceIds.has(instance.id));
  const badLights = runtimePack.renderPlan.lights.filter((light) => light.semanticRole === "builder_exit");
  recordCheck(`runtime-pack:${level.id}:no_duplicate_exit_artifacts`, badInstances.length === 0 && badLights.length === 0, {
    levelId: level.id,
    sourceLayers: ["builder-import", "runtime-pack"],
  });
  if (badInstances.length > 0 || badLights.length > 0) {
    addFinding("error", "runtime_pack.exit.duplicate_artifact", `${level.id} builder runtime pack synthesized duplicate exit pad/fixture artifacts.`, {
      levelId: level.id,
      semanticRole: "exit-room-fixture",
      sourceLayers: ["builder-import", "runtime-pack"],
      sourceLayer: "runtime-pack",
      exitRoomId,
      instances: badInstances.map(publicInstance),
      lights: badLights.map((light) => light.id),
    });
  }
}

function checkLevelFixtures(context, modules, devRemakeProjectsSource) {
  if (context.level.id !== "level_03_human_museum") return;
  checkLevel3HeroExhibits(context);
  checkLevel3SurfaceRuntimeContract(context);
  checkLevel3RouteConsole(context);
  checkLevel3DevRemakeHostedToolPuzzle(context, modules);
  checkLevel3ExitKit(context, devRemakeProjectsSource);
}

function checkLevel3HeroExhibits(context) {
  const { rawPlan, trialBuilder, level, readySources } = context;
  const expected = [
    {
      label: "tool vitrine",
      modelKey: "room_museum_last_human_tool_vitrine",
      rawInstanceId: "prop:level_03_tool_last_human_tool_vitrine",
      trialPropId: "level_03_tool_last_human_tool_vitrine",
    },
    {
      label: "voice archive case",
      modelKey: "room_museum_voice_archive_case",
      rawInstanceId: "prop:level_03_voice_archive_case_asset",
      trialPropId: "level_03_voice_archive_case_asset",
    },
    {
      label: "body skeleton vitrine",
      modelKey: "room_museum_skeleton_vitrine",
      rawInstanceId: "prop:level_03_body_skeleton_vitrine_asset",
      trialPropId: "level_03_body_skeleton_vitrine_asset",
    },
  ];
  const rawInstances = rawPlan?.instances ?? [];
  const trialProps = collectObjects(trialBuilder).filter((entry) => entry && typeof entry === "object" && "modelKey" in entry);
  for (const item of expected) {
    const rawMatches = rawInstances.filter((instance) => instance.modelKey === item.modelKey);
    const trialMatches = trialProps.filter((prop) => prop.modelKey === item.modelKey);
    const supplementalReady = readySources.supplementalReadyKeys.has(item.modelKey);
    const allowedTrialPropIds = level3TrialAliasIds(item.trialPropId);
    const trialIdOk = trialMatches.length === 1 && allowedTrialPropIds.includes(trialMatches[0]?.id);
    const ok =
      rawMatches.length === 1 &&
      rawMatches[0]?.id === item.rawInstanceId &&
      trialIdOk &&
      supplementalReady;
    recordCheck(`fixture:${level.id}:hero:${item.label}`, ok, {
      levelId: level.id,
      sourceLayers: ["official", "trial-json", "raw-plan", "runtime-pack"],
    });
    if (!ok) {
      addFinding("error", "level3.hero_exhibit.contract", `${item.modelKey} must appear once in Level 3 official Raw/trial data and be ready in builder_runtime_resources.`, {
        levelId: level.id,
        semanticRole: "hero-prop",
        sourceLayers: ["official", "trial-json", "raw-plan", "runtime-pack"],
        modelKey: item.modelKey,
        rawInstances: rawMatches.map((instance) => instance.id),
        trialProps: trialMatches.map((prop) => prop.id),
        supplementalReady,
        readySources: readySources.readyByKey.get(item.modelKey) ?? [],
        expectedRawInstanceId: item.rawInstanceId,
        expectedTrialPropId: item.trialPropId,
        allowedTrialPropIds,
      });
    }
  }
}

function level3TrialAliasIds(officialId) {
  return [...new Set([officialId, String(officialId).replace(/^level_03/u, "rb_l3")])];
}

function checkLevel3RouteConsole(context) {
  const { rawPlan, level } = context;
  const routeInstances = (rawPlan?.instances ?? []).filter((instance) => instance.modelKey === "builder_route_switch_console");
  const routePanel = routeInstances.find((instance) => instance.id === "interaction:route_route_z43akm_panel");
  recordCheck(`fixture:${level.id}:route_console_instance`, routeInstances.length === 1 && Boolean(routePanel), {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });
  if (routeInstances.length !== 1 || !routePanel) {
    addFinding("error", "level3.route_console.instance", "Level 3 route switch must bake as one builder_route_switch_console interaction.", {
      levelId: level.id,
      semanticRole: "route-console",
      sourceLayers: ["official", "raw-plan"],
      instances: routeInstances.map(publicInstance),
    });
  }

  for (const materialName of ["route_parts_lit", "route_parts_flat"]) {
    const material = (rawPlan?.geometry?.materials ?? []).find((candidate) => candidate.name === materialName);
    const base = material?.baseColorFactor ?? null;
    const pureWhite = Array.isArray(base) && base.slice(0, 3).every((channel) => channel >= 0.96);
    const chroma = Array.isArray(base) ? Math.max(...base.slice(0, 3)) - Math.min(...base.slice(0, 3)) : 0;
    const ok = Boolean(material) && !pureWhite && chroma >= 0.08;
    recordCheck(`fixture:${level.id}:route_material:${materialName}`, ok, {
      levelId: level.id,
      sourceLayers: ["raw-plan"],
    });
    if (!ok) {
      addFinding("error", "level3.route_console.material", `${materialName} must preserve a colored route-console material.`, {
        levelId: level.id,
        semanticRole: "route-console-material",
        sourceLayers: ["raw-plan"],
        sourceLayer: "raw-plan",
        materialName,
        baseColorFactor: base,
        visualRole: material?.visualRole ?? null,
      });
    }
  }
}

function checkLevel3SurfaceRuntimeContract(context) {
  const { level, rawPlan } = context;
  const oldHeroFloorToken = "level03_image2_full_room_human_museum_gallery_floor";
  const bridgePath = join(PKG_ROOT, `src/assets/manifests/generated/raw-webgpu/raw_threejs_resource_bridge_${level.id}.json`);
  const textFiles = [
    "src/render/environment/ConfiguredRoomShell.tsx",
    "src/render/raw-webgpu/RawWebGpuLevelRenderer.ts",
    "scripts/asset-build/prepare-level03-threejs-raw-assets.mjs",
    relativePath(bridgePath),
  ].map((file) => join(PKG_ROOT, file));
  const legacyReferences = textFiles
    .filter((file) => existsSync(file))
    .filter((file) => readFileSync(file, "utf8").includes(oldHeroFloorToken))
    .map(relativePath);

  recordCheck(`fixture:${level.id}:surface_no_legacy_hero_floor`, legacyReferences.length === 0, {
    levelId: level.id,
    sourceLayers: ["raw-plan", "runtime-pack"],
  });
  if (legacyReferences.length > 0 || JSON.stringify(rawPlan ?? {}).includes(oldHeroFloorToken)) {
    addFinding("error", "level3.surface.legacy_hero_floor", "Level 3 official runtime must not keep the old full-room hero floor texture after the museum shell v6 surface update.", {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: ["official", "raw-plan", "runtime-pack"],
      sourceLayer: "runtime-pack",
      legacyToken: oldHeroFloorToken,
      files: legacyReferences,
      rawPlanContainsLegacyToken: JSON.stringify(rawPlan ?? {}).includes(oldHeroFloorToken),
    });
  }

  const rawPlanText = JSON.stringify(rawPlan ?? {});
  const builderEnvironment = level.authoringMetadata?.builderEnvironment ?? {};
  const roomEntries = Object.entries(builderEnvironment.rooms ?? {}).filter(([, env]) => env?.floorPresetId === "floor_photo_marble");
  const surfaceOverrideRoomEntries = roomEntries.filter(([, env]) => hasSurfaceOverride(env));
  const expectsBridge = surfaceOverrideRoomEntries.length > 0;
  const officialBuilderSurfaceBridge = rawPlan?.officialBuilderSurfaceBridge ?? null;
  const bridgeEnabled = officialBuilderSurfaceBridge?.enabled === true;
  recordCheck(`fixture:${level.id}:official_builder_surface_bridge`, expectsBridge ? bridgeEnabled : !bridgeEnabled, {
    levelId: level.id,
    sourceLayers: ["official", "raw-plan"],
    rooms: roomEntries.length,
    surfaceOverrideRooms: surfaceOverrideRoomEntries.length,
  });
  if (expectsBridge && !bridgeEnabled) {
    addFinding("error", "level3.surface.bridge_disabled", "Level 3 official Raw plan must use the builder surface bridge when official metadata carries explicit builder surface overrides.", {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
      officialBuilderSurfaceBridge,
    });
  }
  if (!expectsBridge && bridgeEnabled) {
    addFinding("error", "level3.surface.bridge_unexpected", "Level 3 official Raw plan replaced curated official shell geometry even though no surface override was explicit.", {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
      officialBuilderSurfaceBridge,
    });
  }

  const staleShellInstances = (rawPlan?.instances ?? []).filter(
    (instance) =>
      surfaceOverrideRoomEntries.some(([roomId]) => roomId === instance.roomId) &&
      instance.source === "shell" &&
      (instance.role === "floor" || instance.role === "wall" || instance.role === "ceiling"),
  );
  recordCheck(`fixture:${level.id}:surface_no_stale_shell_instances`, expectsBridge ? staleShellInstances.length === 0 : "skip", {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
    staleShellInstances: staleShellInstances.length,
  });
  if (expectsBridge && staleShellInstances.length > 0) {
    addFinding("error", "level3.surface.stale_shell_instances", "Level 3 official Raw plan still contains old shell floor/wall/ceiling instances for builder-overridden rooms.", {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
      instances: staleShellInstances.slice(0, 18).map(publicInstance),
    });
  }

  const officialDoorInstances = (rawPlan?.instances ?? []).filter((instance) => instance.modelKey === "age_museum_gallery_door");
  const officialExitDoorInstances = (rawPlan?.instances ?? []).filter((instance) => instance.modelKey === "door_service_elevator_inner_cyan");
  const doorOk = officialDoorInstances.length >= 6 && officialExitDoorInstances.length >= 1;
  recordCheck(`fixture:${level.id}:surface_preserve_official_doors`, doorOk, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
    officialDoorInstances: officialDoorInstances.length,
    officialExitDoorInstances: officialExitDoorInstances.length,
  });
  if (!doorOk) {
    addFinding("error", "level3.surface.official_doors_missing", "Level 3 official Raw plan must preserve curated official door models while builder surfaces replace walls, floors, and ceilings.", {
      levelId: level.id,
      semanticRole: "door",
      sourceLayers: ["official", "raw-plan"],
      sourceLayer: "raw-plan",
      officialDoorInstances: officialDoorInstances.slice(0, 18).map(publicInstance),
      officialExitDoorInstances: officialExitDoorInstances.slice(0, 18).map(publicInstance),
    });
  }

  const surfaceTargets = [
    {
      slot: "floor",
      presetId: "floor_photo_marble",
      textureToken: "white_marble_color.webp",
      modelKeyPrefix: "builder:floor:",
    },
    {
      slot: "wall",
      presetId: "wall_hp_museum_limestone_panel",
      textureToken: "hp_wall_museum_limestone_panel_color.webp",
      modelKeyPrefix: "builder:walls:",
    },
    {
      slot: "ceiling",
      presetId: "ceiling_hp_museum_coffered_limestone",
      textureToken: "hp_ceiling_museum_coffered_limestone_color.webp",
      modelKeyPrefix: "builder:ceiling:",
    },
  ];
  for (const surface of surfaceTargets) {
    const surfaceRoomEntries = expectsBridge ? surfaceOverrideRoomEntries : roomEntries;
    const officialDrift = surfaceRoomEntries
      .filter(([, env]) => env?.[`${surface.slot}PresetId`] !== surface.presetId || env?.surfaceOverrides?.[surface.slot]?.presetId !== surface.presetId)
      .map(([roomId, env]) => ({
        roomId,
        presetId: env?.[`${surface.slot}PresetId`] ?? null,
        overridePresetId: env?.surfaceOverrides?.[surface.slot]?.presetId ?? null,
      }));
    const trialBuilderDrift = surfacePresetDrift(context.trialBuilder?.rooms, roomEntries, surface);
    const trialLevelDrift = surfacePresetDriftFromAuthoringMetadata(context.trialLevel, roomEntries, surface);
    const trialBuilderMetadataAbsent = trialSurfaceMetadataIsAbsent(trialBuilderDrift, context.trialBuilder?.rooms);
    const trialLevelMetadataAbsent = trialLevelSurfaceMetadataIsAbsent(trialLevelDrift, context.trialLevel);
    const blockingTrialBuilderDrift = trialBuilderMetadataAbsent ? [] : trialBuilderDrift;
    const blockingTrialLevelDrift = trialLevelMetadataAbsent ? [] : trialLevelDrift;
    const rawTextureOk = (rawPlan?.geometry?.baseColorTextures ?? []).some(
      (texture) =>
        String(texture.url ?? "").includes(surface.textureToken) ||
        String(texture.sourceFile ?? "").includes(surface.textureToken) ||
        String(texture.name ?? "").includes(surface.presetId),
    );
    const missingRawRooms = surfaceOverrideRoomEntries
      .map(([roomId]) => roomId)
      .filter((roomId) => !(rawPlan?.instances ?? []).some((instance) => instance.modelKey === `${surface.modelKeyPrefix}${roomId}`));
    const ok =
      officialDrift.length === 0 &&
      blockingTrialBuilderDrift.length === 0 &&
      blockingTrialLevelDrift.length === 0 &&
      (!expectsBridge || (rawTextureOk && missingRawRooms.length === 0));
    recordCheck(`fixture:${level.id}:surface_contract:${surface.slot}`, ok, {
      levelId: level.id,
      sourceLayers: ["official", "builder-import", "trial-json", "raw-plan", "runtime-pack"],
      rooms: surfaceRoomEntries.length,
      surfaceOverrideRooms: surfaceOverrideRoomEntries.length,
      officialDrift: officialDrift.length,
      trialBuilderDrift: trialBuilderDrift.length,
      trialLevelDrift: trialLevelDrift.length,
      blockingTrialBuilderDrift: blockingTrialBuilderDrift.length,
      blockingTrialLevelDrift: blockingTrialLevelDrift.length,
      trialBuilderMetadataAbsent,
      trialLevelMetadataAbsent,
      missingRawRooms: missingRawRooms.length,
      rawTextureOk,
    });
    if (!ok) {
      addFinding("error", "level3.surface.contract_drift", `Level 3 ${surface.slot} surface must match official builder presets across official config, trial JSON, and Raw plan.`, {
        levelId: level.id,
        semanticRole: "room-surface",
        sourceLayers: ["official", "builder-import", "trial-json", "raw-plan", "runtime-pack"],
        sourceLayer: "raw-plan",
        slot: surface.slot,
        presetId: surface.presetId,
        textureToken: surface.textureToken,
        officialDrift,
        trialBuilderDrift: blockingTrialBuilderDrift,
        trialLevelDrift: blockingTrialLevelDrift,
        nonBlockingTrialBuilderDrift: trialBuilderMetadataAbsent ? trialBuilderDrift : [],
        nonBlockingTrialLevelDrift: trialLevelMetadataAbsent ? trialLevelDrift : [],
        rawTextureOk,
        missingRawRooms,
      });
    }
    if (trialBuilderMetadataAbsent || trialLevelMetadataAbsent) {
      addFinding("warning", "level3.surface.trial_metadata_missing", `Level 3 ${surface.slot} surface is correct in official/Raw, but the imported rb_l3 trial JSON does not carry explicit surface preset metadata.`, {
        levelId: level.id,
        semanticRole: "room-surface",
        sourceLayers: ["builder-import", "trial-json"],
        slot: surface.slot,
        presetId: surface.presetId,
        trialBuilderDrift: trialBuilderMetadataAbsent ? trialBuilderDrift : [],
        trialLevelDrift: trialLevelMetadataAbsent ? trialLevelDrift : [],
      });
    }
  }

  for (const legacyToken of [
    "level03_image2_museum_floor_premium_stone_skin_v6",
    "level03_image2_museum_black_gallery_wall_skin_v6",
    "level03_image2_museum_ceiling_warm_panel_skin_v6",
  ]) {
    const ok = expectsBridge ? !rawPlanText.includes(legacyToken) : "skip";
    recordCheck(`fixture:${level.id}:surface_no_legacy_token:${legacyToken}`, ok, {
      levelId: level.id,
      sourceLayers: ["raw-plan"],
    });
    if (expectsBridge && !ok) {
      addFinding("error", "level3.surface.legacy_shell_token", `Level 3 official Raw plan still references legacy shell surface token ${legacyToken}.`, {
        levelId: level.id,
        semanticRole: "room-surface",
        sourceLayers: ["raw-plan"],
        sourceLayer: "raw-plan",
        legacyToken,
      });
    }
  }
}

function hasSurfaceOverride(env) {
  return ["floor", "wall", "ceiling"].some((slot) => Boolean(env?.surfaceOverrides?.[slot]?.presetId));
}

function surfacePresetDrift(rooms, officialRoomEntries, surface) {
  if (!Array.isArray(rooms)) return [];
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  return officialRoomEntries
    .map(([roomId]) => {
      const env = roomsById.get(roomId)?.env;
      if (env?.[`${surface.slot}PresetId`] === surface.presetId && env?.surfaceOverrides?.[surface.slot]?.presetId === surface.presetId) return null;
      return {
        roomId,
        presetId: env?.[`${surface.slot}PresetId`] ?? null,
        overridePresetId: env?.surfaceOverrides?.[surface.slot]?.presetId ?? null,
      };
    })
    .filter(Boolean);
}

function surfacePresetDriftFromAuthoringMetadata(level, officialRoomEntries, surface) {
  const rooms = level?.authoringMetadata?.builderEnvironment?.rooms;
  if (!rooms) return [];
  return officialRoomEntries
    .map(([roomId]) => {
      const env = rooms[roomId];
      if (env?.[`${surface.slot}PresetId`] === surface.presetId && env?.surfaceOverrides?.[surface.slot]?.presetId === surface.presetId) return null;
      return {
        roomId,
        presetId: env?.[`${surface.slot}PresetId`] ?? null,
        overridePresetId: env?.surfaceOverrides?.[surface.slot]?.presetId ?? null,
      };
    })
    .filter(Boolean);
}

function trialSurfaceMetadataIsAbsent(drift, rooms) {
  return (
    drift.length > 0 &&
    Array.isArray(rooms) &&
    rooms.some((room) => /^rb_l3_/u.test(String(room?.id ?? ""))) &&
    drift.every((entry) => entry.presetId === null && entry.overridePresetId === null)
  );
}

function trialLevelSurfaceMetadataIsAbsent(drift, level) {
  const rooms = level?.map?.rooms ?? [];
  return (
    drift.length > 0 &&
    Array.isArray(rooms) &&
    rooms.some((room) => /^rb_l3_/u.test(String(room?.id ?? ""))) &&
    drift.every((entry) => entry.presetId === null && entry.overridePresetId === null)
  );
}

function checkLevel3DevRemakeHostedToolPuzzle(context, modules) {
  const { level } = context;
  const project = modules.devRemakeProjects?.find((entry) => entry.id === "rb_l3")?.project ?? null;
  const hostProp =
    project?.props?.find((candidate) => candidate.id === "level_03_tool_last_human_tool_vitrine") ??
    project?.props?.find((candidate) => candidate.id === "rb_l3_tool_last_human_tool_vitrine") ??
    null;
  const puzzle =
    project?.puzzles?.find((candidate) => candidate.id === "level_03_tool_calibration") ??
    project?.puzzles?.find((candidate) => candidate.sourceInteraction?.hostPropId === hostProp?.id) ??
    project?.puzzles?.find((candidate) => candidate.id === "rb_l3_pz1") ??
    null;
  const hostedSourceOk =
    Boolean(project && puzzle && hostProp) &&
    puzzle.roomId === hostProp.roomId &&
    puzzle.sourceInteraction?.visualKey === "none" &&
    puzzle.sourceInteraction?.hostPropId === hostProp.id;

  recordCheck(`fixture:${level.id}:dev_remake_hosted_tool_puzzle_source`, hostedSourceOk, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  if (!hostedSourceOk) {
    addFinding("error", "level3.dev_remake.hosted_tool_puzzle_source", "/build official Level 3 snapshot must bind the tool calibration puzzle to the tool vitrine instead of drawing a standalone calibrator.", {
      levelId: level.id,
      semanticRole: "hosted-puzzle",
      sourceLayers: ["trial-json"],
      sourceLayer: "trial-json",
      puzzle: puzzle
        ? {
            id: puzzle.id,
            roomId: puzzle.roomId,
            position: puzzle.position ?? null,
            sourceInteraction: puzzle.sourceInteraction ?? null,
          }
        : null,
      hostProp: hostProp ? { id: hostProp.id, roomId: hostProp.roomId, position: hostProp.position ?? null } : null,
    });
    return;
  }

  const compileResult = modules.compileBuilderProjectToLevel(project);
  const assetIndex = compileResult.level ? modules.builderRuntimeAssetIndexForProject(compileResult.level, project) : null;
  const runtimePack = compileResult.level ? modules.compileBuilderRuntimePack(compileResult.level, project, { assetIndex }) : null;
  const compiledPuzzle = puzzle
    ? (compileResult.level?.puzzles?.find((candidate) => candidate.id === puzzle.id) ?? null)
    : null;
  const interactionId =
    compiledPuzzle && "interactionId" in compiledPuzzle
      ? compiledPuzzle.interactionId
      : puzzle.linkedDoorId
      ? `pz_${puzzle.linkedDoorId}_panel`
      : null;
  const interaction = compileResult.level?.map?.interactions?.find((candidate) => candidate.id === interactionId) ?? null;
  const instanceIds = new Set((runtimePack?.renderPlan.instances ?? []).map((instance) => instance.id));
  const lightIds = new Set((runtimePack?.renderPlan.lights ?? []).map((light) => light.id));
  const standaloneInstanceId = interactionId ? `terminal_${interactionId}` : null;
  const standaloneLightId = interactionId ? `light_puzzle_${interactionId}` : null;
  const compiledOk =
    Boolean(interaction) &&
    interaction.visualKey === "none" &&
    interaction.anchorPropId === hostProp.id &&
    (!standaloneInstanceId || !instanceIds.has(standaloneInstanceId)) &&
    (!standaloneLightId || !lightIds.has(standaloneLightId));

  recordCheck(`fixture:${level.id}:dev_remake_hosted_tool_puzzle_runtime`, compiledOk, {
    levelId: level.id,
    sourceLayers: ["trial-json", "runtime-pack"],
  });
  if (!compiledOk) {
    addFinding("error", "level3.dev_remake.hosted_tool_puzzle_runtime", "/build official Level 3 snapshot still bakes a standalone tool calibrator at runtime.", {
      levelId: level.id,
      semanticRole: "hosted-puzzle",
      sourceLayers: ["trial-json", "runtime-pack"],
      sourceLayer: "runtime-pack",
      interactionId,
      visualKey: interaction?.visualKey ?? null,
      anchorPropId: interaction?.anchorPropId ?? null,
      standaloneInstanceId,
      standaloneInstancePresent: standaloneInstanceId ? instanceIds.has(standaloneInstanceId) : false,
      standaloneLightId,
      standaloneLightPresent: standaloneLightId ? lightIds.has(standaloneLightId) : false,
    });
  }
}

function checkLevel3ExitKit(context, devRemakeProjectsSource) {
  const { rawPlan, trialBuilder, trialLevel, level } = context;
  const exitRoomId = "level_03_official_exit_room";
  const officialExitStages = (rawPlan?.instances ?? []).filter(
    (instance) => instance.roomId === exitRoomId && instance.modelKey === "service_elevator_exit_stage",
  );
  const officialExitShells = (rawPlan?.instances ?? []).filter(
    (instance) => instance.roomId === exitRoomId && instance.modelKey === "service_elevator_interior_shell",
  );
  const officialExitCallButtons = (rawPlan?.instances ?? []).filter(
    (instance) => instance.roomId === exitRoomId && instance.modelKey === "service_elevator_call_buttons",
  );
  const officialExitShaftFx = (rawPlan?.instances ?? []).filter(
    (instance) => instance.roomId === exitRoomId && instance.modelKey === "service_elevator_ascent_shaft_fx",
  );
  recordCheck(`fixture:${level.id}:in_world_exit_stage`, officialExitStages.length === 1, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });
  recordCheck(`fixture:${level.id}:static_interior_shell`, officialExitShells.length === 1, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });
  recordCheck(`fixture:${level.id}:static_call_buttons`, officialExitCallButtons.length === 1, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });
  recordCheck(`fixture:${level.id}:static_ascent_shaft_fx`, officialExitShaftFx.length === 1, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });
  if (officialExitStages.length !== 1 || officialExitShells.length !== 1 || officialExitCallButtons.length !== 1 || officialExitShaftFx.length !== 1) {
    addFinding("error", "level3.exit.static_elevator_kit", "Level 3 official exit must own one baked in-world elevator stage plus one fallback elevator shell, one single call-button prop, and one ascent shaft FX prop.", {
      levelId: level.id,
      semanticRole: "exit-room-fixture",
      sourceLayers: ["official", "raw-plan"],
      stageInstances: officialExitStages.map((instance) => instance.id),
      shellInstances: officialExitShells.map((instance) => instance.id),
      callButtonInstances: officialExitCallButtons.map((instance) => instance.id),
      shaftFxInstances: officialExitShaftFx.map((instance) => instance.id),
    });
  }

  const compiledExitRoom =
    (trialLevel?.map?.rooms ?? []).find((room) => room.id === trialLevel?.exit?.roomId) ??
    (trialLevel?.map?.rooms ?? []).find((room) => room.aesthetic?.style === "exit");
  const compiledExitProps = (trialLevel?.map?.props ?? []).filter((prop) => prop.roomId === compiledExitRoom?.id);
  const compiledExitPropKeys = compiledExitProps.map((prop) => prop.modelKey);
  const compiledCeilingOff = compiledExitRoom?.geometry?.renderCeiling === false;
  const compiledHasStage = compiledExitPropKeys.includes("service_elevator_exit_stage");
  const compiledHasShell = compiledExitPropKeys.includes("service_elevator_interior_shell");
  const compiledHasCallButtons = compiledExitPropKeys.includes("service_elevator_call_buttons");
  const compiledHasShaftFx = compiledExitPropKeys.includes("service_elevator_ascent_shaft_fx");
  recordCheck(`fixture:${level.id}:trial_compiled_exit_render_ceiling_false`, compiledCeilingOff, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  recordCheck(`fixture:${level.id}:trial_compiled_exit_in_world_stage`, compiledHasStage, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  recordCheck(`fixture:${level.id}:trial_compiled_exit_static_shell`, compiledHasShell, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  recordCheck(`fixture:${level.id}:trial_compiled_exit_static_call_buttons`, compiledHasCallButtons, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  recordCheck(`fixture:${level.id}:trial_compiled_exit_static_ascent_shaft_fx`, compiledHasShaftFx, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  if (!compiledCeilingOff || !compiledHasStage || !compiledHasShell || !compiledHasCallButtons || !compiledHasShaftFx) {
    addFinding("error", "level3.trial_exit.static_elevator_kit", "rb_l3 compiled exit must mirror the official clean elevator kit with the baked in-world stage.", {
      levelId: level.id,
      semanticRole: "exit-room-fixture",
      sourceLayers: ["trial-json"],
      sourceLayer: "trial-json",
      roomId: compiledExitRoom?.id ?? null,
      geometry: compiledExitRoom?.geometry ?? null,
      modelKeys: compiledExitPropKeys,
    });
  }

  const hasLegacyInlineLamp = devRemakeProjectsSource.includes('"id":"rb_l3_p15"') || devRemakeProjectsSource.includes('"id": "rb_l3_p15"');
  recordCheck(`fixture:${level.id}:dev_remake_no_legacy_exit_lamp`, !hasLegacyInlineLamp, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  if (hasLegacyInlineLamp) {
    addFinding("error", "level3.dev_remake.legacy_exit_lamp", "devRemakeProjects.ts still contains the stale rb_l3 exit lamp.", {
      levelId: level.id,
      semanticRole: "exit-room-fixture",
      sourceLayers: ["trial-json"],
      sourceLayer: "trial-json",
    });
  }

  const exitRoomIds = new Set(
    [trialBuilder?.exitRoomId, ...(trialBuilder?.rooms ?? []).filter((room) => room.style === "exit").map((room) => room.id)].filter(Boolean),
  );
  const forbiddenTrialKeys = new Set(["room_ceiling_panel_maintenance", "room_wall_wash_light_maintenance", "light_residential_lamp_warm"]);
  const badTrialProps = (trialBuilder?.props ?? []).filter((prop) => exitRoomIds.has(prop.roomId) && forbiddenTrialKeys.has(prop.modelKey));
  recordCheck(`fixture:${level.id}:trial_builder_exit_no_white_fixtures`, badTrialProps.length === 0, {
    levelId: level.id,
    sourceLayers: ["trial-json"],
  });
  if (badTrialProps.length > 0) {
    addFinding("error", "level3.trial_exit.fixture_prop", "rb_l3 builder trial exit room must not contain generated residential/fixture props.", {
      levelId: level.id,
      semanticRole: "exit-room-fixture",
      sourceLayers: ["trial-json"],
      sourceLayer: "trial-json",
      props: badTrialProps.map((prop) => ({ id: prop.id, roomId: prop.roomId, modelKey: prop.modelKey })),
    });
  }
}

function checkBuilderRuntimeResourceIndex(sourceIndex, readySources) {
  const missing = sourceIndex.filter((entry) => !readySources.readyByKey.has(entry.modelKey));
  recordCheck("runtime-pack:source_index_ready", missing.length === 0, {
    sourceLayers: ["runtime-pack", "raw-plan"],
    missing: missing.length,
  });
  if (missing.length > 0) {
    addFinding("error", "runtime_pack.source_index.not_ready", "Builder WGPU source index has modelKeys with no ready Raw/runtime resource source.", {
      semanticRole: "runtime-resource",
      sourceLayers: ["raw-plan", "runtime-pack"],
      sourceLayer: "runtime-pack",
      missing: missing.slice(0, 50).map((entry) => ({
        modelKey: entry.modelKey,
        kind: entry.kind,
        roles: entry.roles,
      })),
      missingCount: missing.length,
    });
  }
}

function checkBuilderRuntimeRobotResources(enemyModelAssets, builderResourcePlan, builderResourceReadyByKey) {
  const expected = Object.keys(enemyModelAssets);
  for (const modelKey of expected) {
    const asset = builderResourceReadyByKey.get(modelKey);
    const ok = Boolean(asset && asset.sourceFile?.includes("src/assets/models-cooked/enemies/"));
    recordCheck(`runtime-pack:robot_resource:${modelKey}`, ok, {
      sourceLayers: ["runtime-pack"],
    });
    if (!ok) {
      addFinding("error", "runtime_pack.robot.native_resource", `${modelKey} must be ready in builder runtime resources.`, {
        semanticRole: "robot",
        sourceLayers: ["runtime-pack"],
        sourceLayer: "runtime-pack",
        modelKey,
        asset: asset ?? null,
      });
    }
  }

  recordCheck("runtime-pack:builder_resource_plan_exists", Boolean(builderResourcePlan), {
    sourceLayers: ["runtime-pack"],
  });
}

function checkSkillRuntimeVisualContract(modules, sourceIndex, readySources) {
  const ability = modules.ultimateAbilityConfig.coreBomb;
  const sourceEntry = sourceIndex.find((entry) => entry.modelKey === ability?.viewmodelModelKey);
  const pickupEntry = sourceIndex.find((entry) => entry.modelKey === "pickup_energy_cell_amber");
  const ok =
    ability?.activationMode === "throw_then_detonate" &&
    ability?.resourceSpendPhase === "throw" &&
    ability?.viewmodelModelKey === "ability_protocol_breach_charge_v1" &&
    ability?.deployedWorldModelKey === "ability_protocol_breach_charge_v1" &&
    modules.RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS.coreBomb === "ability_protocol_breach_charge_v1" &&
    ability?.viewmodelModelKey !== "pickup_energy_cell_amber" &&
    ability?.deployedWorldModelKey !== "pickup_energy_cell_amber" &&
    ability?.deployedWorldModelKey !== "ability_core_bomb_proxy" &&
    sourceEntry?.roles?.includes("viewmodel") &&
    !sourceEntry?.roles?.includes("pickup") &&
    readySources.readyByKey.has("ability_protocol_breach_charge_v1") &&
    readySources.supplementalReadyKeys.has("ability_protocol_breach_charge_v1") &&
    pickupEntry?.roles?.includes("pickup") &&
    !pickupEntry?.roles?.includes("viewmodel");

  recordCheck("runtime-visual:skill3:core_bomb_contract", ok, {
    sourceLayers: ["official", "runtime-pack", "raw-plan"],
  });
  if (!ok) {
    addFinding("error", "skill3.visual.contract", "Skill 3 must use the protocol breach charge once as viewmodel/deployed visual and must not reuse pickup/proxy assets.", {
      semanticRole: "skill-runtime-visual",
      sourceLayers: ["official", "runtime-pack", "raw-plan"],
      sourceLayer: "official",
      ability,
      runtimeViewmodelKey: modules.RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS.coreBomb,
      sourceEntry: sourceEntry ?? null,
      pickupEntry: pickupEntry ?? null,
      readySources: readySources.readyByKey.get("ability_protocol_breach_charge_v1") ?? [],
      supplementalReady: readySources.supplementalReadyKeys.has("ability_protocol_breach_charge_v1"),
    });
  }
}

function readReadyWgpuSources(modules, builderResourcePlan) {
  const readyByKey = new Map();
  const officialReadyKeys = new Set();
  const supplementalReadyKeys = new Set();
  const officialSourceIds = new Set(modules.BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS);
  for (const sourceId of modules.BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS) {
    const plan =
      sourceId === modules.BUILDER_NATIVE_RAW_RESOURCE_PACK_ID
        ? builderResourcePlan
        : readJsonIfExists(join(PKG_ROOT, `src/assets/manifests/generated/raw-webgpu/render_plan_${sourceId}.json`));
    if (!plan) continue;
    const categoryByKey = new Map((plan.assets ?? []).map((entry) => [entry.modelKey, entry.category]));
    for (const asset of plan.geometry?.assets ?? []) {
      if (asset.status !== "ready" || (asset.vertexCount ?? 0) <= 0) continue;
      if (officialSourceIds.has(sourceId) && categoryByKey.get(asset.modelKey) === "builder-resource") continue;
      if (!readyByKey.has(asset.modelKey)) readyByKey.set(asset.modelKey, []);
      readyByKey.get(asset.modelKey).push(sourceId);
      if (sourceId === modules.BUILDER_NATIVE_RAW_RESOURCE_PACK_ID) supplementalReadyKeys.add(asset.modelKey);
      else officialReadyKeys.add(asset.modelKey);
    }
  }
  return { readyByKey, officialReadyKeys, supplementalReadyKeys };
}

function collectOfficialSemanticEntries(level, modules) {
  const entries = [];
  for (const prop of level.map?.props ?? []) {
    entries.push({ sourceLayer: "official", role: "prop", id: prop.id, roomId: prop.roomId, modelKey: prop.modelKey });
  }
  for (const door of level.map?.doors ?? []) {
    entries.push({ sourceLayer: "official", role: "door", id: door.id, roomId: door.roomId ?? null, modelKey: modules.modelKeyForDoor(door) });
  }
  for (const interaction of level.map?.interactions ?? []) {
    const modelKey = modules.modelKeyForInteraction(interaction);
    if (modelKey) entries.push({ sourceLayer: "official", role: `interaction:${interaction.type}`, id: interaction.id, roomId: interaction.roomId, modelKey });
  }
  for (const keyItem of level.map?.keyItems ?? []) {
    entries.push({
      sourceLayer: "official",
      role: "keyItem",
      id: keyItem.id,
      roomId: keyItem.roomId,
      modelKey: modules.modelKeyForKeyVisual(keyItem.visualKey ?? "large_yellow_key"),
    });
  }
  for (const pickup of level.map?.pickups ?? []) {
    const modelKey = modules.modelKeyForPickupType(pickup.type);
    if (modelKey) entries.push({ sourceLayer: "official", role: `pickup:${pickup.type}`, id: pickup.id, roomId: pickup.roomId, modelKey });
  }
  for (const puzzle of level.puzzles ?? []) {
    if (puzzle.type !== "hit_sequence") continue;
    for (const target of puzzle.targets ?? []) {
      const modelKey = modules.modelKeyForPuzzleOrbTarget(target);
      if (modelKey) entries.push({ sourceLayer: "official", role: "puzzleTarget", id: target.id, roomId: target.roomId, modelKey });
    }
  }
  for (const wave of level.waves ?? []) {
    for (const enemy of [...(wave.enemies ?? []), ...(wave.reinforcements ?? [])]) {
      const modelKey = modelKeyForEnemyArchetype(enemy.archetype, enemy.tier);
      if (modelKey) entries.push({ sourceLayer: "official", role: "robot", id: wave.id, roomId: null, modelKey });
    }
  }
  return entries;
}

function collectDeclaredExitModelKeys(level, exitRoomId, context) {
  const modelKeys = new Set();
  for (const entry of context.officialEntries) {
    if (entry.roomId === exitRoomId && entry.modelKey) modelKeys.add(entry.modelKey);
  }
  for (const door of level.map?.doors ?? []) {
    if (door.fromRoomId === exitRoomId || door.toRoomId === exitRoomId || door.roomId === exitRoomId) {
      const match = context.officialEntries.find((entry) => entry.role === "door" && entry.id === door.id);
      if (match?.modelKey) modelKeys.add(match.modelKey);
    }
  }
  return modelKeys;
}

function modelKeyForEnemyArchetype(archetype, tier) {
  if (archetype === "repair_drone") return "hp_enemy_repair_drone_horror";
  if (archetype === "clamp_bot") return "hp_enemy_clamp_repair_horror";
  if (archetype === "shield_tech") return "hp_enemy_shield_technician_horror";
  if (archetype === "custodian_elite" || tier === "leader" || tier === "boss") return "hp_enemy_custodian_foreman_horror";
  return null;
}

function exitRoomIdForLevel(level) {
  return (level.map?.interactions ?? []).find((interaction) => interaction.type === "exit")?.roomId ?? null;
}

function isSuspiciousExitFixtureModelKey(modelKey) {
  return (
    /^room_ceiling_panel_/.test(modelKey) ||
    /^room_wall_wash_light_/.test(modelKey) ||
    modelKey === "room_ceiling_strip_light" ||
    modelKey === "light_residential_lamp_warm" ||
    modelKey === "switch_panel_wall_cyan" ||
    modelKey === "terminal_code_keypad"
  );
}

function readyGeometryByKey(plan) {
  const out = new Map();
  for (const asset of plan?.geometry?.assets ?? []) {
    if (asset.status === "ready" && (asset.vertexCount ?? 0) > 0) out.set(asset.modelKey, asset);
  }
  return out;
}

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function binaryFileIncludes(filePath, needle) {
  return existsSync(filePath) && readFileSync(filePath).includes(Buffer.from(needle));
}

function publicUrlToFilePath(publicUrl) {
  return join(PKG_ROOT, "public", String(publicUrl).replace(/^\/+/, ""));
}

function collectObjects(value, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out);
    return out;
  }
  out.push(value);
  for (const child of Object.values(value)) collectObjects(child, out);
  return out;
}

function uniqueModelKeys(entries) {
  return uniqueStrings(entries.map((entry) => entry.modelKey).filter(Boolean));
}

function uniqueStrings(values) {
  return [...new Set(values)].sort();
}

function diffArrays(expected, actual) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((value) => !actualSet.has(value)),
    extra: actual.filter((value) => !expectedSet.has(value)),
  };
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function floorGlowOpacity(light) {
  return Number(light.opacity ?? light.intensity ?? 0);
}

function publicInstance(instance) {
  return {
    id: instance.id,
    roomId: instance.roomId,
    modelKey: instance.modelKey,
    source: instance.source,
    role: instance.role,
    position: instance.position ?? null,
    scale: instance.scale ?? null,
  };
}

function recordCheck(id, statusOrPass, extra = {}) {
  const status = typeof statusOrPass === "boolean" ? (statusOrPass ? "pass" : "fail") : statusOrPass;
  checks.push({ id, status, ...extra });
}

function addFinding(severity, code, message, extra = {}) {
  findings.push({ severity, code, message, ...extra });
}

function relativePath(filePath) {
  return filePath && filePath.startsWith(PKG_ROOT) ? filePath.slice(PKG_ROOT.length + 1) : filePath;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (arg === "--level3") {
      parsed.level = "level_03_human_museum";
      continue;
    }
    if (arg.startsWith("--level=")) {
      parsed.level = arg.slice("--level=".length);
      continue;
    }
    if (arg.startsWith("--report=")) {
      parsed.report = arg.slice("--report=".length);
    }
  }
  return parsed;
}
