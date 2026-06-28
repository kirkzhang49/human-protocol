import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const REPORT_PATH = join(ROOT, "src/assets/manifests/reports/human_protocol_enemy_aesthetic_objective_v2_report.json");
const args = parseArgs(process.argv.slice(2));
const candidatesPerEnemy = positiveInt(args.candidates, 500000);
const baseSeed = positiveInt(args.seed, 20260603);

const currentAssetReportPath = join(ROOT, "src/assets/manifests/reports/human_protocol_asset_math_polish_v1_report.json");
const currentAssetReport = JSON.parse(readFileSync(currentAssetReportPath, "utf8"));

const enemies = [
  flyingDroneObjective(),
  clampRepairObjective(),
  shieldTechObjective(),
  custodianForemanObjective(),
  reclamationMotherObjective(),
];

const report = {
  schema: "human-protocol/enemy-aesthetic-objective-v2-report@1",
  generatedAt: new Date().toISOString(),
  objective: "Find robot candidates that keep math lighting/readability high while adding user-appeal and horror-premium restraint.",
  sourceReports: [
    "src/assets/manifests/reports/human_protocol_asset_math_polish_v1_report.json",
    "src/assets/manifests/reports/human_protocol_enemy_palette_math_report.json",
    "docs/human-protocol-agent-native-asset-lab-vnext.md",
  ],
  candidatesPerEnemy,
  applied: false,
  formulas: {
    balancedScore:
      "0.34*mathLightScore + 0.28*userAppealScore + 0.22*horrorPremiumScore + 0.16*roleSilhouetteScore - penalties",
    userAppealScore:
      "Rewards controlled glow, dark readable armor, low toy-like saturation, small amber warning accents, premium rough metal, and non-billboard emissive area.",
    horrorPremiumScore:
      "Rewards a mostly dark robot that catches room light through silhouette edges and small core/status lights instead of glowing everywhere.",
    paretoRule:
      "A candidate is selected only if mathLightScore >= 0.78, userAppealScore >= 0.76, and hard role constraints pass.",
  },
  targets: [],
};

for (const enemy of enemies) {
  const rng = mulberry32(hashString(`${baseSeed}:enemy-aesthetic-v2:${enemy.id}`));
  const v1 = currentAssetReport.targets.find((target) => target.id === enemy.id);
  const current = { ...enemy.current, ...(v1?.bestCandidate ?? {}) };
  const currentEvaluation = enemy.evaluate(current);
  const topBalanced = [];
  const topMath = [];
  const topUserAppeal = [];
  let bestBalanced = { index: -1, candidate: current, evaluation: currentEvaluation };
  let bestMath = bestBalanced;
  let bestUserAppeal = bestBalanced;

  for (let index = 0; index < candidatesPerEnemy; index += 1) {
    const candidate = enemy.sample(rng);
    const evaluation = enemy.evaluate(candidate);
    const entry = { index, candidate, evaluation };
    pushTop(topBalanced, entry, 12, "balancedScore");
    pushTop(topMath, entry, 8, "mathLightScore");
    pushTop(topUserAppeal, entry, 8, "userAppealScore");
    if (evaluation.balancedScore > bestBalanced.evaluation.balancedScore) bestBalanced = entry;
    if (evaluation.mathLightScore > bestMath.evaluation.mathLightScore) bestMath = entry;
    if (evaluation.userAppealScore > bestUserAppeal.evaluation.userAppealScore) bestUserAppeal = entry;
  }

  const recommendedCandidate = topBalanced.find((entry) => entry.evaluation.hardConstraints.paretoAccept) ?? bestBalanced;
  report.targets.push({
    id: enemy.id,
    role: enemy.role,
    currentScore: roundObject(scoreSummary(currentEvaluation)),
    bestBalanced: serializeEntry(recommendedCandidate),
    bestPureMath: serializeEntry(bestMath),
    bestUserAppeal: serializeEntry(bestUserAppeal),
    topBalanced: topBalanced.map(serializeEntry),
    topMath: topMath.map(serializeEntry),
    topUserAppeal: topUserAppeal.map(serializeEntry),
    decision: "report-only",
    recommendedNextAction: enemy.recommendedNextAction(recommendedCandidate.candidate, recommendedCandidate.evaluation),
    rationale: enemy.rationale,
  });

  console.log(
    `REPORT ${enemy.id} balanced=${round(recommendedCandidate.evaluation.balancedScore)} math=${round(
      recommendedCandidate.evaluation.mathLightScore,
    )} user=${round(recommendedCandidate.evaluation.userAppealScore)} index=${recommendedCandidate.index}`,
  );
}

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${REPORT_PATH}`);

function flyingDroneObjective() {
  return {
    id: "hp_enemy_repair_drone_horror",
    role: "small_flying_maintenance_drone",
    rationale:
      "The flying unit should be liked as a slim, quick, readable drone: thin lateral arms, tiny hands/tools, low glow area, and a restrained cyan-green core.",
    current: {
      torsoX: 0.6991,
      torsoY: 0.5426,
      torsoZ: 0.6918,
      shoulderSpread: 0.7993,
      shoulderHeight: 1.549,
      shoulderRoll: 1.6103,
      armThickness: 0.2322,
      forearmLength: 0.4441,
      handScale: 0.2769,
      headScale: 0.4735,
      backpackZ: 0.5269,
      pelvisScale: 0.009,
      coreScale: 0.3544,
      probeScale: 0.2262,
      metal: 0.741,
      rough: 0.336,
      coreEmit: 1.0396,
      glowArea: 0.2,
      amberAccent: 0.28,
      armorDarkness: 0.78,
      bodyDesaturation: 0.74,
      hammerMass: 0,
      attackArc: 0,
    },
    sample: (rng) => ({
      torsoX: rand(rng, 0.6, 0.73),
      torsoY: rand(rng, 0.44, 0.56),
      torsoZ: rand(rng, 0.56, 0.7),
      shoulderSpread: rand(rng, 0.78, 0.94),
      shoulderHeight: rand(rng, 1.46, 1.64),
      shoulderRoll: rand(rng, 1.56, 1.74),
      armThickness: rand(rng, 0.12, 0.2),
      forearmLength: rand(rng, 0.38, 0.56),
      handScale: rand(rng, 0.16, 0.27),
      headScale: rand(rng, 0.38, 0.5),
      backpackZ: rand(rng, 0.42, 0.56),
      pelvisScale: rand(rng, 0.002, 0.009),
      coreScale: rand(rng, 0.24, 0.36),
      probeScale: rand(rng, 0.14, 0.24),
      metal: rand(rng, 0.7, 0.86),
      rough: rand(rng, 0.28, 0.46),
      coreEmit: rand(rng, 0.58, 0.9),
      glowArea: rand(rng, 0.08, 0.22),
      amberAccent: rand(rng, 0.14, 0.36),
      armorDarkness: rand(rng, 0.72, 0.92),
      bodyDesaturation: rand(rng, 0.72, 0.96),
      hammerMass: 0,
      attackArc: 0,
    }),
    evaluate: (p) => evaluateEnemy(p, {
      roleSilhouetteScore:
        0.24 * pref(p.torsoX, 0.66, 0.08) +
        0.16 * pref(p.shoulderSpread, 0.86, 0.08) +
        0.24 * pref(p.armThickness, 0.155, 0.045) +
        0.16 * pref(p.handScale, 0.21, 0.05) +
        0.12 * pref(p.pelvisScale, 0.004, 0.006) +
        0.08 * pref(p.coreScale, 0.3, 0.06),
      roleReadabilityScore:
        0.32 * pref(p.forearmLength, 0.47, 0.08) +
        0.26 * pref(p.probeScale, 0.19, 0.05) +
        0.22 * pref(p.headScale, 0.44, 0.06) +
        0.2 * pref(p.shoulderRoll, 1.66, 0.1),
      penalties: {
        thickFlyingArmPenalty: Math.max(0, (p.armThickness - 0.18) * 5.2),
        toyGlowPenalty: Math.max(0, (p.coreEmit - 0.86) * 1.8) + Math.max(0, (p.glowArea - 0.2) * 2.4),
      },
      hardRole: p.armThickness <= 0.19 && p.handScale <= 0.265,
    }),
    recommendedNextAction: (p, e) =>
      `Do not apply directly yet. Blender pass should use armThickness ${round(p.armThickness)}, handScale ${round(
        p.handScale,
      )}, coreEmit ${round(p.coreEmit)}; convert lateral arms into thinner drone spars/side turbines. Balanced score ${round(e.balancedScore)}.`,
  };
}

function clampRepairObjective() {
  return robotObjective({
    id: "hp_enemy_clamp_repair_horror",
    role: "stocky_ground_maintenance_robot",
    rationale:
      "The ground maintenance robot can stay stocky, but glow should be restrained and body should rely on room light plus dark armor instead of self-illumination.",
    current: {
      torsoX: 2.0423,
      torsoY: 0.8142,
      torsoZ: 1.6733,
      shoulderSpread: 1.7666,
      armScale: 1.5325,
      forearmScale: 1.5999,
      handScale: 1.5638,
      legScale: 1.4329,
      footScale: 1.2353,
      toolScale: 1.4432,
      metal: 0.7564,
      rough: 0.3769,
      coreEmit: 0.883,
      glowArea: 0.22,
      amberAccent: 0.32,
      armorDarkness: 0.82,
      bodyDesaturation: 0.82,
      hammerMass: 0.2,
      attackArc: 0.45,
    },
    sample: (rng) => ({
      torsoX: rand(rng, 1.88, 2.12),
      torsoY: rand(rng, 0.72, 0.86),
      torsoZ: rand(rng, 1.54, 1.78),
      shoulderSpread: rand(rng, 1.66, 1.9),
      armScale: rand(rng, 1.36, 1.64),
      forearmScale: rand(rng, 1.4, 1.72),
      handScale: rand(rng, 1.36, 1.66),
      legScale: rand(rng, 1.3, 1.58),
      footScale: rand(rng, 1.08, 1.28),
      toolScale: rand(rng, 1.26, 1.56),
      metal: rand(rng, 0.7, 0.86),
      rough: rand(rng, 0.3, 0.48),
      coreEmit: rand(rng, 0.58, 0.9),
      glowArea: rand(rng, 0.1, 0.24),
      amberAccent: rand(rng, 0.18, 0.38),
      armorDarkness: rand(rng, 0.72, 0.94),
      bodyDesaturation: rand(rng, 0.72, 0.96),
      hammerMass: rand(rng, 0.08, 0.32),
      attackArc: rand(rng, 0.32, 0.58),
    }),
    roleSilhouette: (p) =>
      0.24 * pref(p.torsoX / p.torsoY, 2.55, 0.38) +
      0.18 * pref(p.legScale, 1.44, 0.18) +
      0.18 * pref(p.footScale, 1.18, 0.14) +
      0.2 * pref(p.handScale, 1.52, 0.2) +
      0.2 * pref(p.toolScale, 1.4, 0.18),
    roleReadability: (p) => 0.44 * pref(p.toolScale, 1.4, 0.18) + 0.32 * pref(p.handScale, 1.52, 0.2) + 0.24 * pref(p.shoulderSpread, 1.78, 0.17),
    extraPenalty: () => 0,
    hardRole: () => true,
    recommendedNextAction: (p, e) =>
      `Good candidate for direct GLB parameter pass after visual review. Keep stocky silhouette, set coreEmit ${round(p.coreEmit)} and glowArea ${round(
        p.glowArea,
      )}; do not add more glowing strips. Balanced score ${round(e.balancedScore)}.`,
  });
}

function shieldTechObjective() {
  return robotObjective({
    id: "hp_enemy_shield_technician_horror",
    role: "defensive_shield_robot",
    rationale:
      "Shield robot should have a readable defensive panel, but avoid a flat glowing wall. Human appeal comes from dark armor with a small shield rim and restrained core.",
    current: {
      torsoX: 1.3611,
      torsoY: 0.9027,
      torsoZ: 1.1679,
      shoulderSpread: 1.552,
      armScale: 1.1387,
      forearmScale: 1.2717,
      handScale: 1.1416,
      shieldScale: 1.2296,
      batonScale: 1.1786,
      footScale: 1.0412,
      metal: 0.7707,
      rough: 0.3253,
      coreEmit: 0.8696,
      glowArea: 0.24,
      amberAccent: 0.28,
      armorDarkness: 0.82,
      bodyDesaturation: 0.82,
      hammerMass: 0.15,
      attackArc: 0.4,
    },
    sample: (rng) => ({
      torsoX: rand(rng, 1.26, 1.5),
      torsoY: rand(rng, 0.84, 0.98),
      torsoZ: rand(rng, 1.08, 1.3),
      shoulderSpread: rand(rng, 1.42, 1.66),
      armScale: rand(rng, 1.06, 1.3),
      forearmScale: rand(rng, 1.12, 1.38),
      handScale: rand(rng, 1.06, 1.26),
      shieldScale: rand(rng, 1.08, 1.28),
      batonScale: rand(rng, 1.04, 1.26),
      footScale: rand(rng, 0.94, 1.12),
      metal: rand(rng, 0.7, 0.86),
      rough: rand(rng, 0.3, 0.48),
      coreEmit: rand(rng, 0.56, 0.86),
      glowArea: rand(rng, 0.1, 0.22),
      amberAccent: rand(rng, 0.16, 0.34),
      armorDarkness: rand(rng, 0.72, 0.94),
      bodyDesaturation: rand(rng, 0.74, 0.96),
      hammerMass: rand(rng, 0.06, 0.24),
      attackArc: rand(rng, 0.28, 0.5),
    }),
    roleSilhouette: (p) =>
      0.24 * pref(p.torsoX, 1.36, 0.16) +
      0.22 * pref(p.shieldScale, 1.16, 0.12) +
      0.18 * pref(p.shoulderSpread, 1.52, 0.14) +
      0.18 * pref(p.batonScale, 1.14, 0.14) +
      0.18 * pref(p.footScale, 1.02, 0.1),
    roleReadability: (p) => 0.48 * pref(p.shieldScale, 1.16, 0.12) + 0.32 * pref(p.batonScale, 1.14, 0.14) + 0.2 * pref(p.forearmScale, 1.22, 0.14),
    extraPenalty: (p) => Math.max(0, (p.shieldScale - 1.24) * 2),
    hardRole: (p) => p.shieldScale <= 1.27,
    recommendedNextAction: (p, e) =>
      `Report-only. If accepted, keep shieldScale ${round(p.shieldScale)} and coreEmit ${round(
        p.coreEmit,
      )}; add rim-light geometry in Blender rather than a full glowing shield face. Balanced score ${round(e.balancedScore)}.`,
  });
}

function custodianForemanObjective() {
  return hammerBossObjective({
    id: "hp_enemy_custodian_foreman_horror",
    role: "hammer_foreman_boss",
    rationale:
      "The foreman should become a hammer-slam threat closer to a heavy mech silhouette: compact body, strong shoulders, small feet, big service hammer, and large attack arc.",
    current: {
      torsoX: 1.1689,
      torsoY: 0.9534,
      torsoZ: 1.2572,
      legScale: 1.2046,
      footX: 0.5442,
      footY: 0.6051,
      footZ: 0.6155,
      wrenchX: 1.0349,
      wrenchY: 1.0522,
      handScale: 1.1984,
      metal: 0.7617,
      rough: 0.329,
      coreEmit: 0.9031,
      glowArea: 0.22,
      amberAccent: 0.3,
      armorDarkness: 0.84,
      bodyDesaturation: 0.84,
      hammerMass: 0.72,
      hammerLength: 1.18,
      hammerHead: 0.58,
      attackArc: 0.82,
      shoulderArmor: 0.72,
    },
  });
}

function reclamationMotherObjective() {
  return hammerBossObjective({
    id: "hp_enemy_reclamation_mother_final_horror",
    role: "final_hammer_mother_boss",
    rationale:
      "The final boss should keep identity-panel story language, but combat read should be a heavy hammer/mech slam instead of a generic tool user.",
    current: {
      torsoX: 1.2902,
      torsoY: 0.9329,
      torsoZ: 1.2223,
      legScale: 1.256,
      footX: 0.4943,
      footY: 0.557,
      footZ: 0.5281,
      wrenchX: 1.1311,
      wrenchY: 1.1989,
      handScale: 1.2551,
      identityScale: 1.1626,
      spineScale: 1.1607,
      metal: 0.7765,
      rough: 0.321,
      coreEmit: 0.9424,
      glowArea: 0.24,
      amberAccent: 0.34,
      armorDarkness: 0.86,
      bodyDesaturation: 0.86,
      hammerMass: 0.82,
      hammerLength: 1.26,
      hammerHead: 0.64,
      attackArc: 0.88,
      shoulderArmor: 0.78,
    },
    finalBoss: true,
  });
}

function hammerBossObjective(config) {
  return {
    ...config,
    sample: (rng) => ({
      torsoX: rand(rng, config.finalBoss ? 1.18 : 1.08, config.finalBoss ? 1.38 : 1.28),
      torsoY: rand(rng, 0.86, 1.0),
      torsoZ: rand(rng, 1.12, 1.34),
      legScale: rand(rng, 1.1, 1.3),
      footX: rand(rng, 0.4, 0.58),
      footY: rand(rng, 0.46, 0.62),
      footZ: rand(rng, 0.44, 0.58),
      wrenchX: rand(rng, 1.04, 1.34),
      wrenchY: rand(rng, 1.08, 1.42),
      handScale: rand(rng, 1.14, 1.34),
      identityScale: rand(rng, config.finalBoss ? 1.08 : 0.92, config.finalBoss ? 1.28 : 1.08),
      spineScale: rand(rng, config.finalBoss ? 1.06 : 0.92, config.finalBoss ? 1.26 : 1.08),
      metal: rand(rng, 0.72, 0.88),
      rough: rand(rng, 0.28, 0.44),
      coreEmit: rand(rng, 0.58, 0.9),
      glowArea: rand(rng, 0.1, 0.24),
      amberAccent: rand(rng, 0.18, 0.38),
      armorDarkness: rand(rng, 0.78, 0.96),
      bodyDesaturation: rand(rng, 0.76, 0.96),
      hammerMass: rand(rng, config.finalBoss ? 0.74 : 0.64, config.finalBoss ? 0.96 : 0.9),
      hammerLength: rand(rng, config.finalBoss ? 1.18 : 1.08, config.finalBoss ? 1.46 : 1.36),
      hammerHead: rand(rng, config.finalBoss ? 0.58 : 0.5, config.finalBoss ? 0.82 : 0.72),
      attackArc: rand(rng, config.finalBoss ? 0.82 : 0.74, config.finalBoss ? 1.0 : 0.96),
      shoulderArmor: rand(rng, 0.66, 0.92),
    }),
    evaluate: (p) =>
      evaluateEnemy(p, {
        roleSilhouetteScore:
          0.16 * pref(p.torsoX, config.finalBoss ? 1.28 : 1.18, 0.16) +
          0.14 * pref(p.legScale, 1.2, 0.15) +
          0.18 * pref(p.footX, 0.5, 0.09) +
          0.18 * pref(p.hammerMass, config.finalBoss ? 0.86 : 0.78, 0.12) +
          0.16 * pref(p.hammerLength, config.finalBoss ? 1.32 : 1.22, 0.16) +
          0.18 * pref(p.shoulderArmor, config.finalBoss ? 0.82 : 0.76, 0.12),
        roleReadabilityScore:
          0.36 * pref(p.hammerHead, config.finalBoss ? 0.68 : 0.62, 0.12) +
          0.34 * pref(p.attackArc, config.finalBoss ? 0.92 : 0.86, 0.12) +
          0.18 * pref(p.handScale, 1.24, 0.14) +
          0.12 * pref(p.wrenchY, config.finalBoss ? 1.28 : 1.2, 0.18),
        penalties: {
          footBlockPenalty: Math.max(0, (p.footX - 0.56) * 4),
          weakHammerPenalty: Math.max(0, (0.72 - p.hammerMass) * 3) + Math.max(0, (0.78 - p.attackArc) * 2.5),
        },
        hardRole: p.hammerMass >= 0.68 && p.attackArc >= 0.76 && p.footX <= 0.58,
      }),
    recommendedNextAction: (p, e) =>
      `Use as Blender target, not direct scalar patch. Create service hammer: hammerMass ${round(p.hammerMass)}, hammerLength ${round(
        p.hammerLength,
      )}, hammerHead ${round(p.hammerHead)}, attackArc ${round(p.attackArc)}. Lower foot block to footX ${round(
        p.footX,
      )}. Balanced score ${round(e.balancedScore)}.`,
  };
}

function robotObjective(config) {
  return {
    ...config,
    evaluate: (p) =>
      evaluateEnemy(p, {
        roleSilhouetteScore: config.roleSilhouette(p),
        roleReadabilityScore: config.roleReadability(p),
        penalties: { rolePenalty: config.extraPenalty(p) },
        hardRole: config.hardRole(p),
      }),
  };
}

function evaluateEnemy(p, { roleSilhouetteScore, roleReadabilityScore, penalties, hardRole }) {
  const pbr = pbrScore(p.metal, p.rough, p.coreEmit);
  const glowControl = 0.34 * pref(p.coreEmit, 0.72, 0.18) + 0.32 * pref(p.glowArea, 0.15, 0.07) + 0.18 * pref(p.amberAccent, 0.26, 0.1) + 0.16 * pref(p.rough, 0.38, 0.12);
  const colorTaste =
    0.34 * pref(p.armorDarkness, 0.86, 0.12) +
    0.28 * pref(p.bodyDesaturation, 0.86, 0.12) +
    0.2 * pref(p.amberAccent, 0.26, 0.1) +
    0.18 * (1 - Math.max(0, p.coreEmit - 0.9) / 0.4);
  const premiumMetal = 0.42 * pbr + 0.28 * pref(p.metal, 0.78, 0.12) + 0.18 * pref(p.rough, 0.38, 0.12) + 0.12 * colorTaste;
  const mathLightScore = clamp01(0.42 * pbr + 0.28 * roleReadabilityScore + 0.18 * roleSilhouetteScore + 0.12 * pref(p.coreEmit, 0.78, 0.24));
  const userAppealScore = clamp01(0.35 * glowControl + 0.28 * colorTaste + 0.22 * premiumMetal + 0.15 * roleSilhouetteScore);
  const horrorPremiumScore = clamp01(
    0.28 * p.armorDarkness + 0.22 * roleSilhouetteScore + 0.18 * premiumMetal + 0.18 * (1 - clamp01(p.glowArea / 0.34)) + 0.14 * pref(p.coreEmit, 0.74, 0.2),
  );
  const combinedPenalty =
    Object.values(penalties).reduce((sum, value) => sum + Math.max(0, value || 0), 0) +
    Math.max(0, (p.coreEmit - 0.92) * 1.8) +
    Math.max(0, (p.glowArea - 0.24) * 2.2);
  const hardConstraints = {
    roleAccept: Boolean(hardRole),
    mathLightAccept: mathLightScore >= 0.78,
    userAppealAccept: userAppealScore >= 0.76,
    glowRestraintAccept: p.coreEmit <= 0.92 && p.glowArea <= 0.24,
  };
  hardConstraints.paretoAccept = Object.values(hardConstraints).every(Boolean);
  const balancedScore = clamp01(
    0.34 * mathLightScore + 0.28 * userAppealScore + 0.22 * horrorPremiumScore + 0.16 * clamp01(roleSilhouetteScore) - combinedPenalty,
  );
  return {
    balancedScore: 100 * balancedScore,
    mathLightScore,
    userAppealScore,
    horrorPremiumScore,
    roleSilhouetteScore: clamp01(roleSilhouetteScore),
    roleReadabilityScore: clamp01(roleReadabilityScore),
    pbrMaterialScore: pbr,
    hardConstraints,
    penalties: { ...penalties, combinedPenalty },
  };
}

function pbrScore(metal, rough, coreEmit) {
  return clamp01(0.35 * pref(metal, 0.78, 0.12) + 0.35 * pref(rough, 0.38, 0.12) + 0.3 * pref(coreEmit, 0.76, 0.22));
}

function serializeEntry(entry) {
  return {
    index: entry.index,
    candidate: roundObject(entry.candidate),
    scores: roundObject(scoreSummary(entry.evaluation)),
    penalties: roundObject(entry.evaluation.penalties),
    hardConstraints: entry.evaluation.hardConstraints,
  };
}

function scoreSummary(evaluation) {
  return {
    balancedScore: evaluation.balancedScore,
    mathLightScore: evaluation.mathLightScore,
    userAppealScore: evaluation.userAppealScore,
    horrorPremiumScore: evaluation.horrorPremiumScore,
    roleSilhouetteScore: evaluation.roleSilhouetteScore,
    roleReadabilityScore: evaluation.roleReadabilityScore,
    pbrMaterialScore: evaluation.pbrMaterialScore,
  };
}

function pushTop(top, entry, limit, scoreKey) {
  if (top.length < limit || entry.evaluation[scoreKey] > top[top.length - 1].evaluation[scoreKey]) {
    top.push(entry);
    top.sort((a, b) => b.evaluation[scoreKey] - a.evaluation[scoreKey]);
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
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundObject(item)]));
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
