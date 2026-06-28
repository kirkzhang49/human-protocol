#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const DEFAULT_REPORT_PATH = join(PKG_ROOT, "src/assets/manifests/generated/raw-webgpu/qa/builder_to_official_pipeline_report.json");
const FORMAL_OFFICIAL_CAMPAIGN_COUNT = 5;
const SURFACE_SLOTS = ["floor", "wall", "ceiling"];

const args = parseArgs(process.argv.slice(2));
const reportPath = args.report ? resolve(PKG_ROOT, args.report) : DEFAULT_REPORT_PATH;
const focusLevelId = args.level ?? null;
const draftPath = args.draft ? resolve(args.draft) : null;

const checks = [];
const findings = [];
const levelReports = [];

const server = await createServer({
  root: PKG_ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const modules = await loadRuntimeModules(server);
  const presetById = new Map(
    [
      ...modules.builderFloorPresets,
      ...modules.builderWallPresets,
      ...modules.builderCeilingPresets,
    ].map((preset) => [preset.id, preset]),
  );
  const draft = draftPath ? readDraft(draftPath) : null;
  const formalLevels = modules.humanProtocolBasePack.campaignLevelIds
    .slice(0, FORMAL_OFFICIAL_CAMPAIGN_COUNT)
    .map((levelId, index) => ({
      ordinal: index + 1,
      levelId,
      trialStem: `rb_l${index + 1}`,
      level: modules.humanProtocolBasePack.levels.find((candidate) => candidate.id === levelId),
    }))
    .filter((entry) => entry.level);
  const levels = focusLevelId ? formalLevels.filter((entry) => entry.levelId === focusLevelId) : formalLevels;
  if (focusLevelId && levels.length === 0) {
    addFinding("error", "pipeline.level.unknown", `Unknown official level ${focusLevelId}.`, {
      requestedLevelId: focusLevelId,
      coveredLevelIds: formalLevels.map((entry) => entry.levelId),
    });
  }

  for (const entry of levels) {
    const context = createContext(entry, modules, presetById, draft);
    levelReports.push(context.report);
    checkOfficialImportCompile(context, modules);
    checkSurfaceLayerSync(context);
    checkRawPlanBridge(context);
    checkBuilderRuntimeSurfacePack(context, modules);
  }
} finally {
  await server.close();
}

const errors = findings.filter((finding) => finding.severity === "error");
const warnings = findings.filter((finding) => finding.severity === "warning");
const report = {
  schemaVersion: "human-protocol/builder-to-official-pipeline@1",
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 ? "pass" : "fail",
  mode: focusLevelId ? "focused" : "all-formal-official",
  focusLevelId,
  draft: draftPath
    ? {
        path: relativePath(draftPath),
        schemaVersion: levelReports.find((level) => level.draft?.schemaVersion)?.draft?.schemaVersion ?? null,
      }
    : null,
  coverage: {
    officialLevelIds: levelReports.map((level) => level.levelId),
    sourceLayers: ["draft-json", "official", "builder-import", "trial-json", "raw-plan", "runtime-pack"],
  },
  inputs: {
    officialConfig: "src/game/config/ConfigPackStore.ts#humanProtocolBasePack",
    builderImport: "src/build/BuilderLevelImport.ts#builderProjectFromBuiltInLevel",
    trialBuilderJson: Object.fromEntries(levelReports.map((level) => [level.levelId, level.inputs.trialBuilderPath])),
    trialLevelJson: Object.fromEntries(levelReports.map((level) => [level.levelId, level.inputs.trialLevelPath])),
    rawPlans: Object.fromEntries(levelReports.map((level) => [level.levelId, level.inputs.rawPlanPath])),
  },
  summary: {
    levels: levelReports.length,
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
  console.error(`FAIL builder-to-official pipeline QA: ${errors.length} error(s), ${warnings.length} warning(s), report ${relativePath(reportPath)}`);
  for (const finding of errors.slice(0, 12)) console.error(`  - ${finding.code}: ${finding.message}`);
  process.exit(1);
}

console.log(
  `PASS builder-to-official pipeline QA: levels=${levelReports.length}, checks=${checks.length}, warnings=${warnings.length}, report ${relativePath(reportPath)}`,
);

async function loadRuntimeModules(viteServer) {
  const [
    { humanProtocolBasePack },
    { builderProjectFromBuiltInLevel },
    { compileBuilderProjectToLevel },
    { validateLevelConfig },
    { auditBuilderOfficialBridge },
    { compileBuilderRuntimePack },
    { builderFloorPresets, builderWallPresets, builderCeilingPresets },
  ] = await Promise.all([
    viteServer.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    viteServer.ssrLoadModule("/src/build/BuilderLevelImport.ts"),
    viteServer.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts"),
    viteServer.ssrLoadModule("/src/game/config/ConfigValidator.ts"),
    viteServer.ssrLoadModule("/src/build/official-bridge/OfficialBridgeAudit.ts"),
    viteServer.ssrLoadModule("/src/build/runtime-pack/compileBuilderRuntimePack.ts"),
    viteServer.ssrLoadModule("/src/build/BuilderEnvironment.ts"),
  ]);
  return {
    humanProtocolBasePack,
    builderProjectFromBuiltInLevel,
    compileBuilderProjectToLevel,
    validateLevelConfig,
    auditBuilderOfficialBridge,
    compileBuilderRuntimePack,
    builderFloorPresets,
    builderWallPresets,
    builderCeilingPresets,
  };
}

function createContext(entry, modules, presetById, draft) {
  const { level, ordinal, trialStem } = entry;
  const project = modules.builderProjectFromBuiltInLevel(level.id);
  const trialBuilderPath = join(PKG_ROOT, `data/ai/campaign/${trialStem}.builder.json`);
  const trialLevelPath = join(PKG_ROOT, `data/ai/campaign/${trialStem}.level.json`);
  const rawPlanPath = join(PKG_ROOT, `src/assets/manifests/generated/raw-webgpu/render_plan_${level.id}.json`);
  const trialBuilder = readJsonIfExists(trialBuilderPath);
  const trialLevel = readJsonIfExists(trialLevelPath);
  const rawPlan = readJsonIfExists(rawPlanPath);
  const matchingDraft = draft ? draftForLevel(draft, level.id, project) : null;
  const officialSurfaceRooms = level.authoringMetadata?.builderEnvironment?.rooms ?? {};
  const builderImportSurfaceRooms = roomsByIdFromBuilderProject(project);
  const trialBuilderSurfaceRooms = roomsByIdFromBuilderProject(trialBuilder);
  const trialLevelSurfaceRooms = trialLevel?.authoringMetadata?.builderEnvironment?.rooms ?? {};
  const draftSurfaceRooms = matchingDraft?.rooms ?? {};
  const referenceLayer = matchingDraft ? "draft-json" : "official";
  const referenceRooms = matchingDraft ? draftSurfaceRooms : officialSurfaceRooms;
  const roomIds = uniqueStrings([
    ...Object.keys(referenceRooms),
    ...Object.keys(officialSurfaceRooms),
    ...Object.keys(builderImportSurfaceRooms),
    ...Object.keys(trialBuilderSurfaceRooms),
    ...Object.keys(trialLevelSurfaceRooms),
  ]);
  const eligibleSurfaceRooms = roomIds.filter((roomId) => {
    const room = project?.rooms?.find((candidate) => candidate.id === roomId);
    const env = referenceRooms[roomId] ?? officialSurfaceRooms[roomId] ?? builderImportSurfaceRooms[roomId] ?? {};
    return room?.style !== "exit" && hasSurfaceOverride(env);
  });

  return {
    ordinal,
    level,
    project,
    trialBuilder,
    trialLevel,
    rawPlan,
    presetById,
    matchingDraft,
    referenceLayer,
    referenceRooms,
    officialSurfaceRooms,
    builderImportSurfaceRooms,
    trialBuilderSurfaceRooms,
    trialLevelSurfaceRooms,
    draftSurfaceRooms,
    eligibleSurfaceRooms,
    report: {
      ordinal,
      levelId: level.id,
      title: level.title,
      inputs: {
        trialBuilderPath: relativePath(trialBuilderPath),
        trialLevelPath: relativePath(trialLevelPath),
        rawPlanPath: relativePath(rawPlanPath),
      },
      draft: matchingDraft
        ? {
            schemaVersion: draft.schemaVersion,
            source: matchingDraft.source,
            roomCount: Object.keys(draftSurfaceRooms).length,
          }
        : null,
      counts: {
        officialSurfaceRooms: Object.keys(officialSurfaceRooms).length,
        builderImportSurfaceRooms: Object.keys(builderImportSurfaceRooms).length,
        trialBuilderSurfaceRooms: Object.keys(trialBuilderSurfaceRooms).length,
        trialLevelSurfaceRooms: Object.keys(trialLevelSurfaceRooms).length,
        eligibleSurfaceRooms: eligibleSurfaceRooms.length,
      },
      drift: {},
    },
  };
}

function checkOfficialImportCompile(context, modules) {
  const { level, project } = context;
  recordCheck(`pipeline:${level.id}:builder_import_exists`, Boolean(project), {
    levelId: level.id,
    sourceLayers: ["official", "builder-import"],
  });
  if (!project) {
    addFinding("error", "pipeline.builder_import.missing", `${level.id} cannot be imported through builderProjectFromBuiltInLevel.`, {
      levelId: level.id,
      sourceLayers: ["official", "builder-import"],
    });
    return;
  }

  const compileResult = modules.compileBuilderProjectToLevel(project);
  const compileIssues = compileResult.issues ?? [];
  const validationReport = compileResult.level ? modules.validateLevelConfig(compileResult.level, { authoringProfile: "generated" }) : null;
  const bridgeAudit = compileResult.level ? modules.auditBuilderOfficialBridge(compileResult.level, project) : null;
  const validationErrors = validationReport?.errors ?? [];
  const bridgeErrors = bridgeAudit?.errors ?? [];
  const ok = Boolean(compileResult.level) && compileIssues.length === 0 && validationErrors.length === 0 && bridgeErrors.length === 0;
  recordCheck(`pipeline:${level.id}:builder_import_compiles`, ok, {
    levelId: level.id,
    sourceLayers: ["official", "builder-import"],
    compileIssues: compileIssues.length,
    validationErrors: validationErrors.length,
    bridgeErrors: bridgeErrors.length,
  });
  if (!ok) {
    addFinding("error", "pipeline.builder_import.invalid", `${level.id} official import does not compile and validate cleanly.`, {
      levelId: level.id,
      sourceLayers: ["official", "builder-import"],
      compileIssues,
      validationErrors,
      bridgeErrors,
    });
  }
}

function checkSurfaceLayerSync(context) {
  const { level, referenceLayer, referenceRooms } = context;
  const layers = {
    "official": context.officialSurfaceRooms,
    "builder-import": context.builderImportSurfaceRooms,
    "trial-builder-json": context.trialBuilderSurfaceRooms,
    "trial-level-json": context.trialLevelSurfaceRooms,
    ...(context.matchingDraft ? { "draft-json": context.draftSurfaceRooms } : {}),
  };
  const diffs = [];
  for (const [roomId, referenceEnv] of Object.entries(referenceRooms)) {
    if (!hasSurfacePreset(referenceEnv)) continue;
    for (const slot of SURFACE_SLOTS) {
      const expected = surfaceValue(referenceEnv, slot);
      if (!expected.presetId && !expected.overridePresetId) continue;
      for (const [layerName, rooms] of Object.entries(layers)) {
        const actual = surfaceValue(rooms[roomId], slot);
        if (sameSurfaceValue(expected, actual)) continue;
        diffs.push({
          roomId,
          slot,
          expectedLayer: referenceLayer,
          actualLayer: layerName,
          expected,
          actual,
        });
      }
    }
  }
  context.report.drift.surfaceLayerDiffs = diffs;
  recordCheck(`pipeline:${level.id}:surface_layers_sync`, diffs.length === 0, {
    levelId: level.id,
    sourceLayers: Object.keys(layers),
    referenceLayer,
    diffs: diffs.length,
  });
  if (diffs.length > 0) {
    addFinding("error", "pipeline.surface_layer_drift", `${level.id} surface presets drift between playtest/export, official source, trial JSON, or builder import.`, {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: Object.keys(layers),
      referenceLayer,
      diffs: diffs.slice(0, 40),
    });
  }
}

function checkRawPlanBridge(context) {
  const { level, rawPlan, eligibleSurfaceRooms, presetById } = context;
  if (!rawPlan) {
    recordCheck(`pipeline:${level.id}:raw_plan_exists`, false, {
      levelId: level.id,
      sourceLayers: ["raw-plan"],
    });
    addFinding("error", "pipeline.raw_plan.missing", `${level.id} has no generated Raw WebGPU render plan.`, {
      levelId: level.id,
      sourceLayers: ["raw-plan"],
    });
    return;
  }

  recordCheck(`pipeline:${level.id}:raw_plan_exists`, true, {
    levelId: level.id,
    sourceLayers: ["raw-plan"],
  });

  const expectedSurfaceRows = expectedSurfaceRowsForRooms(context, eligibleSurfaceRooms, presetById);
  const expectsBridge = expectedSurfaceRows.length > 0;
  const bridgeEnabled = rawPlan.officialBuilderSurfaceBridge?.enabled === true;
  recordCheck(`pipeline:${level.id}:raw_builder_surface_bridge`, expectsBridge ? bridgeEnabled : !bridgeEnabled, {
    levelId: level.id,
    sourceLayers: ["official", "raw-plan"],
    expectedSurfaceRows: expectedSurfaceRows.length,
    bridgeEnabled,
  });
  if (expectsBridge && !bridgeEnabled) {
    addFinding("error", "pipeline.raw_surface_bridge.disabled", `${level.id} Raw plan should use officialBuilderSurfaceBridge for explicit builder surface overrides.`, {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: ["official", "raw-plan"],
      bridge: rawPlan.officialBuilderSurfaceBridge ?? null,
    });
  }
  if (!expectsBridge && bridgeEnabled) {
    addFinding("error", "pipeline.raw_surface_bridge.unexpected", `${level.id} Raw plan replaced official shell surfaces without explicit builder surface overrides.`, {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: ["official", "raw-plan"],
      bridge: rawPlan.officialBuilderSurfaceBridge ?? null,
    });
  }

  if (!expectsBridge) return;

  const instanceKeys = new Set((rawPlan.instances ?? []).map((instance) => instance.modelKey));
  const missingInstances = expectedSurfaceRows
    .map((row) => ({ ...row, modelKey: surfaceModelKey(row.slot, row.roomId) }))
    .filter((row) => !instanceKeys.has(row.modelKey));
  const staleShellInstances = (rawPlan.instances ?? []).filter(
    (instance) =>
      eligibleSurfaceRooms.includes(instance.roomId) &&
      instance.source === "shell" &&
      (instance.role === "floor" || instance.role === "wall" || instance.role === "ceiling"),
  );
  const textureSources = rawPlan.geometry?.baseColorTextures ?? [];
  const missingTextures = uniqueStrings(expectedSurfaceRows.map((row) => basenameFromUrl(row.albedoUrl))).filter(
    (token) =>
      !textureSources.some(
        (texture) =>
          String(texture.url ?? "").includes(token) ||
          String(texture.sourceFile ?? "").includes(token) ||
          String(texture.name ?? "").includes(token),
      ),
  );
  const ok = missingInstances.length === 0 && staleShellInstances.length === 0 && missingTextures.length === 0;
  context.report.drift.rawSurfaceBridge = {
    missingInstances,
    staleShellInstances: staleShellInstances.map(publicInstance),
    missingTextures,
  };
  recordCheck(`pipeline:${level.id}:raw_surface_output`, ok, {
    levelId: level.id,
    sourceLayers: ["official", "raw-plan"],
    missingInstances: missingInstances.length,
    staleShellInstances: staleShellInstances.length,
    missingTextures: missingTextures.length,
  });
  if (!ok) {
    addFinding("error", "pipeline.raw_surface_output.drift", `${level.id} Raw plan does not reflect official builder surface overrides.`, {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: ["official", "raw-plan"],
      missingInstances,
      staleShellInstances: staleShellInstances.slice(0, 24).map(publicInstance),
      missingTextures,
    });
  }
}

function checkBuilderRuntimeSurfacePack(context, modules) {
  const { level, project, eligibleSurfaceRooms, presetById } = context;
  if (!project || eligibleSurfaceRooms.length === 0) {
    recordCheck(`pipeline:${level.id}:builder_runtime_surface_pack`, "skip", {
      levelId: level.id,
      reason: project ? "no_surface_overrides" : "missing_project",
    });
    return;
  }
  const compileResult = modules.compileBuilderProjectToLevel(project);
  if (!compileResult.level || (compileResult.issues ?? []).length > 0) {
    recordCheck(`pipeline:${level.id}:builder_runtime_surface_pack`, false, {
      levelId: level.id,
      sourceLayers: ["builder-import", "runtime-pack"],
      compileIssues: compileResult.issues?.length ?? 0,
    });
    return;
  }
  const runtimePack = modules.compileBuilderRuntimePack(compileResult.level, project);
  const expectedTextureTokens = uniqueStrings(
    expectedSurfaceRowsForRooms(context, eligibleSurfaceRooms, presetById).map((row) => basenameFromUrl(row.albedoUrl)),
  );
  const baseColorTextures = runtimePack.renderPlan.geometry?.baseColorTextures ?? [];
  const missingTextures = expectedTextureTokens.filter(
    (token) =>
      !baseColorTextures.some(
        (texture) =>
          String(texture.url ?? "").includes(token) ||
          String(texture.sourceFile ?? "").includes(token) ||
          String(texture.name ?? "").includes(token),
      ),
  );
  const ok = missingTextures.length === 0;
  context.report.drift.builderRuntimeSurfacePack = {
    expectedTextureTokens,
    missingTextures,
    baseColorTextureCount: baseColorTextures.length,
  };
  recordCheck(`pipeline:${level.id}:builder_runtime_surface_pack`, ok, {
    levelId: level.id,
    sourceLayers: ["builder-import", "runtime-pack"],
    expectedTextures: expectedTextureTokens.length,
    missingTextures: missingTextures.length,
  });
  if (!ok) {
    addFinding("error", "pipeline.runtime_surface_pack.drift", `${level.id} builder runtime pack does not carry the same surface textures as official source.`, {
      levelId: level.id,
      semanticRole: "room-surface",
      sourceLayers: ["builder-import", "runtime-pack"],
      expectedTextureTokens,
      missingTextures,
    });
  }
}

function expectedSurfaceRowsForRooms(context, roomIds, presetById) {
  const rows = [];
  for (const roomId of roomIds) {
    const env = context.officialSurfaceRooms[roomId] ?? context.builderImportSurfaceRooms[roomId] ?? {};
    for (const slot of SURFACE_SLOTS) {
      const presetId = surfaceValue(env, slot).effectivePresetId;
      const preset = presetId ? presetById.get(presetId) : null;
      if (!preset?.albedoUrl) continue;
      rows.push({
        roomId,
        slot,
        presetId,
        albedoUrl: preset.albedoUrl,
      });
    }
  }
  return rows;
}

function readDraft(filePath) {
  const json = JSON.parse(readFileSync(filePath, "utf8"));
  return {
    path: filePath,
    schemaVersion: json.schemaVersion ?? null,
    json,
  };
}

function draftForLevel(draft, levelId, officialProject) {
  const json = draft.json;
  if (json.schemaVersion === "hp.config.v1" && Array.isArray(json.levels)) {
    const level = json.levels.find((candidate) => candidate.id === levelId) ?? (json.levels.length === 1 ? json.levels[0] : null);
    if (!level) return null;
    return {
      source: "hp.config.v1.level",
      level,
      rooms: level.authoringMetadata?.builderEnvironment?.rooms ?? {},
    };
  }
  if (json.schemaVersion === "hp.builder.v1") {
    const sourceLevelId = json.sourceLevel?.levelId ?? json.sourceLevelId ?? officialProject?.sourceLevel?.levelId ?? levelId;
    if (sourceLevelId !== levelId && levelId !== focusLevelId) return null;
    return {
      source: "hp.builder.v1.project",
      project: json,
      rooms: roomsByIdFromBuilderProject(json),
    };
  }
  return null;
}

function roomsByIdFromBuilderProject(project) {
  if (!project?.rooms) return {};
  return Object.fromEntries(project.rooms.map((room) => [room.id, room.env ?? {}]));
}

function surfaceValue(env, slot) {
  if (!env) return { presetId: null, overridePresetId: null, effectivePresetId: null };
  const presetId = env[`${slot}PresetId`] ?? null;
  const overridePresetId = env.surfaceOverrides?.[slot]?.presetId ?? null;
  return {
    presetId,
    overridePresetId,
    effectivePresetId: overridePresetId ?? presetId,
  };
}

function sameSurfaceValue(left, right) {
  return (left.effectivePresetId ?? null) === (right.effectivePresetId ?? null);
}

function hasSurfacePreset(env) {
  return SURFACE_SLOTS.some((slot) => Boolean(env?.[`${slot}PresetId`] || env?.surfaceOverrides?.[slot]?.presetId));
}

function hasSurfaceOverride(env) {
  return SURFACE_SLOTS.some((slot) => Boolean(env?.surfaceOverrides?.[slot]?.presetId));
}

function surfaceModelKey(slot, roomId) {
  if (slot === "floor") return `builder:floor:${roomId}`;
  if (slot === "wall") return `builder:walls:${roomId}`;
  return `builder:ceiling:${roomId}`;
}

function publicInstance(instance) {
  return {
    id: instance.id,
    source: instance.source,
    role: instance.role,
    roomId: instance.roomId,
    modelKey: instance.modelKey,
  };
}

function basenameFromUrl(url) {
  return basename(String(url ?? "").split("?")[0]);
}

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (value.startsWith("--level=")) parsed.level = value.slice("--level=".length);
    else if (value.startsWith("--draft=")) parsed.draft = value.slice("--draft=".length);
    else if (value.startsWith("--report=")) parsed.report = value.slice("--report=".length);
  }
  return parsed;
}

function recordCheck(id, status, details = {}) {
  checks.push({
    id,
    status: status === true ? "pass" : status === false ? "fail" : status,
    ...details,
  });
}

function addFinding(severity, code, message, details = {}) {
  findings.push({
    severity,
    code,
    message,
    ...details,
  });
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function relativePath(filePath) {
  return resolve(filePath).startsWith(PKG_ROOT) ? resolve(filePath).slice(PKG_ROOT.length + 1) : filePath;
}
