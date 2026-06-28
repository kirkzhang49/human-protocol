import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const ENEMY_ROOT = join(ROOT, "src/assets/models/enemies");
const REPORT_PATH = join(ROOT, "src/assets/manifests/reports/human_protocol_enemy_geometry_objective_v1_report.json");

const args = parseArgs(process.argv.slice(2));
const candidatesPerEnemy = positiveInt(args.candidates, 200000);
const shouldApply = args.apply === "true";
const copyWgpu = args.copyWgpu === "true";
const baseSeed = positiveInt(args.seed, 20260603);
const targetFilter = args.targets ? new Set(String(args.targets).split(",").map((item) => item.trim()).filter(Boolean)) : null;

const targets = [
  repairDroneTarget(),
  clampRepairTarget(),
  shieldTechTarget(),
  custodianForemanTarget(),
  reclamationMotherTarget(),
].filter((target) => !targetFilter || targetFilter.has(target.id));

if (targets.length === 0) {
  throw new Error(`No matching enemy geometry targets for filter ${Array.from(targetFilter ?? []).join(",")}`);
}

const report = {
  schema: "human-protocol/enemy-glb-geometry-objective-v1-report@1",
  generatedAt: new Date().toISOString(),
  applied: shouldApply,
  copiedToWgpu: copyWgpu,
  candidatesPerEnemy,
  reviewAdjustments: [
    "Detect animation target ownership before patching static TRS.",
    "Score parent-space and local-space anchors separately from world-space silhouette.",
    "Patch stun-probe animation keyframes because translation and rotation are directly animated.",
    "Avoid global Y/Z swap; repair only nodes known to have been authored in game coordinates then Blender-export converted.",
  ],
  formulas: {
    gaussianPreference: "pref(x,target,width)=exp(-((x-target)/width)^2)",
    axisConversion: "gameToBlenderExported([x,y,z])=[x,z,-y]; inverse=[x,-z,y]. Used only as a diagnostic, not as a whole-model swap.",
    anchorIntegrityScore: "weighted proximity of torso, shoulder, forearm, tool, hammer, and root-level added parts to role-specific local targets.",
    animationOverrideRisk: "hard risk when a candidate patches static translation/rotation but the same node/path is directly animated.",
    hierarchyAttachmentRisk: "hard risk when a tool sits outside the stable parent chain and distance/offset cannot be guaranteed through animation.",
  },
  targets: [],
};

for (const target of targets) {
  const path = join(ENEMY_ROOT, target.file);
  const glb = readGlb(path);
  const context = buildContext(glb.json);
  const current = target.current(context);
  const currentEvaluation = target.evaluate(current, context);
  const rng = mulberry32(hashString(`${baseSeed}:enemy-geometry-v1:${target.id}`));
  const top = [];
  let best = { index: -1, candidate: current, evaluation: currentEvaluation };

  for (let index = 0; index < candidatesPerEnemy; index += 1) {
    const candidate = target.sample(rng);
    const evaluation = target.evaluate(candidate, context);
    const entry = { index, candidate, evaluation };
    pushTop(top, entry, 12);
    if (evaluation.score > best.evaluation.score) best = entry;
  }

  if (shouldApply && best.evaluation.hardConstraints.canApply) {
    target.apply(glb, best.candidate, context);
    stampExtras(glb.json, target, best);
    writeGlb(path, glb);
  }

  report.targets.push({
    id: target.id,
    role: target.role,
    file: `src/assets/models/enemies/${target.file}`,
    currentScore: round(currentEvaluation.score),
    bestScore: round(best.evaluation.score),
    delta: round(best.evaluation.score - currentEvaluation.score),
    animationOwnership: target.ownership(context),
    currentDiagnostics: target.diagnostics(current, context),
    bestCandidate: roundObject(best.candidate),
    bestScores: roundObject(best.evaluation.scores),
    bestPenalties: roundObject(best.evaluation.penalties),
    hardConstraints: best.evaluation.hardConstraints,
    topCandidates: top.map((entry) => ({
      index: entry.index,
      score: round(entry.evaluation.score),
      candidate: roundObject(entry.candidate),
      scores: roundObject(entry.evaluation.scores),
      penalties: roundObject(entry.evaluation.penalties),
      hardConstraints: entry.evaluation.hardConstraints,
    })),
    decision: shouldApply && best.evaluation.hardConstraints.canApply ? "applied" : "report-only",
    rationale: target.rationale,
  });

  console.log(
    `${shouldApply ? "APPLY" : "REPORT"} ${target.id} current=${round(currentEvaluation.score)} best=${round(best.evaluation.score)} canApply=${
      best.evaluation.hardConstraints.canApply
    }`,
  );
}

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${REPORT_PATH}`);

if (copyWgpu && shouldApply) {
  copyFixedAssetsToWgpu(report);
}

function repairDroneTarget() {
  const id = "hp_enemy_repair_drone_horror";
  return {
    id,
    role: "small_flying_repair_drone",
    file: `${id}.glb`,
    rationale:
      "Repair drone failure is mostly local-axis authoring plus animated stun-probe override. Candidate repairs shoulder/forearm/probe anchors and bakes probe animation positions.",
    current: (ctx) => ({
      shoulderSpread: Math.abs(local(ctx, "leftShoulderPivot")[0] ?? 0.86),
      shoulderHeight: local(ctx, "leftShoulderPivot")[1] ?? 0.08,
      shoulderDepth: local(ctx, "leftShoulderPivot")[2] ?? -1.58,
      forearmLength: Math.abs(local(ctx, "part_forearm_l")[1] ?? 0.18),
      forearmDepth: local(ctx, "part_forearm_l")[2] ?? 0.46,
      probeY: local(ctx, "stun-probe")[1] ?? -0.04,
      probeZ: local(ctx, "stun-probe")[2] ?? 0,
      probeScale: averageScale(ctx, "stun-probe", 0.19),
      shoulderRoll: 0.04,
      turbineY: local(ctx, "hp_v2_left_side_turbine_ring")[1] ?? 0.08,
      turbineZ: local(ctx, "hp_v2_left_side_turbine_ring")[2] ?? -1.47,
    }),
    sample: (rng) => ({
      shoulderSpread: rand(rng, 0.78, 0.94),
      shoulderHeight: rand(rng, 1.46, 1.64),
      shoulderDepth: rand(rng, 0.03, 0.16),
      forearmLength: rand(rng, 0.4, 0.54),
      forearmDepth: rand(rng, 0.05, 0.14),
      probeY: rand(rng, 0.86, 1.06),
      probeZ: rand(rng, 0.48, 0.68),
      probeScale: rand(rng, 0.16, 0.23),
      shoulderRoll: rand(rng, 1.54, 1.72),
      turbineY: rand(rng, 1.42, 1.58),
      turbineZ: rand(rng, 0.04, 0.18),
    }),
    evaluate: (p, ctx) => {
      const ownership = ownershipFor(ctx, [
        ["leftShoulderPivot", "translation"],
        ["rightShoulderPivot", "translation"],
        ["leftShoulderPivot", "rotation"],
        ["rightShoulderPivot", "rotation"],
        ["stun-probe", "translation"],
        ["stun-probe", "rotation"],
      ]);
      const axisRepair =
        0.22 * pref(p.shoulderHeight, 1.55, 0.1) +
        0.18 * pref(p.shoulderDepth, 0.09, 0.07) +
        0.2 * pref(p.probeY, 0.96, 0.12) +
        0.2 * pref(p.probeZ, 0.58, 0.08) +
        0.2 * pref(p.turbineY, 1.5, 0.1);
      const anchors =
        0.26 * pref(p.shoulderSpread, 0.86, 0.08) +
        0.2 * pref(p.forearmLength, 0.47, 0.07) +
        0.16 * pref(p.forearmDepth, 0.08, 0.06) +
        0.18 * pref(p.probeScale, 0.19, 0.045) +
        0.2 * pref(p.shoulderRoll, 1.63, 0.08);
      const animationScore = ownership["stun-probe:translation"] && ownership["stun-probe:rotation"] ? 1 : 0.35;
      const hierarchyRisk = parentName(ctx, "stun-probe") === "Root" ? 0.08 : 0;
      return objective({
        scores: {
          coordinateFrameScore: axisRepair,
          anchorIntegrityScore: anchors,
          animationEndpointScore: animationScore,
          roleSilhouetteScore: pref(p.shoulderSpread / Math.max(0.01, p.probeScale), 4.5, 1.4),
        },
        weights: {
          coordinateFrameScore: 0.32,
          anchorIntegrityScore: 0.34,
          animationEndpointScore: 0.22,
          roleSilhouetteScore: 0.12,
        },
        penalties: {
          hierarchyAttachmentRisk: hierarchyRisk,
          overwideProbePenalty: Math.max(0, (p.probeScale - 0.225) * 2),
        },
        hardConstraints: {
          canApply: ownership["stun-probe:translation"] && ownership["stun-probe:rotation"],
          animationOverrideRisk: false,
          hierarchyAttachmentRisk: hierarchyRisk > 0,
        },
      });
    },
    apply: (glb, p, ctx) => {
      setTranslation(ctx, "torso_control", [0, 1.36, 0]);
      setTranslation(ctx, "part_head", [0, 1.7, -0.02]);
      setTranslation(ctx, "part_backpack", [0, 1.28, -0.5]);
      setTranslation(ctx, "leftShoulderPivot", [-p.shoulderSpread, p.shoulderHeight, p.shoulderDepth]);
      setTranslation(ctx, "rightShoulderPivot", [p.shoulderSpread, p.shoulderHeight, p.shoulderDepth]);
      setRotation(ctx, "leftShoulderPivot", quatFromEuler(0, 0, -p.shoulderRoll));
      setRotation(ctx, "rightShoulderPivot", quatFromEuler(0, 0, p.shoulderRoll));
      setTranslation(ctx, "part_forearm_l", [0, -p.forearmLength, p.forearmDepth]);
      setTranslation(ctx, "part_forearm_r", [0, -p.forearmLength, p.forearmDepth]);
      setTranslation(ctx, "pelvisPivot", [0, 1.04, -0.22]);
      setTranslation(ctx, "stun-probe", [0, p.probeY, p.probeZ]);
      setRotation(ctx, "stun-probe", quatFromEuler(Math.PI / 2, 0, 0));
      setScale(ctx, "stun-probe", [p.probeScale, p.probeScale * 0.82, p.probeScale]);
      patchDroneTurbines(ctx, p);
      patchRotationAnimations(glb, ctx, "leftShoulderPivot", quatFromEuler(0, 0, -p.shoulderRoll), "compose");
      patchRotationAnimations(glb, ctx, "rightShoulderPivot", quatFromEuler(0, 0, p.shoulderRoll), "compose");
      patchDroneProbeAnimation(glb, ctx, p);
    },
    diagnostics: (p, ctx) => diagnosticBlock(ctx, ["torso_control", "leftShoulderPivot", "rightShoulderPivot", "stun-probe", "hp_v2_left_side_turbine_ring"]),
    ownership: (ctx) => ownershipFor(ctx, [
      ["leftShoulderPivot", "translation"],
      ["leftShoulderPivot", "rotation"],
      ["rightShoulderPivot", "translation"],
      ["rightShoulderPivot", "rotation"],
      ["stun-probe", "translation"],
      ["stun-probe", "rotation"],
    ]),
  };
}

function clampRepairTarget() {
  return groundBotTarget({
    id: "hp_enemy_clamp_repair_horror",
    role: "stocky_ground_repair_robot",
    file: "hp_enemy_clamp_repair_horror.glb",
    shoulderSpreadTarget: 1.86,
    shoulderHeightTarget: 1.72,
    shoulderDepthTarget: 0.05,
    torsoYTarget: 1.7,
    torsoXTarget: 1.95,
    torsoZTarget: 0.82,
    rationale: "Clamp bot shoulder pivots were exported into depth. Fix shoulder height/depth so the stocky walking robot keeps visible shoulders.",
  });
}

function shieldTechTarget() {
  return groundBotTarget({
    id: "hp_enemy_shield_technician_horror",
    role: "shield_technician",
    file: "hp_enemy_shield_technician_horror.glb",
    shoulderSpreadTarget: 1.66,
    shoulderHeightTarget: 1.68,
    shoulderDepthTarget: 0.05,
    torsoYTarget: 1.68,
    torsoXTarget: 1.7,
    torsoZTarget: 0.88,
    rationale: "Shield technician uses the same local-axis repair family, but keeps a slightly narrower shoulder span than the clamp bot.",
  });
}

function groundBotTarget(config) {
  return {
    ...config,
    current: (ctx) => ({
      shoulderSpread: Math.abs(local(ctx, "leftShoulderPivot")[0] ?? config.shoulderSpreadTarget),
      shoulderHeight: local(ctx, "leftShoulderPivot")[1] ?? 0.05,
      shoulderDepth: local(ctx, "leftShoulderPivot")[2] ?? -config.shoulderHeightTarget,
      torsoY: local(ctx, "torso_control")[1] ?? 0,
      torsoDepth: local(ctx, "torso_control")[2] ?? -config.torsoYTarget,
      torsoXScale: scaleOf(ctx, "torso_control", 0, config.torsoXTarget),
      torsoZScale: scaleOf(ctx, "torso_control", 2, config.torsoZTarget),
    }),
    sample: (rng) => ({
      shoulderSpread: rand(rng, config.shoulderSpreadTarget - 0.14, config.shoulderSpreadTarget + 0.14),
      shoulderHeight: rand(rng, config.shoulderHeightTarget - 0.1, config.shoulderHeightTarget + 0.1),
      shoulderDepth: rand(rng, config.shoulderDepthTarget - 0.06, config.shoulderDepthTarget + 0.08),
      torsoY: rand(rng, config.torsoYTarget - 0.08, config.torsoYTarget + 0.08),
      torsoDepth: rand(rng, -0.04, 0.08),
      torsoXScale: rand(rng, config.torsoXTarget - 0.16, config.torsoXTarget + 0.16),
      torsoZScale: rand(rng, config.torsoZTarget - 0.1, config.torsoZTarget + 0.1),
    }),
    evaluate: (p, ctx) => {
      const ownership = ownershipFor(ctx, [
        ["leftShoulderPivot", "translation"],
        ["rightShoulderPivot", "translation"],
        ["leftShoulderPivot", "rotation"],
        ["rightShoulderPivot", "rotation"],
      ]);
      const animationOverrideRisk = ownership["leftShoulderPivot:translation"] || ownership["rightShoulderPivot:translation"];
      return objective({
        scores: {
          coordinateFrameScore:
            0.35 * pref(p.shoulderHeight, config.shoulderHeightTarget, 0.1) +
            0.25 * pref(p.shoulderDepth, config.shoulderDepthTarget, 0.07) +
            0.25 * pref(p.torsoY, config.torsoYTarget, 0.08) +
            0.15 * pref(p.torsoDepth, 0, 0.07),
          shoulderVisibilityScore:
            0.5 * pref(p.shoulderSpread, config.shoulderSpreadTarget, 0.13) +
            0.25 * pref(p.torsoXScale, config.torsoXTarget, 0.18) +
            0.25 * pref(p.torsoZScale, config.torsoZTarget, 0.12),
          animationSafetyScore: animationOverrideRisk ? 0 : 1,
        },
        weights: { coordinateFrameScore: 0.44, shoulderVisibilityScore: 0.42, animationSafetyScore: 0.14 },
        penalties: { animationOverrideRisk: animationOverrideRisk ? 1 : 0 },
        hardConstraints: {
          canApply: !animationOverrideRisk,
          animationOverrideRisk,
          hierarchyAttachmentRisk: false,
        },
      });
    },
    apply: (_glb, p, ctx) => {
      setTranslation(ctx, "torso_control", [0, p.torsoY, p.torsoDepth]);
      patchScaleComponent(ctx, "torso_control", 0, p.torsoXScale);
      patchScaleComponent(ctx, "torso_control", 2, p.torsoZScale);
      setTranslation(ctx, "leftShoulderPivot", [-p.shoulderSpread, p.shoulderHeight, p.shoulderDepth]);
      setTranslation(ctx, "rightShoulderPivot", [p.shoulderSpread, p.shoulderHeight, p.shoulderDepth]);
    },
    diagnostics: (_p, ctx) => diagnosticBlock(ctx, ["torso_control", "leftShoulderPivot", "rightShoulderPivot", "left-utility-hand", "right-utility-hand"]),
    ownership: (ctx) => ownershipFor(ctx, [
      ["leftShoulderPivot", "translation"],
      ["leftShoulderPivot", "rotation"],
      ["rightShoulderPivot", "translation"],
      ["rightShoulderPivot", "rotation"],
    ]),
  };
}

function custodianForemanTarget() {
  return hammerBossTarget({
    id: "hp_enemy_custodian_foreman_horror",
    role: "hammer_foreman_boss",
    file: "hp_enemy_custodian_foreman_horror.glb",
    hammerLength: 1.2098,
    hammerHead: 0.5845,
    shoulderArmorY: 2.05,
    rationale: "Foreman body is mostly correct; the newly added hammer/shoulder armor root nodes were authored through Blender's converted axis.",
  });
}

function reclamationMotherTarget() {
  return hammerBossTarget({
    id: "hp_enemy_reclamation_mother_final_horror",
    role: "final_hammer_boss",
    file: "hp_enemy_reclamation_mother_final_horror.glb",
    hammerLength: 1.3162,
    hammerHead: 0.6934,
    shoulderArmorY: 2.12,
    rationale: "Final boss keeps its large body, but the added service hammer and shoulder armor need game-axis local anchors for readable hammer silhouette.",
  });
}

function hammerBossTarget(config) {
  return {
    ...config,
    current: (ctx) => ({
      wrenchX: local(ctx, "utility-wrench")[0] ?? 0.9,
      wrenchY: local(ctx, "utility-wrench")[1] ?? -0.48,
      wrenchZ: local(ctx, "utility-wrench")[2] ?? -0.8,
      hammerHandleY: local(ctx, "hp_v2_service_hammer_handle")[1] ?? -0.48,
      shoulderArmorY: local(ctx, "hp_v2_left_hammer_boss_shoulder_armor")[1] ?? 0,
      shoulderArmorZ: local(ctx, "hp_v2_left_hammer_boss_shoulder_armor")[2] ?? -2.05,
      hammerHeadScale: scaleOf(ctx, "hp_v2_service_hammer_head", 0, 0.12),
    }),
    sample: (rng) => ({
      wrenchX: rand(rng, 0.82, 1.02),
      wrenchY: rand(rng, 0.72, 0.98),
      wrenchZ: rand(rng, -0.58, -0.34),
      hammerHandleY: rand(rng, 0.74, 0.98),
      shoulderArmorY: rand(rng, config.shoulderArmorY - 0.1, config.shoulderArmorY + 0.08),
      shoulderArmorZ: rand(rng, -0.06, 0.1),
      hammerHeadScale: rand(rng, config.hammerHead * 0.2, config.hammerHead * 0.28),
    }),
    evaluate: (p, ctx) => {
      const ownership = ownershipFor(ctx, [
        ["utility-wrench", "translation"],
        ["hp_v2_service_hammer_handle", "translation"],
        ["hp_v2_service_hammer_head", "translation"],
      ]);
      const hierarchyRisk = parentName(ctx, "hp_v2_service_hammer_handle") ? 0 : 0.05;
      const animationOverrideRisk = Object.values(ownership).some(Boolean);
      return objective({
        scores: {
          toolAttachmentScore:
            0.28 * pref(p.wrenchX, 0.92, 0.12) +
            0.24 * pref(p.wrenchY, 0.84, 0.14) +
            0.2 * pref(p.wrenchZ, -0.48, 0.12) +
            0.14 * pref(p.hammerHandleY, 0.86, 0.14) +
            0.14 * pref(p.hammerHeadScale, config.hammerHead * 0.24, 0.06),
          shoulderArmorScore: 0.55 * pref(p.shoulderArmorY, config.shoulderArmorY, 0.12) + 0.45 * pref(p.shoulderArmorZ, 0.02, 0.08),
          animationSafetyScore: animationOverrideRisk ? 0 : 1,
        },
        weights: { toolAttachmentScore: 0.48, shoulderArmorScore: 0.36, animationSafetyScore: 0.16 },
        penalties: { hierarchyAttachmentRisk: hierarchyRisk, animationOverrideRisk: animationOverrideRisk ? 1 : 0 },
        hardConstraints: {
          canApply: !animationOverrideRisk,
          animationOverrideRisk,
          hierarchyAttachmentRisk: hierarchyRisk > 0,
        },
      });
    },
    apply: (_glb, p, ctx) => {
      setTranslation(ctx, "utility-wrench", [p.wrenchX, p.wrenchY, p.wrenchZ]);
      setRotation(ctx, "utility-wrench", quatFromEuler(0.15, -0.12, -0.72));
      setScale(ctx, "utility-wrench", [config.hammerLength, config.hammerLength * 0.8, config.hammerLength]);
      setScale(ctx, "utility-wrench-handle", [0.72, config.hammerLength * 1.35, 0.72]);
      setTranslation(ctx, "hp_v2_service_hammer_handle", [p.wrenchX, p.hammerHandleY, p.wrenchZ - 0.02]);
      setRotation(ctx, "hp_v2_service_hammer_handle", quatFromEuler(0.14, -0.08, -0.72));
      setScale(ctx, "hp_v2_service_hammer_handle", [0.035, config.hammerLength * 0.54, 0.035]);
      setTranslation(ctx, "hp_v2_service_hammer_head", [p.wrenchX + 0.18, p.hammerHandleY + 0.36, p.wrenchZ - 0.12]);
      setRotation(ctx, "hp_v2_service_hammer_head", quatFromEuler(0.14, -0.08, -0.72));
      setScale(ctx, "hp_v2_service_hammer_head", [p.hammerHeadScale, config.hammerHead * 0.16, config.hammerHead * 0.12]);
      setTranslation(ctx, "hp_v2_service_hammer_cyan_load_cell", [p.wrenchX + 0.18, p.hammerHandleY + 0.36, p.wrenchZ + 0.02]);
      setRotation(ctx, "hp_v2_service_hammer_cyan_load_cell", quatFromEuler(0.14, -0.08, -0.72));
      setScale(ctx, "hp_v2_service_hammer_cyan_load_cell", [config.hammerHead * 0.16, 0.012, 0.014]);
      setTranslation(ctx, "hp_v2_left_hammer_boss_shoulder_armor", [-0.72, p.shoulderArmorY, p.shoulderArmorZ]);
      setTranslation(ctx, "hp_v2_right_hammer_boss_shoulder_armor", [0.72, p.shoulderArmorY, p.shoulderArmorZ]);
      setScale(ctx, "hp_v2_left_hammer_boss_shoulder_armor", [0.26, 0.12, 0.22]);
      setScale(ctx, "hp_v2_right_hammer_boss_shoulder_armor", [0.26, 0.12, 0.22]);
    },
    diagnostics: (_p, ctx) =>
      diagnosticBlock(ctx, [
        "utility-wrench",
        "utility-wrench-handle",
        "hp_v2_service_hammer_handle",
        "hp_v2_service_hammer_head",
        "hp_v2_left_hammer_boss_shoulder_armor",
      ]),
    ownership: (ctx) => ownershipFor(ctx, [
      ["utility-wrench", "translation"],
      ["utility-wrench", "rotation"],
      ["hp_v2_service_hammer_handle", "translation"],
      ["hp_v2_service_hammer_head", "translation"],
    ]),
  };
}

function patchDroneTurbines(ctx, p) {
  for (const [sideName, sign] of [
    ["left", -1],
    ["right", 1],
  ]) {
    const x = sign * p.shoulderSpread * 1.06;
    for (const suffix of ["side_turbine_ring", "side_turbine_core", "turbine_blade_a", "turbine_blade_b"]) {
      setTranslation(ctx, `hp_v2_${sideName}_${suffix}`, [x, p.turbineY, p.turbineZ]);
    }
    setTranslation(ctx, `hp_v2_${sideName}_thin_spar`, [x * 0.52, p.turbineY, p.turbineZ]);
    setScale(ctx, `hp_v2_${sideName}_thin_spar`, [Math.abs(x) * 0.42, 0.018, 0.018]);
  }
}

function patchDroneProbeAnimation(glb, ctx, p) {
  const nodeIndex = ctx.nodeIndex.get("stun-probe");
  if (nodeIndex === undefined) return;
  for (const anim of glb.json.animations ?? []) {
    const name = normalizeClipName(anim.name ?? "");
    for (const channel of anim.channels ?? []) {
      if (channel.target?.node !== nodeIndex) continue;
      const sampler = anim.samplers?.[channel.sampler];
      if (!sampler) continue;
      if (channel.target.path === "translation") {
        const count = accessorCount(glb, sampler.output);
        writeAccessor(glb, sampler.output, (index) => {
          const t = count <= 1 ? 0 : index / (count - 1);
          if (name === "attack_windup") return [0, p.probeY + 0.04 * t, p.probeZ + 0.12 * t];
          if (name === "attack_strike") return [0, p.probeY + Math.sin(t * Math.PI) * 0.03, p.probeZ + 0.18 + Math.sin(t * Math.PI) * 0.18];
          if (name === "attack_recover") return [0, p.probeY + 0.04 * (1 - t), p.probeZ + 0.1 * (1 - t)];
          return [0, p.probeY, p.probeZ];
        });
      }
      if (channel.target.path === "rotation") {
        const q = quatFromEuler(Math.PI / 2, 0, 0);
        writeAccessor(glb, sampler.output, () => q);
      }
    }
  }
}

function patchRotationAnimations(glb, ctx, nodeName, baseQuat, mode = "replace") {
  const nodeIndex = ctx.nodeIndex.get(nodeName);
  if (nodeIndex === undefined) return;
  for (const anim of glb.json.animations ?? []) {
    for (const channel of anim.channels ?? []) {
      if (channel.target?.node !== nodeIndex || channel.target.path !== "rotation") continue;
      const sampler = anim.samplers?.[channel.sampler];
      if (!sampler) continue;
      const values = readAccessor(glb, sampler.output);
      writeAccessor(glb, sampler.output, (index) => {
        const current = values[index] ?? [0, 0, 0, 1];
        return mode === "compose" ? quatNormalize(quatMultiply(baseQuat, current)) : baseQuat;
      });
    }
  }
}

function buildContext(json) {
  const nodeIndex = new Map();
  const parent = new Map();
  for (const [index, node] of (json.nodes ?? []).entries()) {
    if (node.name) nodeIndex.set(node.name, index);
    for (const child of node.children ?? []) parent.set(child, index);
  }
  const animationTargets = new Map();
  for (const anim of json.animations ?? []) {
    for (const channel of anim.channels ?? []) {
      const node = json.nodes?.[channel.target?.node];
      if (!node?.name || !channel.target?.path) continue;
      const key = `${node.name}:${channel.target.path}`;
      if (!animationTargets.has(key)) animationTargets.set(key, []);
      animationTargets.get(key).push(normalizeClipName(anim.name ?? "unnamed"));
    }
  }
  return { json, nodeIndex, parent, animationTargets };
}

function diagnosticBlock(ctx, names) {
  const out = {};
  for (const name of names) {
    const index = ctx.nodeIndex.get(name);
    if (index === undefined) {
      out[name] = { present: false };
      continue;
    }
    const node = ctx.json.nodes[index];
    out[name] = {
      present: true,
      index,
      parent: parentName(ctx, name),
      translation: roundArray(node.translation ?? [0, 0, 0]),
      rotation: roundArray(node.rotation ?? [0, 0, 0, 1]),
      scale: roundArray(node.scale ?? [1, 1, 1]),
      animationTargets: Object.fromEntries(
        ["translation", "rotation", "scale"].map((path) => [path, ctx.animationTargets.get(`${name}:${path}`) ?? []]),
      ),
      inverseAxisTranslation: node.translation ? roundArray(inverseBlenderAxis(node.translation)) : undefined,
    };
  }
  return out;
}

function ownershipFor(ctx, pairs) {
  const out = {};
  for (const [node, path] of pairs) out[`${node}:${path}`] = ctx.animationTargets.has(`${node}:${path}`);
  return out;
}

function parentName(ctx, nodeName) {
  const index = ctx.nodeIndex.get(nodeName);
  if (index === undefined) return null;
  const parent = ctx.parent.get(index);
  return parent === undefined ? null : ctx.json.nodes[parent]?.name ?? `node_${parent}`;
}

function local(ctx, nodeName) {
  return ctx.json.nodes[ctx.nodeIndex.get(nodeName)]?.translation ?? [];
}

function averageScale(ctx, nodeName, fallback) {
  const scale = ctx.json.nodes[ctx.nodeIndex.get(nodeName)]?.scale;
  if (!scale) return fallback;
  return (scale[0] + scale[1] + scale[2]) / 3;
}

function scaleOf(ctx, nodeName, axis, fallback) {
  return ctx.json.nodes[ctx.nodeIndex.get(nodeName)]?.scale?.[axis] ?? fallback;
}

function setTranslation(ctx, nodeName, value) {
  const node = ctx.json.nodes[ctx.nodeIndex.get(nodeName)];
  if (node) node.translation = value.map(roundFloat);
}

function setRotation(ctx, nodeName, value) {
  const node = ctx.json.nodes[ctx.nodeIndex.get(nodeName)];
  if (node) node.rotation = value.map(roundFloat);
}

function setScale(ctx, nodeName, value) {
  const node = ctx.json.nodes[ctx.nodeIndex.get(nodeName)];
  if (node) node.scale = value.map(roundFloat);
}

function patchScaleComponent(ctx, nodeName, axis, value) {
  const node = ctx.json.nodes[ctx.nodeIndex.get(nodeName)];
  if (!node) return;
  node.scale = node.scale ?? [1, 1, 1];
  node.scale[axis] = roundFloat(value);
}

function inverseBlenderAxis(v) {
  return [v[0], -v[2], v[1]];
}

function objective({ scores, weights, penalties = {}, hardConstraints = { canApply: true } }) {
  let score = 0;
  for (const [key, value] of Object.entries(scores)) score += (weights[key] ?? 0) * clamp01(value);
  let penalty = 0;
  for (const value of Object.values(penalties)) penalty += Math.max(0, value);
  return {
    score: Math.max(0, score * 100 - penalty * 18),
    scores,
    penalties,
    hardConstraints,
  };
}

function pref(value, target, width) {
  return Math.exp(-(((value - target) / width) ** 2));
}

function readGlb(path) {
  const buffer = readFileSync(path);
  if (buffer.toString("utf8", 0, 4) !== "glTF") throw new Error(`${path} is not a GLB`);
  const chunks = [];
  let json = null;
  let bin = null;
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString("utf8", offset + 4, offset + 8);
    offset += 8;
    const data = Buffer.from(buffer.subarray(offset, offset + length));
    chunks.push({ type, data });
    if (type === "JSON") json = JSON.parse(data.toString("utf8").trim());
    if (type === "BIN\0") bin = data;
    offset += length;
  }
  if (!json || !bin) throw new Error(`${path} missing JSON or BIN chunk`);
  return { json, bin, chunks };
}

function writeGlb(path, glb) {
  glb.json.buffers = glb.json.buffers ?? [{ byteLength: glb.bin.length }];
  glb.json.buffers[0].byteLength = glb.bin.length;
  const jsonBuffer = padChunk(Buffer.from(JSON.stringify(glb.json), "utf8"), 0x20);
  const binBuffer = padChunk(glb.bin, 0x00);
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
  const out = Buffer.alloc(totalLength);
  out.write("glTF", 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);
  let offset = 12;
  out.writeUInt32LE(jsonBuffer.length, offset);
  out.write("JSON", offset + 4);
  offset += 8;
  jsonBuffer.copy(out, offset);
  offset += jsonBuffer.length;
  out.writeUInt32LE(binBuffer.length, offset);
  out.write("BIN\0", offset + 4);
  offset += 8;
  binBuffer.copy(out, offset);
  writeFileSync(path, out);
}

function padChunk(buffer, padByte) {
  const paddedLength = Math.ceil(buffer.length / 4) * 4;
  if (paddedLength === buffer.length) return buffer;
  const out = Buffer.alloc(paddedLength, padByte);
  buffer.copy(out);
  return out;
}

function accessorCount(glb, accessorIndex) {
  return glb.json.accessors[accessorIndex]?.count ?? 0;
}

function readAccessor(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  if (!accessor) return [];
  const bufferView = glb.json.bufferViews[accessor.bufferView];
  if (!bufferView || accessor.componentType !== 5126) return [];
  const components = componentCount(accessor.type);
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView.byteStride ?? components * 4;
  const values = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const item = [];
    for (let component = 0; component < components; component += 1) {
      item.push(glb.bin.readFloatLE(start + index * stride + component * 4));
    }
    values.push(item);
  }
  return values;
}

function writeAccessor(glb, accessorIndex, valueAt) {
  const accessor = glb.json.accessors[accessorIndex];
  if (!accessor) return;
  const bufferView = glb.json.bufferViews[accessor.bufferView];
  if (!bufferView || accessor.componentType !== 5126) return;
  const components = componentCount(accessor.type);
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView.byteStride ?? components * 4;
  for (let index = 0; index < accessor.count; index += 1) {
    const values = valueAt(index);
    for (let component = 0; component < components; component += 1) {
      glb.bin.writeFloatLE(Number(values[component] ?? 0), start + index * stride + component * 4);
    }
  }
  delete accessor.min;
  delete accessor.max;
}

function componentCount(type) {
  if (type === "SCALAR") return 1;
  if (type === "VEC2") return 2;
  if (type === "VEC3") return 3;
  if (type === "VEC4") return 4;
  if (type === "MAT4") return 16;
  throw new Error(`Unsupported accessor type ${type}`);
}

function stampExtras(json, target, best) {
  json.asset = json.asset ?? { version: "2.0" };
  json.asset.extras = {
    ...(json.asset.extras ?? {}),
    humanProtocolGeometryObjectiveV1: {
      targetId: target.id,
      appliedAt: new Date().toISOString(),
      score: round(best.evaluation.score),
      candidate: roundObject(best.candidate),
    },
  };
}

function copyFixedAssetsToWgpu(reportData) {
  const wgRoot = "/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/enemies";
  const manifestPath = join(wgRoot, "human-protocol-enemy-horror-manifest.json");
  mkdirSync(wgRoot, { recursive: true });
  const copied = [];
  for (const target of reportData.targets) {
    if (target.decision !== "applied") continue;
    const source = join(ROOT, target.file);
    const id = `${target.id}_fixed_v1`;
    const destinationFile = `${id}.glb`;
    const destination = join(wgRoot, destinationFile);
    writeFileSync(destination, readFileSync(source));
    copied.push({ id, source: target.file, file: `public/assets/enemies/${destinationFile}` });
  }
  let manifest = { schema: "human-protocol/enemy-horror-assets@1", assets: [] };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    // Keep a minimal manifest if the lab does not have one yet.
  }
  manifest.fixedV1 = copied;
  manifest.updatedAt = new Date().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`copied ${copied.length} fixed GLBs to ${wgRoot}`);
}

function quatFromEuler(x, y, z) {
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);
  return quatNormalize([
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ]);
}

function quatMultiply(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function quatNormalize(q) {
  const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return q.map((value) => value / length);
}

function normalizeClipName(name) {
  return name.replace(/\.\d+$/, "");
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rand(rng, min, max) {
  return min + (max - min) * rng();
}

function pushTop(top, entry, limit) {
  top.push(entry);
  top.sort((a, b) => b.evaluation.score - a.evaluation.score);
  if (top.length > limit) top.length = limit;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function roundFloat(value) {
  return Math.round(Number(value) * 1000000) / 1000000;
}

function roundArray(values) {
  return values.map(roundFloat);
}

function roundObject(value) {
  if (Array.isArray(value)) return value.map(roundObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundObject(item)]));
  }
  return typeof value === "number" ? round(value) : value;
}
