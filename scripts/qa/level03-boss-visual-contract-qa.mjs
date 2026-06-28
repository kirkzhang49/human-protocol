#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const args = parseArgs(process.argv.slice(2));

const contract = {
  levelId: args.level ?? "level_03_human_museum",
  waveId: "wave_level_03_central_archive",
  archetypeId: "custodian_elite",
  tier: "boss",
  tierLabel: "策展主管",
  modelKey: "hp_enemy_shield_technician_horror",
  profileId: "level03_museum_curator",
  requiredActions: [
    "idle",
    "move",
    "attack_windup",
    "attack_strike",
    "attack_recover",
    "hit_light",
    "hit_heavy",
    "stagger",
    "death",
    "spawn_boot",
  ],
  requiredSourceNodes: [
    "torso_control",
    "part_head",
    "weaponSocket",
    "rescue-baton-body",
    "rescue-baton",
    "left-utility-hand",
    "right-utility-hand",
  ],
  requiredCookedNodes: [
    "torso_control",
    "part_head",
    "rescue-baton",
    "left-utility-hand",
    "right-utility-hand",
    "part_backpack",
  ],
  requiredSourceMaterials: [
    "mat_body_warm_museum_panel",
    "mat_brushed_warm_museum_trim",
    "mat_deep_gunmetal_museum",
    "mat_dark_armored_museum_panel",
    "mat_scanner_soft_teal_emissive",
    "mat_warning_warm_amber_emissive",
  ],
  rawMaterialExpectations: [
    {
      name: "mat_body_warm_museum_panel",
      visualRole: "structural_dark",
      maxLuma: 0.34,
    },
    {
      name: "mat_brushed_warm_museum_trim",
      visualRole: "structural_dark",
      minLuma: 0.18,
      maxLuma: 0.34,
    },
    {
      name: "mat_scanner_soft_teal_emissive",
      visualRole: "cyan_emissive",
      minEmissiveStrength: 0.2,
    },
    {
      name: "mat_warning_warm_amber_emissive",
      visualRole: "pickup_energy",
      minEmissiveStrength: 0.12,
    },
  ],
  textureFiles: [
    "src/assets/textures/enemies/hp_enemy_shield_technician_atlas.webp",
    "src/assets/textures/enemies/hp_enemy_shield_technician_emissive.webp",
  ],
};

const checks = [];
const findings = [];

const server = await createServer({
  root: PKG_ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

try {
  const [
    { humanProtocolBasePack },
    { bossVisualProfileForEnemy, bossFeedbackForEnemy, bossPoseTuningForEnemy, bossStaggerTuningForEnemy },
    { enemyModelAssets, modelKeyForEnemy },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/config/ConfigPackStore.ts"),
    server.ssrLoadModule("/src/game/config/bossVisualProfiles.ts"),
    server.ssrLoadModule("/src/assets/enemyModelAssets.ts"),
  ]);

  const level = humanProtocolBasePack.levels.find((candidate) => candidate.id === contract.levelId);
  check(Boolean(level), "official.level.exists", `official level ${contract.levelId} is loaded`);

  const wave = level?.waves?.find((candidate) => candidate.id === contract.waveId);
  check(Boolean(wave), "official.wave.exists", `boss wave ${contract.waveId} exists`);
  const boss = wave?.enemies?.find((enemy) => enemy.visual?.modelKey === contract.modelKey) ?? wave?.enemies?.[0];
  check(Boolean(boss), "official.wave.boss.exists", "boss wave has an enemy entry");
  check(boss?.archetype === contract.archetypeId, "official.wave.boss.archetype", `boss archetype is ${contract.archetypeId}`, {
    actual: boss?.archetype,
  });
  check(boss?.tier === contract.tier, "official.wave.boss.tier", `boss tier is ${contract.tier}`, { actual: boss?.tier });
  check(boss?.tierLabel === contract.tierLabel, "official.wave.boss.label", "boss tier label survives official source", {
    actual: boss?.tierLabel,
  });
  check(boss?.visual?.modelKey === contract.modelKey, "official.wave.boss.model", `boss modelKey is ${contract.modelKey}`, {
    actual: boss?.visual?.modelKey,
  });
  check((boss?.healthMultiplier ?? 0) >= 0.38 && (boss?.healthMultiplier ?? 0) <= 0.55, "official.wave.boss.health", "museum curator boss health is tuned for a readable Level 3 encounter", {
    actual: boss?.healthMultiplier,
  });
  check((boss?.visual?.scaleMultiplier ?? 0) >= 0.9 && (boss?.visual?.scaleMultiplier ?? 0) <= 1.0, "official.wave.boss.scale", "shield technician boss scale is reduced for the museum room", {
    actual: boss?.visual?.scaleMultiplier,
  });
  const earlyBossModels = earlyCampaignBossModels(humanProtocolBasePack);
  check(!earlyBossModels.includes(contract.modelKey), "official.wave.boss.distinct-model", "Level 3 boss model stays visually distinct from Level 1/2 foreman bosses", {
    earlyBossModels,
    modelKey: contract.modelKey,
  });

  const enemyRef = {
    archetypeId: boss?.archetype,
    tier: boss?.tier ?? "normal",
    tierLabel: boss?.tierLabel,
    waveId: wave?.id ?? contract.waveId,
    modelKey: boss?.visual?.modelKey,
  };
  const profile = level && boss ? bossVisualProfileForEnemy(level.id, enemyRef) : null;
  check(profile?.id === contract.profileId, "profile.match", `boss visual profile resolves to ${contract.profileId}`, {
    actual: profile?.id,
  });
  const feedback = level && boss ? bossFeedbackForEnemy(level.id, enemyRef) : null;
  check((feedback?.staggerShockwaveIntensity ?? 0) >= 2.3, "profile.feedback.shockwave", "stagger has high-readability shockwave feedback", {
    actual: feedback?.staggerShockwaveIntensity,
  });
  check((feedback?.armorSparkBaseCount ?? 0) >= 4, "profile.feedback.armor-spark-count", "boss armor hits throw enough spark lanes for first-person readability", {
    actual: feedback?.armorSparkBaseCount,
  });
  check((feedback?.armorSparkPressureCount ?? 0) >= 8, "profile.feedback.pressure-spark-count", "near-stagger armor pressure uses a denser spark burst", {
    actual: feedback?.armorSparkPressureCount,
  });
  check((feedback?.staggerHitStopDuration ?? 0) >= 0.05, "profile.feedback.hitstop", "stagger has readable hitstop", {
    actual: feedback?.staggerHitStopDuration,
  });
  const stagger = level && boss ? bossStaggerTuningForEnemy(level.id, enemyRef) : null;
  check((stagger?.durationMultiplier ?? 0) >= 1.15, "profile.stagger.duration", "stagger window is deliberately readable", {
    actual: stagger?.durationMultiplier,
  });
  const pose = level && boss ? bossPoseTuningForEnemy(level.id, enemyRef) : null;
  check((pose?.staggerPoseMultiplier ?? 0) >= 1.45, "profile.pose.stagger-scale", "stagger pose has a readable boss-specific silhouette shift", {
    actual: pose?.staggerPoseMultiplier,
  });
  check((pose?.torsoRoll ?? 0) >= 0.34, "profile.pose.torso-roll", "stagger pose rolls the curator torso enough to read as vulnerable", {
    actual: pose?.torsoRoll,
  });

  check(level?.combatLimits?.eliteArchetypeId === contract.archetypeId, "official.combat.elite-archetype", "reinforcement gate tracks the curator boss archetype", {
    actual: level?.combatLimits?.eliteArchetypeId,
  });
  const halfPhase = level?.bossPhases?.find((phase) => phase.id === "level_03_curator_half");
  check(halfPhase?.actorId === contract.archetypeId && halfPhase?.tier === contract.tier, "official.boss-phase.actor", "half-health phase tracks the curator boss", {
    actual: { actorId: halfPhase?.actorId, tier: halfPhase?.tier },
  });
  check(
    level?.enemyDeathBeats?.some((beat) => beat.archetypeId === contract.archetypeId),
    "official.death-beat.actor",
    "death beat tracks the curator boss",
  );

  check(Boolean(enemyModelAssets?.[contract.modelKey]), "runtime.model.registered", "shield technician model is registered for runtime preload");
  const runtimeModelKey = modelKeyForEnemy({
    archetypeId: contract.archetypeId,
    tier: contract.tier,
    modelKey: contract.modelKey,
    textureAtlasKey: "custodian_boss",
  });
  check(runtimeModelKey === contract.modelKey, "runtime.model.resolution", "runtime model resolver keeps the Level 3 shield technician model", {
    actual: runtimeModelKey,
  });

  checkGlbPair();
  checkRawSidecar();
  checkRawRenderPlan();
  checkRawAnimationBridge();
  checkTextureFiles();
} finally {
  await server.close();
}

const errors = findings.filter((finding) => finding.severity === "error");
const warnings = findings.filter((finding) => finding.severity === "warning");
const report = {
  schemaVersion: "human-protocol/level03-boss-visual-contract@1",
  generatedAt: new Date().toISOString(),
  status: errors.length === 0 ? "pass" : "fail",
  contract,
  summary: {
    checks: checks.length,
    errors: errors.length,
    warnings: warnings.length,
  },
  checks,
  findings,
};

if (args.report) {
  const reportPath = resolve(PKG_ROOT, args.report);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (warnings.length > 0) {
  console.warn(`WARN Level 3 boss visual contract: ${warnings.length} warning(s)`);
  for (const warning of warnings) console.warn(`  - ${warning.code}: ${warning.message}`);
}

if (errors.length > 0) {
  console.error(`FAIL Level 3 boss visual contract: ${errors.length} error(s), checks=${checks.length}`);
  for (const error of errors) console.error(`  - ${error.code}: ${error.message}`);
  process.exit(1);
}

console.log(`PASS Level 3 boss visual contract: checks=${checks.length}, warnings=${warnings.length}`);

function checkGlbPair() {
  const sourcePath = join(PKG_ROOT, `src/assets/models/enemies/${contract.modelKey}.glb`);
  const cookedPath = join(PKG_ROOT, `src/assets/models-cooked/enemies/${contract.modelKey}.glb`);
  checkFile(sourcePath, "asset.glb.source.exists", "source GLB exists");
  checkFile(cookedPath, "asset.glb.cooked.exists", "cooked GLB exists");
  if (!existsSync(sourcePath) || !existsSync(cookedPath)) return;

  check(statSync(sourcePath).size < 1_500_000, "asset.glb.source.size", "source GLB stays inside boss source budget", {
    bytes: statSync(sourcePath).size,
  });
  check(statSync(cookedPath).size < 900_000, "asset.glb.cooked.size", "cooked GLB stays inside boss runtime budget", {
    bytes: statSync(cookedPath).size,
  });

  const source = readGlbJson(sourcePath);
  const cooked = readGlbJson(cookedPath);
  const sourceNodes = new Set((source.nodes ?? []).map((node) => node.name).filter(Boolean));
  const cookedNodes = new Set((cooked.nodes ?? []).map((node) => node.name).filter(Boolean));
  const sourceMaterials = new Set((source.materials ?? []).map((material) => material.name).filter(Boolean));
  const cookedMaterials = (cooked.materials ?? []).map((material) => material.name).filter(Boolean);
  const sourceActions = new Set((source.animations ?? []).map((animation) => animation.name).filter(Boolean));
  const cookedActions = new Set((cooked.animations ?? []).map((animation) => animation.name).filter(Boolean));

  checkMissing(contract.requiredSourceNodes, sourceNodes, "asset.glb.source.nodes", "source GLB keeps gameplay-readable sockets/nodes");
  checkMissing(contract.requiredCookedNodes, cookedNodes, "asset.glb.cooked.nodes", "cooked GLB keeps runtime-readable sockets/nodes");
  checkMissing(contract.requiredSourceMaterials, sourceMaterials, "asset.glb.source.materials", "source GLB keeps stable Human Protocol material role names");
  checkMissing(contract.requiredActions, sourceActions, "asset.glb.source.clips", "source GLB has all boss combat clips");
  checkMissing(contract.requiredActions, cookedActions, "asset.glb.cooked.clips", "cooked GLB has all boss combat clips");
  check((cooked.meshes?.length ?? 0) >= 50, "asset.glb.cooked.meshes", "cooked GLB keeps a multi-part boss silhouette", {
    actual: cooked.meshes?.length ?? 0,
  });
  check((cooked.nodes?.length ?? 0) >= 120, "asset.glb.cooked.nodes.count", "cooked GLB keeps enough hierarchy for readable animation", {
    actual: cooked.nodes?.length ?? 0,
  });
  if (cookedMaterials.length > 0 && cookedMaterials.every((name) => /^PaletteMaterial\d+/u.test(name))) {
    warn("asset.glb.cooked.materials.generic", "cooked GLB still uses generic PaletteMaterial names; source slots are stable, but next bake should preserve role names.", {
      materials: cookedMaterials,
    });
  } else {
    check(cookedMaterials.length >= 2, "asset.glb.cooked.materials.named", "cooked GLB keeps named material slots", {
      materials: cookedMaterials,
    });
  }
}

function checkRawSidecar() {
  const sidecarPath = join(PKG_ROOT, `src/assets/models/enemies/${contract.modelKey}/.raw-webgpu/${contract.levelId}.json`);
  checkFile(sidecarPath, "raw.sidecar.exists", "Level 3 Raw WebGPU sidecar exists");
  const sidecar = readJsonIfExists(sidecarPath);
  if (!sidecar) return;
  const geometry = sidecar.geometry ?? {};
  check(sidecar.modelKey === contract.modelKey, "raw.sidecar.model", "Raw sidecar modelKey matches boss contract", { actual: sidecar.modelKey });
  check(geometry.status === "ready", "raw.sidecar.ready", "Raw sidecar geometry is ready", { actual: geometry.status });
  check((geometry.vertexCount ?? 0) >= 60_000 && (geometry.vertexCount ?? 0) <= 100_000, "raw.sidecar.vertex-budget", "Raw boss vertex count stays in expected range", {
    actual: geometry.vertexCount,
  });
  check((geometry.triangleCount ?? 0) <= 36_000, "raw.sidecar.triangle-budget", "Raw boss triangle count stays inside budget", {
    actual: geometry.triangleCount,
  });
  check((geometry.rigidSkin?.jointCount ?? 0) >= 120, "raw.sidecar.rigid-joints", "Raw rigid-node-palette keeps enough joints for boss animation", {
    actual: geometry.rigidSkin?.jointCount,
  });
  check((geometry.skinCount ?? 0) === 0, "raw.sidecar.no-skins", "Raw boss stays on rigid hierarchy path", { actual: geometry.skinCount });
  checkMissing(
    contract.requiredActions,
    new Set((geometry.animationClips ?? []).map((clip) => clip.action ?? clip.name).filter(Boolean)),
    "raw.sidecar.clips",
    "Raw sidecar exposes all boss combat clips",
  );
}

function checkRawRenderPlan() {
  const planPath = join(PKG_ROOT, `src/assets/manifests/generated/raw-webgpu/render_plan_${contract.levelId}.json`);
  checkFile(planPath, "raw.plan.exists", "Level 3 Raw render plan exists");
  const plan = readJsonIfExists(planPath);
  const geometry = (plan?.geometry?.assets ?? []).find((asset) => asset.modelKey === contract.modelKey);
  check(Boolean(geometry), "raw.plan.geometry", "Raw render plan includes shield technician boss geometry", {
    available: (plan?.geometry?.assets ?? []).map((asset) => asset.modelKey).filter(Boolean).slice(0, 12),
  });
  if (!geometry) return;
  check(
    geometry.sourceFile === `src/assets/models/enemies/${contract.modelKey}.glb`,
    "raw.plan.geometry.source-original",
    "Raw render plan uses the authored boss GLB as its geometry source",
    { actual: geometry.sourceFile },
  );
  check((geometry.nodeChunks?.length ?? 0) >= 24, "raw.plan.node-chunks", "Raw render plan has enough rigid chunks for boss parts", {
    actual: geometry.nodeChunks?.length ?? 0,
  });
  check((geometry.triangleCount ?? 0) <= 36_000, "raw.plan.triangle-budget", "Raw render plan boss triangle budget matches sidecar budget", {
    actual: geometry.triangleCount,
  });

  const materials = plan?.geometry?.materials ?? [];
  for (const expectation of contract.rawMaterialExpectations) {
    const material = materials.find((candidate) => candidate.category === "enemy" && candidate.name === expectation.name);
    const codeName = materialCodeName(expectation.name);
    check(Boolean(material), `raw.plan.material.${codeName}.exists`, `Raw render plan includes ${expectation.name}`, {
      expected: expectation,
    });
    if (!material) continue;
    check(material.visualRole === expectation.visualRole, `raw.plan.material.${codeName}.role`, `${expectation.name} keeps the expected Raw visual role`, {
      expected: expectation.visualRole,
      actual: material.visualRole,
    });
    const luma = lumaOf(material.baseColorFactor);
    if (Number.isFinite(expectation.minLuma)) {
      check(luma >= expectation.minLuma, `raw.plan.material.${codeName}.min-luma`, `${expectation.name} is not crushed to unreadable black`, {
        expected: expectation.minLuma,
        actual: luma,
        baseColorFactor: material.baseColorFactor,
      });
    }
    if (Number.isFinite(expectation.maxLuma)) {
      check(luma <= expectation.maxLuma, `raw.plan.material.${codeName}.max-luma`, `${expectation.name} stays inside the darker boss palette`, {
        expected: expectation.maxLuma,
        actual: luma,
        baseColorFactor: material.baseColorFactor,
      });
    }
    if (Number.isFinite(expectation.minEmissiveStrength)) {
      check(
        (material.emissiveStrength ?? 0) >= expectation.minEmissiveStrength,
        `raw.plan.material.${codeName}.emissive`,
        `${expectation.name} keeps readable emissive feedback`,
        {
          expected: expectation.minEmissiveStrength,
          actual: material.emissiveStrength,
        },
      );
    }
  }

  const genericWhiteBossMaterials = materials
    .filter((material) => material.category === "enemy" && /^PaletteMaterial00[13](?:\.|$)/iu.test(material.name ?? ""))
    .filter((material) => lumaOf(material.baseColorFactor) > 0.42);
  check(genericWhiteBossMaterials.length === 0, "raw.plan.material.no-white-generic-palette", "Raw boss generic PaletteMaterial slots are remapped into the darker curator palette", {
    offenders: genericWhiteBossMaterials.map((material) => ({
      name: material.name,
      visualRole: material.visualRole,
      baseColorFactor: material.baseColorFactor,
      luma: lumaOf(material.baseColorFactor),
    })),
  });
  const genericTexturedBossMaterials = materials
    .filter((material) => material.category === "enemy" && /^PaletteMaterial00[13](?:\.|$)/iu.test(material.name ?? ""))
    .filter((material) => (material.textures ?? []).some((texture) => texture.semantic === "baseColor" && Number.isFinite(texture.layer)));
  check(genericTexturedBossMaterials.length === 0, "raw.plan.material.no-generic-palette-base-texture", "Raw boss generic PaletteMaterial slots do not sample the pale authored base-color texture", {
    offenders: genericTexturedBossMaterials.map((material) => ({
      name: material.name,
      baseColorFactor: material.baseColorFactor,
      baseColorTextures: (material.textures ?? [])
        .filter((texture) => texture.semantic === "baseColor")
        .map((texture) => ({ layer: texture.layer, name: texture.name, url: texture.url })),
    })),
  });
}

function checkRawAnimationBridge() {
  const bridgePath = join(PKG_ROOT, `src/assets/manifests/generated/raw-webgpu/raw_robot_animation_bridge_${contract.levelId}.json`);
  checkFile(bridgePath, "raw.bridge.exists", "Level 3 Raw robot animation bridge exists");
  const bridge = readJsonIfExists(bridgePath);
  const asset = (bridge?.assets ?? []).find((candidate) => candidate.key === contract.modelKey);
  check(Boolean(asset), "raw.bridge.asset", "Raw animation bridge includes shield technician boss asset", {
    available: (bridge?.assets ?? []).map((candidate) => candidate.key).filter(Boolean),
  });
  if (!asset) return;
  check(!asset.rawReadableAppendageOverrides, "raw.bridge.no-appendage-overrides", "Raw bridge leaves the authored boss rig unmodified", {
    families: Object.keys(asset.rawReadableAppendageOverrides?.families ?? {}),
  });
  check(
    asset.file === `src/assets/models/enemies/${contract.modelKey}.glb`,
    "raw.bridge.source-original",
    "Raw animation bridge uses the authored boss GLB",
    { actual: asset.file },
  );
  check((asset.nodes?.length ?? 0) >= 120, "raw.bridge.nodes", "Raw bridge keeps enough hierarchy nodes", { actual: asset.nodes?.length ?? 0 });
  checkMissing(
    contract.requiredActions,
    new Set((asset.clips ?? []).map((clip) => clip.action ?? clip.name).filter(Boolean)),
    "raw.bridge.clips",
    "Raw bridge exposes all boss combat clips",
  );
}

function earlyCampaignBossModels(basePack) {
  const earlyLevelIds = new Set(["level_01_maintenance_bay", "level_02_residential_simulation"]);
  return [
    ...new Set(
      basePack.levels
        .filter((level) => earlyLevelIds.has(level.id))
        .flatMap((level) => level.waves ?? [])
        .flatMap((wave) => wave.enemies ?? [])
        .filter((enemy) => enemy.tier === "leader" || enemy.tier === "boss" || enemy.archetype === "custodian_elite")
        .map((enemy) => enemy.visual?.modelKey)
        .filter(Boolean),
    ),
  ];
}

function checkTextureFiles() {
  for (const texture of contract.textureFiles) checkFile(join(PKG_ROOT, texture), `asset.texture.${texture.endsWith("emissive.webp") ? "emissive" : "atlas"}`, `${texture} exists`);
}

function checkFile(pathname, code, message) {
  check(existsSync(pathname), code, message, { path: relativePath(pathname) });
}

function checkMissing(required, actualSet, code, message) {
  const missing = required.filter((entry) => !actualSet.has(entry));
  check(missing.length === 0, code, message, { missing });
}

function check(condition, code, message, details = {}) {
  checks.push({ status: condition ? "pass" : "fail", code, message, details });
  if (!condition) {
    findings.push({ severity: "error", code, message, details });
  }
}

function warn(code, message, details = {}) {
  checks.push({ status: "warning", code, message, details });
  findings.push({ severity: "warning", code, message, details });
}

function readJsonIfExists(pathname) {
  if (!existsSync(pathname)) return null;
  return JSON.parse(readFileSync(pathname, "utf8"));
}

function readGlbJson(pathname) {
  const bytes = readFileSync(pathname);
  if (bytes.toString("utf8", 0, 4) !== "glTF") throw new Error(`${relativePath(pathname)} is not a GLB file`);
  const length = bytes.readUInt32LE(8);
  let offset = 12;
  while (offset + 8 <= length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.toString("utf8", offset + 4, offset + 8);
    offset += 8;
    if (chunkType === "JSON") {
      return JSON.parse(bytes.subarray(offset, offset + chunkLength).toString("utf8").trim());
    }
    offset += chunkLength;
  }
  throw new Error(`${relativePath(pathname)} has no JSON chunk`);
}

function relativePath(pathname) {
  return relative(PKG_ROOT, pathname);
}

function lumaOf(color) {
  const red = Number(color?.[0] ?? 0);
  const green = Number(color?.[1] ?? 0);
  const blue = Number(color?.[2] ?? 0);
  return roundNumber(red * 0.2126 + green * 0.7152 + blue * 0.0722);
}

function materialCodeName(name) {
  return String(name ?? "material").replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "");
}

function roundNumber(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (value.startsWith("--level=")) parsed.level = value.slice("--level=".length);
    else if (value.startsWith("--report=")) parsed.report = value.slice("--report=".length);
  }
  return parsed;
}
