import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const MODEL_ROOT = join(ROOT, "src/assets/models");
const REPORT_PATH = join(ROOT, "src/assets/manifests/reports/human_protocol_asset_math_polish_v1_report.json");

const args = parseArgs(process.argv.slice(2));
const candidatesPerAsset = positiveInt(args.candidates, 500000);
const shouldApply = args.apply !== "false";
const targetFilter = args.targets ? new Set(String(args.targets).split(",").map((item) => item.trim())) : null;
const baseSeed = positiveInt(args.seed, 20260603);

const paperPrinciples = [
  "Use typed part programs and named affordances instead of freeform mesh edits.",
  "Hard constraints gate candidates before soft aesthetic scores.",
  "Optimize a multi-objective function: silhouette, support, contact, material response, runtime readability, and repairability.",
  "Keep mesh truth deterministic; LLM/prompt knowledge only informs weights and target ranges.",
  "Write a machine-readable report so the next repair pass starts from evidence, not chat memory.",
];

const targetPrograms = [
  repairDroneProgram(),
  clampRobotProgram(),
  shieldTechnicianProgram(),
  custodianProgram(),
  reclamationMotherProgram(),
  repairBayProgram(),
  cabinetProgram(),
  tableProgram(),
  chairProgram(),
  lockerProgram(),
].filter((program) => !targetFilter || targetFilter.has(program.id));

if (targetPrograms.length === 0) {
  throw new Error(`No matching targets. Requested ${Array.from(targetFilter ?? []).join(",") || "(none)"}.`);
}

const report = {
  schema: "human-protocol/asset-math-polish-report@1",
  generatedAt: new Date().toISOString(),
  sourceMaterials: [
    "/Users/zhengkaizhang/Downloads/面向 Agent 的程序化与精确建模游戏引擎研究报告.pdf",
    "/Users/zhengkaizhang/.codex/attachments/b996d584-12e0-4e05-8d69-bff6bff0620f/pasted-text.txt",
    "docs/human-protocol-agent-native-asset-lab-vnext.md",
  ],
  paperPrinciples,
  candidatesPerAsset,
  applied: shouldApply,
  formulas: {
    weightedObjective:
      "score = sum(w_i * softScore_i) - penalty; hard constraints clamp support/contact/readability before acceptance.",
    gaussianPreference: "pref(x,target,width)=exp(-((x-target)/width)^2)",
    supportProxy:
      "supportScore combines footprint width/depth, center-of-mass height, foot/plinth/contact scaling, and no-floating-part proxy.",
    silhouetteProxy:
      "role silhouette compares width/height/depth ratios, limb span, head/torso balance, and readable negative space.",
    pbrResponse:
      "PBR score favors metallic hard-surface parts with controlled roughness and non-white emissive glow under Level 01 cyan/red lighting.",
    affordanceReadability:
      "handles, rails, screen strips, icons, warning bands, and tool silhouettes must be larger than detail noise but not billboard-like.",
    repairScope:
      "Only named GLB nodes and material factors are changed; model keys, manifests, collision references, and level configs remain stable.",
  },
  targets: [],
};

for (const program of targetPrograms) {
  const glbPath = join(MODEL_ROOT, program.file);
  const glb = readGlb(glbPath);
  const rng = mulberry32(hashString(`${baseSeed}:${program.id}`));
  const current = program.current(glb.json);
  const currentEvaluation = program.evaluate(current);
  const top = [];
  let best = { candidate: current, evaluation: currentEvaluation, index: -1 };

  for (let index = 0; index < candidatesPerAsset; index += 1) {
    const candidate = program.sample(rng);
    const evaluation = program.evaluate(candidate);
    if (evaluation.score > best.evaluation.score) {
      best = { candidate, evaluation, index };
    }
    pushTop(top, { candidate, evaluation, index }, 12);
  }

  if (shouldApply) {
    program.apply(glb.json, best.candidate);
    stampAssetExtras(glb.json, program, best);
    writeGlb(glbPath, glb.chunks, glb.json);
  }

  report.targets.push({
    id: program.id,
    kind: program.kind,
    file: program.file,
    candidatesEvaluated: candidatesPerAsset,
    currentScore: round(currentEvaluation.score),
    bestScore: round(best.evaluation.score),
    scoreDelta: round(best.evaluation.score - currentEvaluation.score),
    bestCandidateIndex: best.index,
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
    })),
    decision: shouldApply ? "applied" : "report-only",
    rationale: program.rationale,
  });

  console.log(
    `${shouldApply ? "APPLIED" : "REPORT"} ${program.id} current=${round(currentEvaluation.score)} best=${round(
      best.evaluation.score,
    )} delta=${round(best.evaluation.score - currentEvaluation.score)} candidates=${candidatesPerAsset}`,
  );
}

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${REPORT_PATH}`);

function repairDroneProgram() {
  return {
    id: "hp_enemy_repair_drone_horror",
    kind: "robot",
    file: "enemies/hp_enemy_repair_drone_horror.glb",
    rationale:
      "Small flying maintenance enemy should be slimmer, arms should read as lateral drone/tool spars, and the pelvis/leg mass should almost disappear.",
    current: () => ({
      torsoX: 0.78,
      torsoY: 0.58,
      torsoZ: 0.72,
      shoulderSpread: 0.68,
      shoulderHeight: 1.44,
      shoulderRoll: 1.571,
      armThickness: 0.3,
      forearmLength: 0.38,
      handScale: 0.34,
      headScale: 0.48,
      backpackZ: 0.62,
      pelvisScale: 0.015,
      coreScale: 0.46,
      probeScale: 0.26,
      metal: 0.78,
      rough: 0.3,
      coreEmit: 0.82,
    }),
    sample: (rng) => ({
      torsoX: rand(rng, 0.64, 0.78),
      torsoY: rand(rng, 0.48, 0.6),
      torsoZ: rand(rng, 0.6, 0.75),
      shoulderSpread: rand(rng, 0.72, 0.86),
      shoulderHeight: rand(rng, 1.42, 1.58),
      shoulderRoll: rand(rng, 1.52, 1.7),
      armThickness: rand(rng, 0.21, 0.3),
      forearmLength: rand(rng, 0.36, 0.5),
      handScale: rand(rng, 0.24, 0.34),
      headScale: rand(rng, 0.42, 0.54),
      backpackZ: rand(rng, 0.46, 0.62),
      pelvisScale: rand(rng, 0.004, 0.014),
      coreScale: rand(rng, 0.32, 0.44),
      probeScale: rand(rng, 0.18, 0.27),
      metal: rand(rng, 0.68, 0.86),
      rough: rand(rng, 0.24, 0.42),
      coreEmit: rand(rng, 0.72, 1.2),
    }),
    evaluate: (p) => {
      const silhouette =
        0.24 * pref(p.torsoX, 0.7, 0.08) +
        0.16 * pref(p.torsoY, 0.54, 0.06) +
        0.14 * pref(p.shoulderSpread, 0.8, 0.07) +
        0.16 * pref(p.shoulderRoll, 1.62, 0.08) +
        0.14 * pref(p.armThickness, 0.25, 0.05) +
        0.16 * pref(p.pelvisScale, 0.008, 0.006);
      const roleRead =
        0.34 * pref(p.forearmLength, 0.44, 0.07) +
        0.24 * pref(p.coreScale, 0.38, 0.07) +
        0.22 * pref(p.probeScale, 0.22, 0.05) +
        0.2 * pref(p.headScale, 0.48, 0.07);
      const material = pbrScore(p.metal, p.rough, p.coreEmit, 0.96);
      const floatPenalty = Math.max(0, (p.pelvisScale - 0.012) * 16) + Math.max(0, (p.armThickness - 0.285) * 5);
      return objective({
        scores: {
          roleSilhouetteScore: silhouette,
          aerialFrameScore: roleRead,
          pbrMaterialScore: material,
          repairScopeScore: 1,
        },
        weights: { roleSilhouetteScore: 0.38, aerialFrameScore: 0.32, pbrMaterialScore: 0.2, repairScopeScore: 0.1 },
        penalties: { floatOrChunkyPenalty: floatPenalty },
      });
    },
    apply: (json, p) => {
      const map = nodesByName(json);
      setNodeIf(map, "torso_control", { translation: [0, 1.36, 0], scale: [p.torsoX, p.torsoY, p.torsoZ] });
      setNodeIf(map, "part_head", { translation: [0, 1.7, -0.02], scale: [p.headScale, p.headScale * 0.88, p.headScale] });
      setNodeIf(map, "part_backpack", { translation: [0, 1.28, -0.5], scale: [p.torsoX * 0.9, 0.48, p.backpackZ] });
      setNodeIf(map, "leftShoulderPivot", {
        translation: [-p.shoulderSpread, p.shoulderHeight, 0.08],
        rotation: quatFromEuler(0, 0, -p.shoulderRoll),
      });
      setNodeIf(map, "rightShoulderPivot", {
        translation: [p.shoulderSpread, p.shoulderHeight, 0.08],
        rotation: quatFromEuler(0, 0, p.shoulderRoll),
      });
      for (const side of ["l", "r"]) {
        setNodeIf(map, `part_arm_${side}`, { scale: [p.armThickness, 0.3, p.armThickness * 1.12] });
        setNodeIf(map, `part_forearm_${side}`, { translation: [0, -p.forearmLength, 0.08], scale: [p.armThickness, p.forearmLength, p.armThickness * 1.16] });
        setNodeIf(map, `part_hand_${side}`, { scale: [p.handScale, p.handScale, p.handScale] });
      }
      setNodeIf(map, "pelvisPivot", { translation: [0, 1.04, -0.22], scale: [p.pelvisScale, p.pelvisScale, p.pelvisScale] });
      setNodeIf(map, "drone_red_core_ring", { scale: [p.coreScale, p.coreScale, p.coreScale] });
      setNodeIf(map, "stun-probe", {
        translation: [0, 0.94, 0.52],
        rotation: quatFromEuler(Math.PI / 2, 0, 0),
        scale: [p.probeScale, p.probeScale * 0.85, p.probeScale],
      });
      polishRobotMaterials(json, p);
    },
  };
}

function clampRobotProgram() {
  return {
    id: "hp_enemy_clamp_repair_horror",
    kind: "robot",
    file: "enemies/hp_enemy_clamp_repair_horror.glb",
    rationale:
      "Ground maintenance robot should be visibly stockier than the flying unit, with wider torso, broader feet, and clearer clamp/tool attack affordance.",
    current: () => ({
      torsoX: 1.82,
      torsoY: 0.74,
      torsoZ: 1.54,
      headX: 1.12,
      shoulderSpread: 1.64,
      armScale: 1.34,
      forearmScale: 1.46,
      handScale: 1.44,
      hipSpread: 0.82,
      legScale: 1.34,
      footScale: 1,
      pelvisX: 1.66,
      cutterScale: 1.28,
      metal: 0.78,
      rough: 0.32,
      coreEmit: 0.9,
    }),
    sample: (rng) => ({
      torsoX: rand(rng, 1.86, 2.22),
      torsoY: rand(rng, 0.68, 0.86),
      torsoZ: rand(rng, 1.5, 1.82),
      headX: rand(rng, 1.02, 1.28),
      shoulderSpread: rand(rng, 1.66, 1.92),
      armScale: rand(rng, 1.34, 1.68),
      forearmScale: rand(rng, 1.42, 1.78),
      handScale: rand(rng, 1.38, 1.78),
      hipSpread: rand(rng, 0.82, 1.04),
      legScale: rand(rng, 1.28, 1.62),
      footScale: rand(rng, 1.08, 1.36),
      pelvisX: rand(rng, 1.62, 1.96),
      cutterScale: rand(rng, 1.22, 1.58),
      metal: rand(rng, 0.7, 0.88),
      rough: rand(rng, 0.26, 0.42),
      coreEmit: rand(rng, 0.76, 1.12),
    }),
    evaluate: (p) => {
      const stocky =
        0.28 * pref(p.torsoX / p.torsoY, 2.55, 0.42) +
        0.18 * pref(p.torsoZ, 1.68, 0.22) +
        0.16 * pref(p.pelvisX, 1.78, 0.2) +
        0.16 * pref(p.legScale, 1.44, 0.2) +
        0.12 * pref(p.footScale, 1.2, 0.18) +
        0.1 * pref(p.headX, 1.14, 0.14);
      const affordance =
        0.34 * pref(p.handScale, 1.58, 0.22) +
        0.28 * pref(p.cutterScale, 1.42, 0.2) +
        0.22 * pref(p.shoulderSpread, 1.78, 0.18) +
        0.16 * pref(p.forearmScale, 1.58, 0.2);
      const support = 0.5 * pref(p.hipSpread, 0.94, 0.14) + 0.5 * pref(p.footScale, 1.2, 0.16);
      const penalty = Math.max(0, (p.torsoX - 2.12) * 2.2) + Math.max(0, (p.handScale - 1.7) * 1.4);
      return objective({
        scores: {
          roleSilhouetteScore: stocky,
          attackAffordanceScore: affordance,
          supportPolygonScore: support,
          pbrMaterialScore: pbrScore(p.metal, p.rough, p.coreEmit, 0.9),
        },
        weights: { roleSilhouetteScore: 0.34, attackAffordanceScore: 0.28, supportPolygonScore: 0.18, pbrMaterialScore: 0.2 },
        penalties: { overBulkPenalty: penalty },
      });
    },
    apply: (json, p) => {
      const map = nodesByName(json);
      setNodeIf(map, "torso_control", { translation: [0, 1.7, 0], scale: [p.torsoX, p.torsoY, p.torsoZ] });
      setNodeIf(map, "part_head", { translation: [0, 2.18, 0.08], scale: [p.headX, 0.62, p.headX * 0.92] });
      setNodeIf(map, "part_backpack", { translation: [0, -0.08, 0], scale: [p.torsoX * 0.9, 0.86, p.torsoZ * 0.9] });
      setNodeIf(map, "leftShoulderPivot", { translation: [-p.shoulderSpread, 1.72, 0.05] });
      setNodeIf(map, "rightShoulderPivot", { translation: [p.shoulderSpread, 1.72, 0.05] });
      for (const side of ["l", "r"]) {
        setNodeIf(map, `part_arm_${side}`, { scale: [p.armScale, 0.86, p.armScale * 0.88] });
        setNodeIf(map, `part_forearm_${side}`, { translation: [0, -0.7, 0.08], scale: [p.forearmScale, 0.98, p.forearmScale * 0.86] });
        const handScale = p.handScale * 0.42;
        setNodeIf(map, side === "l" ? "left-utility-hand" : "right-utility-hand", {
          translation: [0, -0.58, 0.16],
          scale: [handScale, handScale * 0.74, handScale * 0.9],
        });
      }
      setNodeIf(map, "pelvisPivot", { translation: [0, 0.78, 0], scale: [p.pelvisX, 0.92, p.torsoZ * 0.88] });
      setNodeIf(map, "leftHipPivot", { translation: [-p.hipSpread, 0, 0.02] });
      setNodeIf(map, "rightHipPivot", { translation: [p.hipSpread, 0, 0.02] });
      for (const side of ["l", "r"]) {
        setNodeIf(map, `part_leg_${side}`, { scale: [p.legScale, 0.7, p.legScale * 0.86] });
        setNodeIf(map, `part_foot_${side}`, { scale: [p.footScale, 0.92, p.footScale * 0.9] });
      }
      setNodeIf(map, "service-cutter", { translation: [0, 0.1, 0.12], scale: [p.cutterScale, 0.9, p.cutterScale * 0.9] });
      polishRobotMaterials(json, p);
    },
  };
}

function custodianProgram() {
  return {
    id: "hp_enemy_custodian_foreman_horror",
    kind: "robot",
    file: "enemies/hp_enemy_custodian_foreman_horror.glb",
    rationale:
      "Supervisor robot should feel like a compact heavy foreman with a readable wrench/hammer threat, but the blocky foot mass should not dominate the silhouette.",
    current: () => ({
      torsoX: 1.22,
      torsoY: 1.02,
      torsoZ: 1.18,
      legScale: 1.2,
      footX: 0.68,
      footY: 0.72,
      footZ: 0.62,
      ankleY: -1.02,
      wrenchX: 0.76,
      wrenchY: 0.74,
      handScale: 1.18,
      metal: 0.78,
      rough: 0.3,
      coreEmit: 0.9,
    }),
    sample: (rng) => ({
      torsoX: rand(rng, 1.08, 1.28),
      torsoY: rand(rng, 0.88, 1.02),
      torsoZ: rand(rng, 1.08, 1.28),
      legScale: rand(rng, 1.08, 1.28),
      footX: rand(rng, 0.44, 0.66),
      footY: rand(rng, 0.48, 0.68),
      footZ: rand(rng, 0.46, 0.62),
      ankleY: rand(rng, -0.98, -0.84),
      wrenchX: rand(rng, 0.86, 1.16),
      wrenchY: rand(rng, 0.86, 1.22),
      handScale: rand(rng, 1.1, 1.32),
      metal: rand(rng, 0.7, 0.88),
      rough: rand(rng, 0.24, 0.38),
      coreEmit: rand(rng, 0.78, 1.16),
    }),
    evaluate: (p) => {
      const foreman =
        0.2 * pref(p.torsoX, 1.18, 0.14) +
        0.18 * pref(p.torsoY, 0.94, 0.1) +
        0.16 * pref(p.legScale, 1.18, 0.14) +
        0.2 * pref(p.footX, 0.54, 0.1) +
        0.14 * pref(p.ankleY, -0.9, 0.1) +
        0.12 * pref(p.handScale, 1.22, 0.13);
      const threat = 0.58 * pref(p.wrenchX, 1.02, 0.18) + 0.42 * pref(p.wrenchY, 1.05, 0.18);
      const footPenalty = Math.max(0, (p.footX - 0.62) * 4) + Math.max(0, (p.footY - 0.64) * 3);
      return objective({
        scores: {
          compactBossSilhouetteScore: foreman,
          toolThreatReadScore: threat,
          pbrMaterialScore: pbrScore(p.metal, p.rough, p.coreEmit, 0.92),
          noFootBlockScore: pref(p.footX, 0.54, 0.12),
        },
        weights: { compactBossSilhouetteScore: 0.34, toolThreatReadScore: 0.26, pbrMaterialScore: 0.2, noFootBlockScore: 0.2 },
        penalties: { footBlockPenalty: footPenalty },
      });
    },
    apply: (json, p) => {
      applyCustodianLike(json, p);
    },
  };
}

function shieldTechnicianProgram() {
  return {
    id: "hp_enemy_shield_technician_horror",
    kind: "robot",
    file: "enemies/hp_enemy_shield_technician_horror.glb",
    rationale:
      "Shield technician should read as a compact defensive service robot with side shields and rescue baton visible, without becoming a wide flat wall.",
    current: () => ({
      torsoX: 1.28,
      torsoY: 0.96,
      torsoZ: 1.16,
      shoulderSpread: 1.42,
      armScale: 1.14,
      forearmScale: 1.22,
      handScale: 1.16,
      shieldScale: 1,
      batonScale: 1,
      footScale: 0.9,
      metal: 0.78,
      rough: 0.32,
      coreEmit: 0.9,
    }),
    sample: (rng) => ({
      torsoX: rand(rng, 1.24, 1.56),
      torsoY: rand(rng, 0.82, 1.0),
      torsoZ: rand(rng, 1.08, 1.34),
      shoulderSpread: rand(rng, 1.38, 1.68),
      armScale: rand(rng, 1.08, 1.34),
      forearmScale: rand(rng, 1.12, 1.42),
      handScale: rand(rng, 1.08, 1.34),
      shieldScale: rand(rng, 1.08, 1.38),
      batonScale: rand(rng, 1.02, 1.34),
      footScale: rand(rng, 0.9, 1.16),
      metal: rand(rng, 0.68, 0.86),
      rough: rand(rng, 0.24, 0.4),
      coreEmit: rand(rng, 0.74, 1.12),
    }),
    evaluate: (p) => {
      const defensive =
        0.24 * pref(p.torsoX, 1.4, 0.18) +
        0.16 * pref(p.torsoY, 0.9, 0.1) +
        0.18 * pref(p.shoulderSpread, 1.52, 0.16) +
        0.24 * pref(p.shieldScale, 1.22, 0.16) +
        0.18 * pref(p.footScale, 1.02, 0.12);
      const affordance =
        0.36 * pref(p.shieldScale, 1.22, 0.16) +
        0.3 * pref(p.batonScale, 1.16, 0.16) +
        0.18 * pref(p.forearmScale, 1.26, 0.16) +
        0.16 * pref(p.handScale, 1.18, 0.14);
      const penalty = Math.max(0, (p.shieldScale - 1.34) * 2.5) + Math.max(0, (p.torsoX - 1.52) * 1.6);
      return objective({
        scores: {
          defensiveSilhouetteScore: defensive,
          shieldAndBatonReadScore: affordance,
          supportPolygonScore: pref(p.footScale, 1.02, 0.14),
          pbrMaterialScore: pbrScore(p.metal, p.rough, p.coreEmit, 0.88),
        },
        weights: { defensiveSilhouetteScore: 0.32, shieldAndBatonReadScore: 0.3, supportPolygonScore: 0.16, pbrMaterialScore: 0.22 },
        penalties: { flatWallPenalty: penalty },
      });
    },
    apply: (json, p) => {
      const map = nodesByName(json);
      setNodeIf(map, "torso_control", { scale: [p.torsoX, p.torsoY, p.torsoZ] });
      setNodeIf(map, "leftShoulderPivot", { translation: [-p.shoulderSpread, 1.68, 0.05] });
      setNodeIf(map, "rightShoulderPivot", { translation: [p.shoulderSpread, 1.68, 0.05] });
      for (const side of ["l", "r"]) {
        setNodeIf(map, `part_arm_${side}`, { scale: [p.armScale, 0.84, p.armScale * 0.9] });
        setNodeIf(map, `part_forearm_${side}`, { scale: [p.forearmScale, 0.92, p.forearmScale * 0.9] });
        setNodeIf(map, side === "l" ? "left-utility-hand" : "right-utility-hand", { scale: [p.handScale, p.handScale * 0.9, p.handScale] });
        setNodeIf(map, `part_foot_${side}`, { scale: [p.footScale, p.footScale * 0.82, p.footScale * 0.86] });
      }
      scaleMatching(map, /shield_(left|right)_black_panel/, [p.shieldScale, p.shieldScale, p.shieldScale]);
      scaleMatching(map, /rescue-baton/, [p.batonScale, p.batonScale, p.batonScale]);
      polishRobotMaterials(json, p);
    },
  };
}

function reclamationMotherProgram() {
  return {
    id: "hp_enemy_reclamation_mother_final_horror",
    kind: "robot",
    file: "enemies/hp_enemy_reclamation_mother_final_horror.glb",
    rationale:
      "Final mother robot should keep boss identity panels and archive spine readable, with a threatening tool silhouette and reduced blocky feet.",
    current: () => ({
      torsoX: 1.22,
      torsoY: 1.02,
      torsoZ: 1.18,
      legScale: 1.2,
      footX: 0.68,
      footY: 0.72,
      footZ: 0.62,
      ankleY: -1.02,
      wrenchX: 0.76,
      wrenchY: 0.74,
      handScale: 1.18,
      identityScale: 1,
      spineScale: 1,
      metal: 0.78,
      rough: 0.3,
      coreEmit: 0.9,
    }),
    sample: (rng) => ({
      torsoX: rand(rng, 1.16, 1.38),
      torsoY: rand(rng, 0.86, 1.02),
      torsoZ: rand(rng, 1.14, 1.36),
      legScale: rand(rng, 1.1, 1.34),
      footX: rand(rng, 0.42, 0.64),
      footY: rand(rng, 0.46, 0.66),
      footZ: rand(rng, 0.44, 0.62),
      ankleY: rand(rng, -0.96, -0.82),
      wrenchX: rand(rng, 0.96, 1.28),
      wrenchY: rand(rng, 0.98, 1.34),
      handScale: rand(rng, 1.14, 1.38),
      identityScale: rand(rng, 1.06, 1.34),
      spineScale: rand(rng, 1.04, 1.3),
      metal: rand(rng, 0.7, 0.88),
      rough: rand(rng, 0.24, 0.38),
      coreEmit: rand(rng, 0.82, 1.22),
    }),
    evaluate: (p) => {
      const boss =
        0.18 * pref(p.torsoX, 1.26, 0.14) +
        0.14 * pref(p.torsoY, 0.94, 0.1) +
        0.16 * pref(p.legScale, 1.2, 0.16) +
        0.18 * pref(p.footX, 0.52, 0.1) +
        0.16 * pref(p.identityScale, 1.18, 0.16) +
        0.18 * pref(p.spineScale, 1.16, 0.16);
      const threat = 0.4 * pref(p.wrenchX, 1.12, 0.2) + 0.3 * pref(p.wrenchY, 1.16, 0.22) + 0.3 * pref(p.handScale, 1.24, 0.16);
      const footPenalty = Math.max(0, (p.footX - 0.6) * 4) + Math.max(0, (p.identityScale - 1.3) * 2);
      return objective({
        scores: {
          finalBossSilhouetteScore: boss,
          archiveIdentityReadScore: 0.5 * pref(p.identityScale, 1.18, 0.16) + 0.5 * pref(p.spineScale, 1.16, 0.16),
          toolThreatReadScore: threat,
          pbrMaterialScore: pbrScore(p.metal, p.rough, p.coreEmit, 0.98),
        },
        weights: { finalBossSilhouetteScore: 0.3, archiveIdentityReadScore: 0.24, toolThreatReadScore: 0.24, pbrMaterialScore: 0.22 },
        penalties: { footOrPanelOvergrowthPenalty: footPenalty },
      });
    },
    apply: (json, p) => {
      applyCustodianLike(json, p);
      const map = nodesByName(json);
      scaleMatching(map, /mother_identity_panel_/, [p.identityScale, p.identityScale, p.identityScale]);
      scaleMatching(map, /mother_archive_spine/, [p.spineScale, p.spineScale, p.spineScale]);
    },
  };
}

function repairBayProgram() {
  return furnitureProgram({
    id: "hp_hero_maintenance_repair_bay",
    file: "environment/level01/hp_hero_maintenance_repair_bay.glb",
    rationale:
      "Hero maintenance bed should read as a high-value restraint/repair asset: cleaner rails, stronger medical blue strips, tighter cable clutter, and grounded piston contact.",
    current: () => ({
      rail: 1,
      post: 1,
      restraint: 1,
      blueStrip: 1,
      console: 1,
      cable: 1,
      piston: 1,
      plinth: 1,
      metal: 0.72,
      rough: 0.34,
      emissive: 0.78,
    }),
    sample: (rng) => ({
      rail: rand(rng, 0.96, 1.14),
      post: rand(rng, 0.9, 1.1),
      restraint: rand(rng, 1.05, 1.28),
      blueStrip: rand(rng, 1.06, 1.32),
      console: rand(rng, 0.95, 1.18),
      cable: rand(rng, 0.58, 0.86),
      piston: rand(rng, 1.02, 1.24),
      plinth: rand(rng, 1.0, 1.18),
      metal: rand(rng, 0.68, 0.86),
      rough: rand(rng, 0.24, 0.42),
      emissive: rand(rng, 0.65, 1.08),
    }),
    evaluate: (p) => evaluateFurniture(p, {
      silhouette: 0.26 * pref(p.rail, 1.06, 0.11) + 0.2 * pref(p.post, 1, 0.11) + 0.24 * pref(p.plinth, 1.1, 0.12) + 0.3 * pref(p.piston, 1.12, 0.14),
      affordance: 0.42 * pref(p.restraint, 1.16, 0.12) + 0.38 * pref(p.blueStrip, 1.2, 0.14) + 0.2 * pref(p.console, 1.08, 0.12),
      contact: 0.62 * pref(p.plinth, 1.1, 0.12) + 0.38 * pref(p.piston, 1.12, 0.14),
      clutterPenalty: Math.max(0, (p.cable - 0.82) * 2.5),
      pbr: pbrScore(p.metal, p.rough, p.emissive, 0.9),
    }),
    apply: (json, p) => {
      const map = nodesByName(json);
      scaleMatching(map, /side_guard_rail_|center_service_channel/, [1, 1, p.rail]);
      scaleMatching(map, /rail_post_/, [p.post, p.post, p.post]);
      scaleMatching(map, /restraint_lock_block_|recessed_restraint_slot_/, [p.restraint, 1, p.restraint]);
      scaleMatching(map, /blue_read_strip|blue_slot|head_console_screen_blue|head_console_scan_strip|underside_cyan_service_glow/, [p.blueStrip, 1, 1]);
      scaleMatching(map, /head_console_/, [p.console, p.console, p.console]);
      scaleMatching(map, /cable_loop|hanging_black_cable|round_cable_socket/, [p.cable, p.cable, p.cable]);
      scaleMatching(map, /hydraulic_lift_piston|hydraulic_black_sleeve/, [p.piston, p.piston, p.piston]);
      scaleMatching(map, /deep_shadow_plinth|segmented_lift_base/, [p.plinth, 1, p.plinth]);
      polishFurnitureMaterials(json, p);
    },
  });
}

function cabinetProgram() {
  return furnitureProgram({
    id: "hp_room_maintenance_supply_cabinet",
    file: "environment/props/hp_room_maintenance_supply_cabinet.glb",
    rationale:
      "Maintenance supply cabinet is a first-seen hero prop; doors, handles, medical/energy marks, vents, and warning bands must read without paper-like detached decals.",
    current: () => ({
      door: 1,
      handle: 1,
      icon: 1,
      slit: 1,
      vent: 1,
      trim: 1,
      hazard: 1,
      plinth: 1,
      metal: 0.72,
      rough: 0.38,
      emissive: 0.7,
    }),
    sample: (rng) => ({
      door: rand(rng, 0.98, 1.12),
      handle: rand(rng, 1.08, 1.36),
      icon: rand(rng, 1.08, 1.4),
      slit: rand(rng, 1.06, 1.34),
      vent: rand(rng, 0.9, 1.18),
      trim: rand(rng, 1.03, 1.24),
      hazard: rand(rng, 0.82, 1.08),
      plinth: rand(rng, 1.04, 1.22),
      metal: rand(rng, 0.66, 0.84),
      rough: rand(rng, 0.3, 0.48),
      emissive: rand(rng, 0.58, 0.94),
    }),
    evaluate: (p) => evaluateFurniture(p, {
      silhouette: 0.38 * pref(p.door, 1.05, 0.1) + 0.28 * pref(p.trim, 1.12, 0.12) + 0.2 * pref(p.plinth, 1.12, 0.12) + 0.14 * pref(p.vent, 1.04, 0.14),
      affordance: 0.34 * pref(p.handle, 1.22, 0.16) + 0.28 * pref(p.icon, 1.24, 0.16) + 0.24 * pref(p.slit, 1.18, 0.15) + 0.14 * pref(p.hazard, 0.94, 0.12),
      contact: pref(p.plinth, 1.12, 0.12),
      clutterPenalty: Math.max(0, (p.icon - 1.34) * 2) + Math.max(0, (p.hazard - 1.04) * 1.5),
      pbr: pbrScore(p.metal, p.rough, p.emissive, 0.78),
    }),
    apply: (json, p) => {
      const map = nodesByName(json);
      scaleMatching(map, /left_door$|right_door$/, [p.door, 1, p.door]);
      scaleMatching(map, /handle/, [p.handle, p.handle, p.handle]);
      scaleMatching(map, /medkit_icon|energy_label/, [p.icon, p.icon, p.icon]);
      scaleMatching(map, /status_slit/, [p.slit, p.slit, p.slit]);
      scaleMatching(map, /vent_slit/, [p.vent, p.vent, p.vent]);
      scaleMatching(map, /image2_frame_trim|door_outline_trim|protocol_motif/, [p.trim, p.trim, p.trim]);
      scaleMatching(map, /hazard_band|black_slash|warning_strip/, [p.hazard, p.hazard, p.hazard]);
      scaleMatching(map, /plinth|toe_kick|top_heavy_cap/, [p.plinth, 1, p.plinth]);
      polishFurnitureMaterials(json, p);
    },
  });
}

function tableProgram() {
  return furnitureProgram({
    id: "hp_room_table_utility",
    file: "environment/props/hp_room_table_utility.glb",
    rationale:
      "Utility table should look like a usable repair surface, not scattered flat decals: stronger shelf/legs, controlled wires, clearer datapad glow and tool tray.",
    current: () => ({
      top: 1,
      leg: 1,
      shelf: 1,
      lip: 1,
      datapad: 1,
      cable: 1,
      tool: 1,
      grime: 1,
      metal: 0.64,
      rough: 0.42,
      emissive: 0.7,
    }),
    sample: (rng) => ({
      top: rand(rng, 1.0, 1.12),
      leg: rand(rng, 1.05, 1.28),
      shelf: rand(rng, 1.05, 1.24),
      lip: rand(rng, 1.03, 1.22),
      datapad: rand(rng, 1.08, 1.34),
      cable: rand(rng, 0.62, 0.92),
      tool: rand(rng, 0.9, 1.16),
      grime: rand(rng, 0.62, 0.92),
      metal: rand(rng, 0.66, 0.86),
      rough: rand(rng, 0.26, 0.42),
      emissive: rand(rng, 0.6, 0.98),
    }),
    evaluate: (p) => evaluateFurniture(p, {
      silhouette: 0.26 * pref(p.top, 1.06, 0.08) + 0.28 * pref(p.leg, 1.14, 0.14) + 0.22 * pref(p.shelf, 1.14, 0.12) + 0.24 * pref(p.lip, 1.12, 0.12),
      affordance: 0.38 * pref(p.datapad, 1.2, 0.16) + 0.26 * pref(p.tool, 1.02, 0.12) + 0.22 * pref(p.cable, 0.76, 0.12) + 0.14 * pref(p.grime, 0.76, 0.12),
      contact: 0.7 * pref(p.leg, 1.14, 0.14) + 0.3 * pref(p.shelf, 1.14, 0.12),
      clutterPenalty: Math.max(0, (p.cable - 0.88) * 2.2) + Math.max(0, (p.grime - 0.88) * 1.6),
      pbr: pbrScore(p.metal, p.rough, p.emissive, 0.8),
    }),
    apply: (json, p) => {
      const map = nodesByName(json);
      scaleMatching(map, /body_top|surface_inset_panel|tool_tray_recess/, [p.top, 1, p.top]);
      scaleMatching(map, /leg_/, [p.leg, p.leg, p.leg]);
      scaleMatching(map, /lower_shelf/, [p.shelf, 1, p.shelf]);
      scaleMatching(map, /front_lip|warning_edge/, [p.lip, p.lip, p.lip]);
      scaleMatching(map, /surface_datapad/, [p.datapad, p.datapad, p.datapad]);
      scaleMatching(map, /wire_bundle|cable_coil/, [p.cable, p.cable, p.cable]);
      scaleMatching(map, /loose_driver|tool_id_label/, [p.tool, p.tool, p.tool]);
      scaleMatching(map, /smudge|tray_shadow/, [p.grime, p.grime, p.grime]);
      polishFurnitureMaterials(json, p);
    },
  });
}

function chairProgram() {
  return furnitureProgram({
    id: "hp_room_chair_service",
    file: "environment/props/hp_room_chair_service.glb",
    rationale:
      "Service chair should read as sturdy clinical furniture with stable feet, thicker arms, cleaner pads, and a sharper headrest accent.",
    current: () => ({
      seat: 1,
      back: 1,
      arm: 1,
      foot: 1,
      leg: 1,
      pad: 1,
      head: 1,
      accent: 1,
      metal: 0.64,
      rough: 0.38,
      emissive: 0.55,
    }),
    sample: (rng) => ({
      seat: rand(rng, 1.02, 1.18),
      back: rand(rng, 1.02, 1.2),
      arm: rand(rng, 1.08, 1.32),
      foot: rand(rng, 1.08, 1.34),
      leg: rand(rng, 1.02, 1.22),
      pad: rand(rng, 1.02, 1.18),
      head: rand(rng, 1.06, 1.32),
      accent: rand(rng, 0.96, 1.18),
      metal: rand(rng, 0.62, 0.82),
      rough: rand(rng, 0.28, 0.44),
      emissive: rand(rng, 0.46, 0.78),
    }),
    evaluate: (p) => evaluateFurniture(p, {
      silhouette: 0.2 * pref(p.seat, 1.1, 0.1) + 0.2 * pref(p.back, 1.1, 0.11) + 0.18 * pref(p.arm, 1.18, 0.13) + 0.18 * pref(p.leg, 1.12, 0.12) + 0.14 * pref(p.head, 1.18, 0.15) + 0.1 * pref(p.pad, 1.1, 0.1),
      affordance: 0.38 * pref(p.arm, 1.18, 0.14) + 0.28 * pref(p.head, 1.18, 0.14) + 0.2 * pref(p.accent, 1.06, 0.12) + 0.14 * pref(p.pad, 1.1, 0.1),
      contact: 0.64 * pref(p.foot, 1.2, 0.16) + 0.36 * pref(p.leg, 1.12, 0.12),
      clutterPenalty: Math.max(0, (p.foot - 1.3) * 1.5),
      pbr: pbrScore(p.metal, p.rough, p.emissive, 0.68),
    }),
    apply: (json, p) => {
      const map = nodesByName(json);
      scaleMatching(map, /body_seat|socket_sit/, [p.seat, 1, p.seat]);
      scaleMatching(map, /back_panel|socket_attach_back/, [p.back, p.back, p.back]);
      scaleMatching(map, /side_arm_/, [p.arm, p.arm, p.arm]);
      scaleMatching(map, /foot_pad_/, [p.foot, p.foot, p.foot]);
      scaleMatching(map, /leg_/, [p.leg, p.leg, p.leg]);
      scaleMatching(map, /seat_pad|back_soft_pad/, [p.pad, p.pad, p.pad]);
      scaleMatching(map, /head_rest|headrest/, [p.head, p.head, p.head]);
      scaleMatching(map, /art_color_block|color_insert/, [p.accent, p.accent, p.accent]);
      polishFurnitureMaterials(json, p);
    },
  });
}

function lockerProgram() {
  return furnitureProgram({
    id: "hp_room_locker_low",
    file: "environment/props/hp_room_locker_low.glb",
    rationale:
      "Low locker should stop feeling like a flat box: stronger inset doors, better handles, controlled vents, grounded plinth and cleaner top cap.",
    current: () => ({
      door: 1,
      handle: 1,
      vent: 1,
      groove: 1,
      idPlate: 1,
      cap: 1,
      plinth: 1,
      accent: 1,
      metal: 0.64,
      rough: 0.4,
      emissive: 0.55,
    }),
    sample: (rng) => ({
      door: rand(rng, 1.02, 1.18),
      handle: rand(rng, 1.12, 1.38),
      vent: rand(rng, 0.94, 1.18),
      groove: rand(rng, 1.04, 1.24),
      idPlate: rand(rng, 1.04, 1.26),
      cap: rand(rng, 1.04, 1.22),
      plinth: rand(rng, 1.06, 1.28),
      accent: rand(rng, 0.92, 1.14),
      metal: rand(rng, 0.64, 0.84),
      rough: rand(rng, 0.28, 0.46),
      emissive: rand(rng, 0.42, 0.7),
    }),
    evaluate: (p) => evaluateFurniture(p, {
      silhouette: 0.3 * pref(p.door, 1.1, 0.1) + 0.22 * pref(p.cap, 1.12, 0.12) + 0.22 * pref(p.plinth, 1.16, 0.14) + 0.26 * pref(p.groove, 1.12, 0.12),
      affordance: 0.34 * pref(p.handle, 1.24, 0.16) + 0.22 * pref(p.vent, 1.04, 0.12) + 0.24 * pref(p.idPlate, 1.14, 0.12) + 0.2 * pref(p.accent, 1.02, 0.12),
      contact: pref(p.plinth, 1.16, 0.14),
      clutterPenalty: Math.max(0, (p.handle - 1.34) * 1.4),
      pbr: pbrScore(p.metal, p.rough, p.emissive, 0.66),
    }),
    apply: (json, p) => {
      const map = nodesByName(json);
      scaleMatching(map, /locker_door|door_inset_trim/, [p.door, 1, p.door]);
      scaleMatching(map, /handle/, [p.handle, p.handle, p.handle]);
      scaleMatching(map, /vent_slit/, [p.vent, p.vent, p.vent]);
      scaleMatching(map, /panel_groove/, [p.groove, p.groove, p.groove]);
      scaleMatching(map, /id_plate/, [p.idPlate, p.idPlate, p.idPlate]);
      scaleMatching(map, /top_beveled_cap|top_dust_panel/, [p.cap, 1, p.cap]);
      scaleMatching(map, /bottom_plinth|toe_shadow/, [p.plinth, 1, p.plinth]);
      scaleMatching(map, /color_art_color_block/, [p.accent, p.accent, p.accent]);
      polishFurnitureMaterials(json, p);
    },
  });
}

function furnitureProgram(config) {
  return {
    ...config,
    kind: "furniture",
  };
}

function evaluateFurniture(p, terms) {
  return objective({
    scores: {
      premiumSilhouetteScore: terms.silhouette,
      affordanceReadabilityScore: terms.affordance,
      contactShadowProxyScore: terms.contact,
      pbrMaterialScore: terms.pbr,
      agentRepairabilityScore: 1,
    },
    weights: {
      premiumSilhouetteScore: 0.27,
      affordanceReadabilityScore: 0.27,
      contactShadowProxyScore: 0.18,
      pbrMaterialScore: 0.2,
      agentRepairabilityScore: 0.08,
    },
    penalties: {
      clutterOrStickerPenalty: terms.clutterPenalty,
      overEmissivePenalty: Math.max(0, ((p.emissive ?? 0.75) - 1.02) * 1.5),
    },
  });
}

function applyCustodianLike(json, p) {
  const map = nodesByName(json);
  setNodeIf(map, "torso_control", { scale: [p.torsoX, p.torsoY, p.torsoZ] });
  for (const side of ["l", "r"]) {
    setNodeIf(map, `part_leg_${side}`, { scale: [p.legScale, 1.02, p.legScale * 0.9] });
    setNodeIf(map, side === "l" ? "leftAnklePivot" : "rightAnklePivot", { translation: [0, p.ankleY, 0.26] });
    setNodeIf(map, `part_foot_${side}`, { scale: [p.footX, p.footY, p.footZ] });
    setNodeIf(map, side === "l" ? "left-utility-hand" : "right-utility-hand", { scale: [p.handScale, p.handScale * 0.92, p.handScale] });
  }
  setNodeIf(map, "utility-wrench", {
    translation: [0.88, 0.82, -0.46],
    rotation: quatFromEuler(0.22, 0.06, -0.34),
    scale: [p.wrenchX, p.wrenchY, p.wrenchX],
  });
  setNodeIf(map, "utility-wrench-handle", { scale: [p.wrenchX * 0.92, p.wrenchY, p.wrenchX * 0.92] });
  removeAnimationChannelsForNode(json, "utility-wrench");
  polishRobotMaterials(json, p);
}

function objective({ scores, weights, penalties }) {
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += weight * clamp01(scores[key] ?? 0);
  }
  const penaltyTotal = Object.values(penalties).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
  const hardConstraints = {
    noDetachedPartsProxy: penaltyTotal < 0.45,
    readableAffordanceProxy:
      (scores.affordanceReadabilityScore ?? scores.attackAffordanceScore ?? scores.aerialFrameScore ?? 0) >= 0.55,
    stableSupportProxy:
      (scores.supportPolygonScore ?? scores.contactShadowProxyScore ?? scores.noFootBlockScore ?? scores.aerialFrameScore ?? 0) >= 0.5,
  };
  const hardFailPenalty = Object.values(hardConstraints).every(Boolean) ? 0 : 0.18;
  return {
    score: Math.max(0, 100 * total - 100 * penaltyTotal - 100 * hardFailPenalty),
    scores,
    penalties: { ...penalties, hardFailPenalty },
    hardConstraints,
  };
}

function pbrScore(metal, rough, emissive, targetEmissive) {
  return 0.35 * pref(metal, 0.76, 0.14) + 0.35 * pref(rough, 0.34, 0.12) + 0.3 * pref(emissive, targetEmissive, 0.22);
}

function polishRobotMaterials(json, p) {
  for (const material of json.materials ?? []) {
    material.pbrMetallicRoughness ??= {};
    const name = material.name ?? "";
    if (name.includes("body_off_white")) {
      material.pbrMetallicRoughness.metallicFactor = round(p.metal);
      material.pbrMetallicRoughness.roughnessFactor = round(p.rough + 0.04);
    }
    if (name.includes("dark_gunmetal")) {
      material.pbrMetallicRoughness.metallicFactor = round(Math.min(0.92, p.metal + 0.08));
      material.pbrMetallicRoughness.roughnessFactor = round(Math.max(0.22, p.rough - 0.04));
    }
    if (name.includes("core") || name.includes("scanner")) {
      material.emissiveFactor = [round(0.16 * p.coreEmit), round(0.74 * p.coreEmit), round(0.56 * p.coreEmit)];
      material.pbrMetallicRoughness.metallicFactor = round(Math.min(0.84, p.metal));
      material.pbrMetallicRoughness.roughnessFactor = round(Math.max(0.2, p.rough - 0.06));
    }
    if (name.includes("warning_amber")) {
      material.emissiveFactor = [round(0.22 * p.coreEmit), round(0.13 * p.coreEmit), round(0.035 * p.coreEmit)];
      material.pbrMetallicRoughness.metallicFactor = round(Math.min(0.86, p.metal));
      material.pbrMetallicRoughness.roughnessFactor = round(p.rough);
    }
  }
}

function polishFurnitureMaterials(json, p) {
  for (const material of json.materials ?? []) {
    material.pbrMetallicRoughness ??= {};
    const name = material.name ?? "";
    if (name.includes("metal_worn")) {
      material.pbrMetallicRoughness.metallicFactor = round(p.metal);
      material.pbrMetallicRoughness.roughnessFactor = round(p.rough + 0.04);
    }
    if (name.includes("metal_dark")) {
      material.pbrMetallicRoughness.metallicFactor = round(Math.min(0.9, p.metal + 0.08));
      material.pbrMetallicRoughness.roughnessFactor = round(Math.max(0.24, p.rough - 0.04));
    }
    if (name.includes("panel_white")) {
      material.pbrMetallicRoughness.metallicFactor = round(Math.min(0.58, p.metal * 0.62));
      material.pbrMetallicRoughness.roughnessFactor = round(Math.max(0.3, p.rough + 0.04));
    }
    if (name.includes("emissive") || name.includes("glass_screen")) {
      material.emissiveFactor = [round(0.2 * p.emissive), round(0.82 * p.emissive), round(0.9 * p.emissive)];
      material.pbrMetallicRoughness.metallicFactor = round(Math.min(0.58, p.metal * 0.7));
      material.pbrMetallicRoughness.roughnessFactor = round(Math.max(0.18, p.rough - 0.1));
    }
    if (name.includes("grime") || name.includes("dust")) {
      material.pbrMetallicRoughness.roughnessFactor = 0.92;
    }
  }
}

function stampAssetExtras(json, program, best) {
  json.asset ??= {};
  json.asset.extras ??= {};
  json.asset.extras.humanProtocolMathPolish = {
    version: 1,
    appliedAt: report.generatedAt,
    targetId: program.id,
    candidatesEvaluated: candidatesPerAsset,
    score: round(best.evaluation.score),
    source: "scripts/optimizer/math-polish-assets-v1.mjs",
  };
}

function readGlb(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.toString("ascii", 0, 4) !== "glTF") throw new Error(`${filePath} is not a GLB.`);
  const chunks = [];
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    offset += 8;
    chunks.push({ type, data: buffer.subarray(offset, offset + length) });
    offset += length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === "JSON");
  if (!jsonChunk) throw new Error(`${filePath} has no JSON chunk.`);
  return { chunks, json: JSON.parse(jsonChunk.data.toString("utf8").trim()) };
}

function writeGlb(filePath, chunks, json) {
  const jsonText = JSON.stringify(json);
  const jsonPadding = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
  const jsonData = Buffer.from(jsonText + " ".repeat(jsonPadding));
  const outputChunks = chunks.map((chunk) => (chunk.type === "JSON" ? { type: "JSON", data: jsonData } : chunk));
  const totalLength = 12 + outputChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = Buffer.alloc(totalLength);
  output.write("glTF", 0, "ascii");
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  let offset = 12;
  for (const chunk of outputChunks) {
    output.writeUInt32LE(chunk.data.length, offset);
    output.write(chunk.type, offset + 4, 4, "ascii");
    offset += 8;
    chunk.data.copy(output, offset);
    offset += chunk.data.length;
  }
  writeFileSync(filePath, output);
}

function nodesByName(json) {
  const map = new Map();
  for (const node of json.nodes ?? []) {
    if (!node.name) continue;
    if (!map.has(node.name)) map.set(node.name, []);
    map.get(node.name).push(node);
  }
  return map;
}

function setNodeIf(map, name, patch) {
  const nodes = map.get(name);
  if (!nodes?.length) return;
  for (const node of nodes) {
    if (patch.translation) node.translation = patch.translation.map(round);
    if (patch.rotation) node.rotation = patch.rotation.map(round);
    if (patch.scale) node.scale = patch.scale.map(round);
  }
}

function scaleMatching(map, regex, scale) {
  for (const [name, nodes] of map.entries()) {
    if (!regex.test(name)) continue;
    for (const node of nodes) {
      node.scale = scale.map(round);
    }
  }
}

function removeAnimationChannelsForNode(json, nodeName) {
  const nodeIndex = json.nodes?.findIndex((node) => node.name === nodeName);
  if (!Number.isInteger(nodeIndex) || nodeIndex < 0) return;
  for (const animation of json.animations ?? []) {
    animation.channels = (animation.channels ?? []).filter((channel) => channel.target?.node !== nodeIndex);
  }
}

function quatFromEuler(x, y, z) {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

function pushTop(top, entry, limit) {
  if (top.length < limit || entry.evaluation.score > top[top.length - 1].evaluation.score) {
    top.push(entry);
    top.sort((a, b) => b.evaluation.score - a.evaluation.score);
    top.length = Math.min(top.length, limit);
  }
}

function pref(value, target, width) {
  const d = (value - target) / Math.max(0.0001, width);
  return Math.exp(-(d * d));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function rand(rng, min, max) {
  return min + (max - min) * rng();
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function roundObject(value) {
  if (Array.isArray(value)) return value.map(roundObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundObject(item)]));
  }
  return typeof value === "number" ? round(value) : value;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(items) {
  const parsed = {};
  for (const item of items) {
    if (!item.startsWith("--")) continue;
    const [key, value = "true"] = item.slice(2).split("=");
    parsed[key] = value;
  }
  return parsed;
}

function hashString(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
