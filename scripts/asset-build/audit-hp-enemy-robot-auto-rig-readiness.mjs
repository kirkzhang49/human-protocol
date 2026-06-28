import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const reportsDir = path.join(root, "src/assets/manifests/reports");
const jsonReportPath = path.join(reportsDir, "hp_enemy_robot_auto_rig_upgrade_audit.json");
const mdReportPath = path.join(reportsDir, "hp_enemy_robot_auto_rig_upgrade_audit.md");

const REQUIRED_CLIPS = [
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
];

const LEVEL_IDS = [
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
  "level_04_memory_clinic",
  "level_05_reclamation_core",
];

const ROBOTS = [
  {
    id: "repair_drone",
    archetypes: ["repair_drone"],
    profileId: "repair_drone",
    modelKey: "hp_enemy_repair_drone_horror",
    sourceGlb: "src/assets/models/enemies/hp_enemy_repair_drone_horror.glb",
    cookedGlb: "src/assets/models-cooked/enemies/hp_enemy_repair_drone_horror.glb",
    textureAtlas: "src/assets/textures/enemies/hp_enemy_repair_drone_atlas.webp",
    emissiveMap: "src/assets/textures/enemies/hp_enemy_repair_drone_emissive.webp",
    role: "small flying repair/medical drone",
    targetHeight: 1.32,
    silhouette: { width: [0.8, 1.2], depth: [0.75, 1.25], widthToHeight: [0.62, 1.05] },
    contact: "hover",
  },
  {
    id: "clamp_bot",
    archetypes: ["clamp_bot"],
    profileId: "clamp_bot",
    modelKey: "hp_enemy_clamp_repair_horror",
    sourceGlb: "src/assets/models/enemies/hp_enemy_clamp_repair_horror.glb",
    cookedGlb: "src/assets/models-cooked/enemies/hp_enemy_clamp_repair_horror.glb",
    textureAtlas: "src/assets/textures/enemies/hp_enemy_clamp_repair_atlas.webp",
    emissiveMap: "src/assets/textures/enemies/hp_enemy_clamp_repair_emissive.webp",
    role: "low ground clamp repair robot",
    targetHeight: 1.42,
    silhouette: { width: [1.05, 1.65], depth: [0.8, 1.35], widthToHeight: [0.78, 1.25] },
    contact: "ground-low",
  },
  {
    id: "shield_tech",
    archetypes: ["shield_tech"],
    profileId: "shield_tech",
    modelKey: "hp_enemy_shield_technician_horror",
    sourceGlb: "src/assets/models/enemies/hp_enemy_shield_technician_horror.glb",
    cookedGlb: "src/assets/models-cooked/enemies/hp_enemy_shield_technician_horror.glb",
    textureAtlas: "src/assets/textures/enemies/hp_enemy_shield_technician_atlas.webp",
    emissiveMap: "src/assets/textures/enemies/hp_enemy_shield_technician_emissive.webp",
    role: "taller support/archive shield technician",
    targetHeight: 1.62,
    silhouette: { width: [0.95, 1.55], depth: [0.65, 1.25], widthToHeight: [0.55, 1.0] },
    contact: "ground-support",
  },
  {
    id: "custodian_foreman",
    archetypes: ["custodian_elite", "leader"],
    profileId: "custodian_foreman",
    modelKey: "hp_enemy_custodian_foreman_horror",
    sourceGlb: "src/assets/models/enemies/hp_enemy_custodian_foreman_horror.glb",
    cookedGlb: "src/assets/models-cooked/enemies/hp_enemy_custodian_foreman_horror.glb",
    textureAtlas: "src/assets/textures/enemies/hp_enemy_custodian_foreman_atlas.webp",
    emissiveMap: "src/assets/textures/enemies/hp_enemy_custodian_foreman_emissive.webp",
    role: "maintenance supervisor / ordinary boss platform",
    targetHeight: 2.65,
    silhouette: { width: [1.7, 2.85], depth: [1.5, 2.55], widthToHeight: [0.68, 1.15] },
    contact: "ground-heavy",
  },
  {
    id: "reclamation_mother",
    archetypes: ["custodian_elite", "boss"],
    profileId: "reclamation_mother",
    modelKey: "hp_enemy_reclamation_mother_final_horror",
    sourceGlb: "src/assets/models/enemies/hp_enemy_reclamation_mother_final_horror.glb",
    cookedGlb: "src/assets/models-cooked/enemies/hp_enemy_reclamation_mother_final_horror.glb",
    textureAtlas: "src/assets/textures/enemies/hp_enemy_reclamation_mother_final_atlas.webp",
    emissiveMap: "src/assets/textures/enemies/hp_enemy_reclamation_mother_final_emissive.webp",
    role: "Level 05 final reclamation core boss",
    targetHeight: 3.05,
    silhouette: { width: [2.1, 3.2], depth: [2.0, 3.1], widthToHeight: [0.68, 1.12] },
    contact: "ground-boss",
  },
];

const configFiles = {
  enemyModelAssets: "src/assets/enemyModelAssets.ts",
  visualProfileTs: "src/game/visual/VisualProfile.ts",
  visualProfilesJson: "src/game/config/enemyVisualProfiles.json",
  authoringValidator: "src/game/config/validation/authoringValidator.ts",
  rawHelpers: "src/render/raw-webgpu/RawWebGpuRuntimeHelpers.ts",
  rawOracle: "src/render/raw-webgpu/RawThreeEnemyOracle.tsx",
  rawAnimationBridge: "src/render/raw-webgpu/RawRobotAnimationBridge.ts",
};

const textEvidence = Object.fromEntries(
  Object.entries(configFiles).map(([key, rel]) => [key, readText(rel)]),
);
const profileConfig = readJson("src/game/config/enemyVisualProfiles.json");

const robots = ROBOTS.map((robot) => auditRobot(robot));
const report = {
  schemaVersion: "human-protocol/enemy-robot-auto-rig-readiness-audit@1",
  createdAt: new Date().toISOString(),
  source: {
    repo: root,
    plan: "docs/human-protocol-five-robot-auto-rig-upgrade-pipeline.md",
    autoRigReference:
      "/Users/zhengkaizhang/Documents/Codex/2026-06-19/human-protocol-l2-furniture-polish/references/auto-rig-3d",
    rule: "Report-only audit. Official GLBs, cooked GLBs, level refs, and generated Raw WebGPU JSON are not modified.",
  },
  scoring: {
    components: [
      "silhouetteScore",
      "supportContactScore",
      "materialCraftScore",
      "emissiveRestraintScore",
      "textureEvidenceScore",
      "runtimeIntegrationScore",
    ],
    note:
      "Scores are readiness heuristics for candidate generation and QA prioritization. They are not a final art-quality oracle.",
  },
  robots,
  summary: summarizeRobots(robots),
};

await mkdir(reportsDir, { recursive: true });
await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(mdReportPath, renderMarkdown(report), "utf8");

console.log(`Human Protocol enemy robot auto-rig readiness audit: ${robots.length} robots`);
console.log(`JSON: ${path.relative(root, jsonReportPath)}`);
console.log(`MD: ${path.relative(root, mdReportPath)}`);
console.log(`Average readiness: ${round2(report.summary.averageOverallScore)}`);
if (robots.some((robot) => robot.replacementRecommendation === "do_not_replace")) {
  process.exitCode = 1;
}

function auditRobot(robot) {
  const source = auditGlb(robot.sourceGlb);
  const cooked = auditGlb(robot.cookedGlb);
  const raw = auditRawWebGpu(robot);
  const textures = {
    atlas: fileEvidence(robot.textureAtlas),
    emissive: fileEvidence(robot.emissiveMap),
  };
  const config = auditConfig(robot);
  const runtime = auditRuntime(robot, raw, cooked);
  const scores = scoreRobot(robot, source, cooked, raw, textures, config, runtime);
  const blockers = collectBlockers(robot, scores, cooked, raw, textures, config, runtime);
  const overallScore = average(Object.values(scores));
  const replacementRecommendation = recommendation(overallScore, blockers, scores);
  return {
    id: robot.id,
    role: robot.role,
    archetypes: robot.archetypes,
    profileId: robot.profileId,
    modelKey: robot.modelKey,
    files: {
      sourceGlb: fileEvidence(robot.sourceGlb),
      cookedGlb: fileEvidence(robot.cookedGlb),
      textureAtlas: textures.atlas,
      emissiveMap: textures.emissive,
    },
    config,
    runtime,
    glb: { source, cooked },
    rawWebGpu: raw,
    scores,
    overallScore: round4(overallScore),
    blockers,
    notes: notesFor(robot, source, cooked, raw, textures, config, runtime, scores),
    nextPipelineStep:
      replacementRecommendation === "candidate_generation_ready"
        ? "Generate candidates into a candidate directory and compare with this audit before replacing official GLBs."
        : "Keep report-only until blockers are addressed or visual evidence is captured.",
    replacementRecommendation,
  };
}

function auditGlb(relPath) {
  const abs = path.join(root, relPath);
  if (!existsSync(abs)) return { exists: false, path: relPath };
  const bytes = readFileSync(abs);
  const json = parseGlbJson(bytes);
  const sceneBounds = computeSceneBounds(json);
  const animations = (json.animations ?? []).map((animation) => ({
    name: animation.name ?? "",
    channelCount: animation.channels?.length ?? 0,
    samplerCount: animation.samplers?.length ?? 0,
  }));
  const animationNames = animations.map((animation) => animation.name);
  const missingRequiredClips = REQUIRED_CLIPS.filter((clip) => !animationNames.includes(clip));
  const materials = (json.materials ?? []).map((material) => ({
    name: material.name ?? "",
    hasBaseColorTexture: Boolean(material.pbrMetallicRoughness?.baseColorTexture),
    hasMetallicRoughnessTexture: Boolean(material.pbrMetallicRoughness?.metallicRoughnessTexture),
    hasEmissiveTexture: Boolean(material.emissiveTexture),
    emissiveFactor: material.emissiveFactor ?? null,
    metallicFactor: material.pbrMetallicRoughness?.metallicFactor ?? null,
    roughnessFactor: material.pbrMetallicRoughness?.roughnessFactor ?? null,
  }));
  const images = (json.images ?? []).map((image) => ({
    name: image.name ?? "",
    uri: image.uri ?? null,
    mimeType: image.mimeType ?? null,
    embedded: typeof image.bufferView === "number",
  }));
  const nodeNames = (json.nodes ?? []).map((node) => node.name ?? "").filter(Boolean);
  return {
    exists: true,
    path: relPath,
    fileSizeBytes: bytes.byteLength,
    generator: json.asset?.generator ?? "unknown",
    sceneCount: json.scenes?.length ?? 0,
    nodeCount: json.nodes?.length ?? 0,
    meshCount: json.meshes?.length ?? 0,
    skinCount: json.skins?.length ?? 0,
    materialCount: materials.length,
    textureCount: json.textures?.length ?? 0,
    imageCount: images.length,
    materials,
    images,
    animations,
    animationNames,
    missingRequiredClips,
    firstNodeNames: nodeNames.slice(0, 16),
    nodeNameQuality: summarizeNodeNames(nodeNames),
    bounds: sceneBounds,
  };
}

function auditRawWebGpu(robot) {
  const rawDir = path.join(root, "src/assets/models-cooked/enemies", robot.modelKey, ".raw-webgpu");
  if (!existsSync(rawDir)) return { exists: false, directory: path.relative(root, rawDir), levelCoverage: [] };
  const files = readdirSync(rawDir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const sidecars = files.map((file) => {
    const rel = path.relative(root, path.join(rawDir, file));
    const json = readJson(rel);
    const geometry = json.geometry ?? {};
    const clips = Array.isArray(geometry.animationClips)
      ? geometry.animationClips.map((clip) => clip.name ?? clip.action ?? "").filter(Boolean)
      : [];
    return {
      file: rel,
      levelId: json.levelId ?? file.replace(/\.json$/u, ""),
      modelKey: json.modelKey ?? "",
      rule: json.rule ?? null,
      status: geometry.status ?? "unknown",
      rawFile: geometry.rawFile ?? null,
      rawSource: geometry.rawSource ?? null,
      vertexCount: geometry.vertexCount ?? 0,
      triangleCount: geometry.triangleCount ?? 0,
      meshCount: geometry.meshCount ?? 0,
      materialCount: geometry.materialCount ?? 0,
      nodeCount: geometry.nodeCount ?? 0,
      skinCount: geometry.skinCount ?? 0,
      rigidSkin: geometry.rigidSkin
        ? { mode: geometry.rigidSkin.mode ?? "unknown", jointCount: geometry.rigidSkin.jointCount ?? 0 }
        : null,
      bounds: geometry.bounds ?? null,
      nodeChunkCount: geometry.nodeChunks?.length ?? 0,
      animationClips: clips,
      missingRequiredClips: REQUIRED_CLIPS.filter((clip) => !clips.includes(clip)),
    };
  });
  const covered = new Set(sidecars.map((sidecar) => sidecar.levelId));
  return {
    exists: true,
    directory: path.relative(root, rawDir),
    sidecarCount: sidecars.length,
    levelCoverage: LEVEL_IDS.map((levelId) => ({ levelId, exists: covered.has(levelId) })),
    sidecars,
    representative: sidecars.find((sidecar) => sidecar.levelId === "level_05_reclamation_core") ?? sidecars[0] ?? null,
  };
}

function auditConfig(robot) {
  const visualProfile = profileConfig?.profiles?.[robot.profileId] ?? null;
  const modelAssetEvidence = {
    imported: textEvidence.enemyModelAssets.includes(`${robot.modelKey}.glb?url`),
    registered: new RegExp(`${escapeRegExp(robot.modelKey)}[\\s\\S]{0,240}warmupTargetHeight`, "u").test(
      textEvidence.enemyModelAssets,
    ),
    modelKeyForEnemy: textEvidence.enemyModelAssets.includes(`return "${robot.modelKey}"`),
  };
  const visualProfileEvidence = {
    jsonProfile: Boolean(visualProfile),
    jsonModelKeyMatches: visualProfile?.modelKey === robot.modelKey,
    tsVisualProfileReferences: textEvidence.visualProfileTs.includes(`modelKey: "${robot.modelKey}"`),
  };
  return {
    enemyVisualProfilesJson: visualProfile,
    enemyModelAssets: modelAssetEvidence,
    visualProfileTs: visualProfileEvidence,
    validator: {
      modelKeyWhitelisted: textEvidence.authoringValidator.includes(`"${robot.modelKey}"`),
    },
  };
}

function auditRuntime(robot, raw, cooked) {
  return {
    targetHeight: robot.targetHeight,
    rawHelpersTargetHeight: textEvidence.rawHelpers.includes(`"${robot.modelKey}"`) || textEvidence.rawHelpers.includes(robot.id),
    rawOracleTargetHeight: textEvidence.rawOracle.includes(`"${robot.modelKey}"`) || textEvidence.rawOracle.includes(robot.id),
    rawAnimationBridgeHasModelOverride: textEvidence.rawAnimationBridge.includes(`"${robot.modelKey}"`),
    repairDroneAltitudeRule:
      robot.id === "repair_drone"
        ? textEvidence.rawHelpers.includes('enemy.archetypeId === "repair_drone"') &&
          textEvidence.rawOracle.includes('enemy.archetypeId === "repair_drone"')
        : null,
    requiredClipsInCookedGlb: cooked.missingRequiredClips?.length === 0,
    requiredClipsInRawRepresentative: raw.representative?.missingRequiredClips?.length === 0,
  };
}

function scoreRobot(robot, source, cooked, raw, textures, config, runtime) {
  const normalized = normalizedRuntimeSize(robot, cooked.bounds);
  const silhouetteScore = average([
    rangeScore(normalized.width, robot.silhouette.width),
    rangeScore(normalized.depth, robot.silhouette.depth),
    rangeScore(normalized.widthToHeight, robot.silhouette.widthToHeight),
    source.exists && cooked.exists ? 1 : 0,
  ]);

  const minY = cooked.bounds?.min?.[1] ?? null;
  const normalizedMinY = minY === null || !cooked.bounds?.size?.[1] ? null : minY * (robot.targetHeight / cooked.bounds.size[1]);
  const supportContactScore =
    robot.contact === "hover"
      ? average([runtime.repairDroneAltitudeRule ? 1 : 0, normalizedMinY !== null && normalizedMinY < -0.02 ? 1 : 0.65, 1])
      : average([
          normalizedMinY !== null && normalizedMinY <= 0.05 ? 1 : 0.65,
          raw.representative?.bounds ? 1 : 0,
          robot.contact === "ground-low" ? rangeScore(normalized.widthToHeight, [0.78, 1.3]) : 1,
        ]);

  const materialNames = cooked.materials?.map((material) => material.name).filter(Boolean) ?? [];
  const genericMaterialNames = materialNames.filter((name) => /^PaletteMaterial\d*/u.test(name)).length;
  const materialCraftScore = average([
    cooked.materialCount >= 3 ? 0.85 : cooked.materialCount > 0 ? 0.55 : 0,
    cooked.materials?.some((material) => material.hasBaseColorTexture) ? 0.85 : 0.25,
    genericMaterialNames === 0 ? 1 : 0.45,
    textures.atlas.exists ? 0.85 : 0,
  ]);

  const glbEmissiveTextures = cooked.materials?.filter((material) => material.hasEmissiveTexture).length ?? 0;
  const emissiveRestraintScore = average([
    textures.emissive.exists || glbEmissiveTextures > 0 ? 0.85 : 0.45,
    glbEmissiveTextures <= Math.max(1, Math.ceil((cooked.materialCount || 1) * 0.34)) ? 1 : 0.55,
    robot.id === "reclamation_mother" || robot.id === "custodian_foreman" ? 0.8 : 0.9,
  ]);

  const textureEvidenceScore = average([
    cooked.imageCount > 0 ? 0.75 : 0.25,
    textures.atlas.exists ? 1 : 0,
    textures.emissive.exists ? 1 : 0.4,
    cooked.images?.some((image) => image.embedded) ? 0.85 : 0.55,
  ]);

  const runtimeIntegrationScore = average([
    config.enemyModelAssets.imported ? 1 : 0,
    config.enemyModelAssets.registered ? 1 : 0,
    config.visualProfileTs.tsVisualProfileReferences || config.visualProfileTs.jsonModelKeyMatches ? 1 : 0,
    config.validator.modelKeyWhitelisted ? 1 : 0,
    runtime.requiredClipsInCookedGlb ? 1 : 0,
    raw.sidecarCount >= LEVEL_IDS.length ? 1 : raw.sidecarCount > 0 ? 0.65 : 0,
    runtime.requiredClipsInRawRepresentative ? 1 : 0,
  ]);

  return {
    silhouetteScore: round4(silhouetteScore),
    supportContactScore: round4(supportContactScore),
    materialCraftScore: round4(materialCraftScore),
    emissiveRestraintScore: round4(emissiveRestraintScore),
    textureEvidenceScore: round4(textureEvidenceScore),
    runtimeIntegrationScore: round4(runtimeIntegrationScore),
  };
}

function collectBlockers(robot, scores, cooked, raw, textures, config, runtime) {
  const blockers = [];
  if (!cooked.exists) blockers.push("missing-cooked-glb");
  if (!config.enemyModelAssets.imported || !config.enemyModelAssets.registered) blockers.push("model-key-not-fully-registered");
  if (!config.validator.modelKeyWhitelisted) blockers.push("validator-model-key-missing");
  if (cooked.missingRequiredClips?.length) blockers.push(`missing-cooked-clips:${cooked.missingRequiredClips.join(",")}`);
  if (!runtime.requiredClipsInRawRepresentative) blockers.push("raw-webgpu-required-clips-not-proven");
  if (!textures.atlas.exists) blockers.push("missing-external-atlas");
  if (!textures.emissive.exists) blockers.push("missing-external-emissive-map");
  if (scores.materialCraftScore < 0.65) blockers.push("weak-material-slot-evidence");
  if (scores.runtimeIntegrationScore < 0.8) blockers.push("runtime-integration-incomplete");
  if (robot.id === "repair_drone" && !runtime.repairDroneAltitudeRule) blockers.push("repair-drone-altitude-rule-not-found");
  if (!raw.exists || raw.sidecarCount === 0) blockers.push("missing-raw-webgpu-sidecars");
  return blockers;
}

function notesFor(robot, source, cooked, raw, textures, config, runtime, scores) {
  const notes = [];
  const normalized = normalizedRuntimeSize(robot, cooked.bounds);
  notes.push(
    `Runtime-normalized size estimate: ${formatNumber(normalized.width)}w x ${formatNumber(normalized.height)}h x ${formatNumber(normalized.depth)}d meters.`,
  );
  if (cooked.materials?.some((material) => /^PaletteMaterial/u.test(material.name))) {
    notes.push("Cooked GLB uses generic PaletteMaterial names; next candidate should expose stable Human Protocol material slots.");
  }
  if (cooked.imageCount > 0 && textures.atlas.exists) {
    notes.push("GLB has embedded palette images and external atlas/emissive files exist; visual visibility still needs screenshot evidence.");
  }
  if (raw.representative?.rigidSkin) {
    notes.push(`Raw WebGPU representative uses ${raw.representative.rigidSkin.mode} with ${raw.representative.rigidSkin.jointCount} joints.`);
  }
  if (runtime.rawAnimationBridgeHasModelOverride) {
    notes.push("RawRobotAnimationBridge has model-specific readability overrides; new candidates should reduce exact mesh-name dependence.");
  }
  if (scores.materialCraftScore < 0.7) {
    notes.push("Material craft score is limited by generic material names or weak GLB material-slot evidence.");
  }
  if (robot.id === "repair_drone") {
    notes.push("Drone audit treats hover-centered geometry as good; official QA must still check there is no visible fake floor base.");
  }
  if (robot.id === "reclamation_mother") {
    notes.push("Final boss must remain distinct from custodian foreman; future compare pass should include foreman-vs-mother silhouette distance.");
  }
  if (!config.visualProfileTs.tsVisualProfileReferences && config.visualProfileTs.jsonModelKeyMatches) {
    notes.push("Model key is present in JSON profile but not direct VisualProfile.ts fallback; JSON/config path should remain authoritative.");
  }
  if (!source.exists) notes.push("Source GLB missing; cannot safely replace cooked asset without source provenance.");
  return notes;
}

function recommendation(overallScore, blockers, scores) {
  if (blockers.some((blocker) => blocker.startsWith("missing-cooked") || blocker.includes("not-fully-registered"))) {
    return "do_not_replace";
  }
  if (overallScore >= 0.86 && blockers.length === 0) return "candidate_generation_ready";
  if (scores.runtimeIntegrationScore >= 0.85 && scores.textureEvidenceScore >= 0.75) return "qa_required_before_replacement";
  return "report_only";
}

function renderMarkdown(input) {
  const lines = [
    "# HP Enemy Robot Auto-Rig Upgrade Audit",
    "",
    `Generated: ${input.createdAt}`,
    "",
    "This is a report-only audit for the five Human Protocol enemy robot GLBs. It adapts the auto-rig-3d habit of hard gates, visual evidence, material scoring, and proxy/candidate reporting, but it does not replace official assets.",
    "",
    "## Summary",
    "",
    `- Robots audited: ${input.summary.robotCount}`,
    `- Average readiness: ${formatNumber(input.summary.averageOverallScore)}`,
    `- Recommendation counts: ${Object.entries(input.summary.recommendationCounts)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ")}`,
    "",
    "| robot | modelKey | overall | silhouette | contact | material | emissive | texture | runtime | recommendation |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const robot of input.robots) {
    lines.push(
      `| ${robot.id} | \`${robot.modelKey}\` | ${formatNumber(robot.overallScore)} | ${formatNumber(robot.scores.silhouetteScore)} | ${formatNumber(robot.scores.supportContactScore)} | ${formatNumber(robot.scores.materialCraftScore)} | ${formatNumber(robot.scores.emissiveRestraintScore)} | ${formatNumber(robot.scores.textureEvidenceScore)} | ${formatNumber(robot.scores.runtimeIntegrationScore)} | ${robot.replacementRecommendation} |`,
    );
  }

  lines.push("", "## Robot Details", "");
  for (const robot of input.robots) {
    const cooked = robot.glb.cooked;
    const raw = robot.rawWebGpu.representative;
    lines.push(`### ${robot.id} / \`${robot.modelKey}\``);
    lines.push("");
    lines.push(`- Role: ${robot.role}`);
    lines.push(`- Source GLB: \`${robot.files.sourceGlb.path}\` (${formatBytes(robot.files.sourceGlb.fileSizeBytes)})`);
    lines.push(`- Cooked GLB: \`${robot.files.cookedGlb.path}\` (${formatBytes(robot.files.cookedGlb.fileSizeBytes)})`);
    lines.push(`- Textures: atlas ${robot.files.textureAtlas.exists ? "yes" : "no"}, emissive ${robot.files.emissiveMap.exists ? "yes" : "no"}`);
    lines.push(
      `- Cooked GLB: ${cooked.nodeCount} nodes, ${cooked.meshCount} meshes, ${cooked.materialCount} materials, ${cooked.imageCount} images, clips ${cooked.animationNames.join(", ")}`,
    );
    lines.push(
      `- Bounds: ${formatBounds(cooked.bounds)}; node names: ${robot.glb.cooked.nodeNameQuality.named}/${robot.glb.cooked.nodeNameQuality.total} named`,
    );
    if (raw) {
      lines.push(
        `- Raw representative: ${raw.levelId}, ${raw.vertexCount} vertices, ${raw.triangleCount} triangles, ${raw.nodeChunkCount} node chunks, clips ${raw.animationClips.join(", ")}`,
      );
    }
    lines.push(`- Blockers: ${robot.blockers.length ? robot.blockers.join(", ") : "none"}`);
    for (const note of robot.notes) lines.push(`- ${note}`);
    lines.push("");
  }

  lines.push("## Next Steps", "");
  lines.push("1. Use this audit as the baseline before generating any candidate GLB.");
  lines.push("2. Put candidates under `src/assets/models-cooked/enemies/auto-rig-candidates/` with source scripts and evidence.");
  lines.push("3. Do not patch generated Raw WebGPU JSON by hand; rebuild it from source if a candidate is promoted.");
  lines.push("4. Before official replacement, run `git diff --check`, `npx tsc -p tsconfig.app.json --noEmit`, relevant art/Raw QA, and capture visual evidence.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summarizeRobots(entries) {
  const recommendationCounts = {};
  for (const entry of entries) {
    recommendationCounts[entry.replacementRecommendation] = (recommendationCounts[entry.replacementRecommendation] ?? 0) + 1;
  }
  return {
    robotCount: entries.length,
    averageOverallScore: round4(average(entries.map((entry) => entry.overallScore))),
    recommendationCounts,
    lowestScores: entries
      .map((entry) => ({ id: entry.id, overallScore: entry.overallScore, materialCraftScore: entry.scores.materialCraftScore }))
      .sort((left, right) => left.overallScore - right.overallScore),
  };
}

function parseGlbJson(bytes) {
  if (bytes.toString("utf8", 0, 4) !== "glTF") throw new Error("Not a GLB file");
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.toString("utf8", offset + 4, offset + 8);
    offset += 8;
    if (chunkType === "JSON") {
      return JSON.parse(bytes.subarray(offset, offset + chunkLength).toString("utf8"));
    }
    offset += chunkLength;
  }
  throw new Error("GLB JSON chunk not found");
}

function computeSceneBounds(json) {
  const nodes = json.nodes ?? [];
  const scene = json.scenes?.[json.scene ?? 0] ?? json.scenes?.[0];
  const roots = scene?.nodes ?? nodes.map((_, index) => index);
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const visit = (nodeIndex, parentMatrix) => {
    const node = nodes[nodeIndex];
    if (!node) return;
    const world = mat4Multiply(parentMatrix, nodeMatrix(node));
    if (typeof node.mesh === "number") {
      expandMeshBounds(json.meshes?.[node.mesh], json, world, min, max);
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const rootNode of roots) visit(rootNode, mat4Identity());
  if (!Number.isFinite(min[0])) return null;
  return {
    min: min.map(round4),
    max: max.map(round4),
    center: [round4((min[0] + max[0]) / 2), round4((min[1] + max[1]) / 2), round4((min[2] + max[2]) / 2)],
    size: [round4(max[0] - min[0]), round4(max[1] - min[1]), round4(max[2] - min[2])],
  };
}

function expandMeshBounds(mesh, json, world, min, max) {
  for (const primitive of mesh?.primitives ?? []) {
    const accessorIndex = primitive.attributes?.POSITION;
    const accessor = json.accessors?.[accessorIndex];
    if (!accessor?.min || !accessor?.max) continue;
    for (const point of boundsCorners(accessor.min, accessor.max)) {
      const transformed = transformPoint(world, point);
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], transformed[axis]);
        max[axis] = Math.max(max[axis], transformed[axis]);
      }
    }
  }
}

function boundsCorners(min, max) {
  return [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
  ];
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix;
  const t = node.translation ?? [0, 0, 0];
  const r = node.rotation ?? [0, 0, 0, 1];
  const s = node.scale ?? [1, 1, 1];
  return mat4FromTrs(t, r, s);
}

function mat4FromTrs(t, q, s) {
  const [x, y, z, w] = q;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0],
    (xy + wz) * s[0],
    (xz - wy) * s[0],
    0,
    (xy - wz) * s[1],
    (1 - (xx + zz)) * s[1],
    (yz + wx) * s[1],
    0,
    (xz + wy) * s[2],
    (yz - wx) * s[2],
    (1 - (xx + yy)) * s[2],
    0,
    t[0],
    t[1],
    t[2],
    1,
  ];
}

function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function normalizedRuntimeSize(robot, bounds) {
  if (!bounds?.size?.[1]) return { width: 0, height: robot.targetHeight, depth: 0, widthToHeight: 0 };
  const scale = robot.targetHeight / Math.max(0.0001, bounds.size[1]);
  return {
    width: round4(bounds.size[0] * scale),
    height: robot.targetHeight,
    depth: round4(bounds.size[2] * scale),
    widthToHeight: round4((bounds.size[0] * scale) / robot.targetHeight),
  };
}

function summarizeNodeNames(nodeNames) {
  return {
    total: nodeNames.length,
    named: nodeNames.filter(Boolean).length,
    semanticNames: nodeNames.filter((name) => /body|head|core|arm|leg|tool|shield|sensor|thruster|clamp|root/iu.test(name)).length,
  };
}

function fileEvidence(relPath) {
  const abs = path.join(root, relPath);
  if (!existsSync(abs)) return { path: relPath, exists: false, fileSizeBytes: 0 };
  const stat = statSync(abs);
  return { path: relPath, exists: true, fileSizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
}

function readText(relPath) {
  const abs = path.join(root, relPath);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function rangeScore(value, [min, max]) {
  if (!Number.isFinite(value)) return 0;
  if (value >= min && value <= max) return 1;
  const span = Math.max(0.0001, max - min);
  if (value < min) return clamp01(1 - (min - value) / span);
  return clamp01(1 - (value - max) / span);
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "n/a";
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "missing";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function formatBounds(bounds) {
  if (!bounds?.size) return "n/a";
  return `${formatNumber(bounds.size[0])} x ${formatNumber(bounds.size[1])} x ${formatNumber(bounds.size[2])}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
