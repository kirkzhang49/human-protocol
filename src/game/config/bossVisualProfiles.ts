import type { EnemyArchetypeId } from "./enemyArchetypes";
import type { EnemyTierId } from "./enemyTiers";

type BossProfileLanguage = "zh" | "en";

export interface BossVisualEnemyRef {
  archetypeId: EnemyArchetypeId;
  tier: EnemyTierId;
  tierLabel?: string;
  waveId: string;
  modelKey?: string;
}

export interface BossLocalizedCopy {
  zh: string;
  en: string;
}

export interface BossVitalityCopy {
  kicker: BossLocalizedCopy;
  displayName: BossLocalizedCopy;
  armorIntact: BossLocalizedCopy;
  armorHit: BossLocalizedCopy;
  armorBreaking: BossLocalizedCopy;
  armorFailing: BossLocalizedCopy;
  incomingStrike: BossLocalizedCopy;
  staggerWindow: BossLocalizedCopy;
  defeated: BossLocalizedCopy;
  staggerLabel: BossLocalizedCopy;
  warningLabel: BossLocalizedCopy;
  offlineLabel: BossLocalizedCopy;
}

export interface BossFeedbackRecipe {
  armorSparkBaseCount: number;
  armorSparkPressureCount: number;
  armorSparkBaseHeight: number;
  armorSparkHeightStep: number;
  armorSparkSideSpacing: number;
  armorSparkLifetime: number;
  armorSparkIntensity: number;
  armorSparkWoundedBonus: number;
  armorSparkPressureBonus: number;
  pressureSparkHeight: number;
  pressureSparkIntensity: number;
  staggerShockwaveLifetime: number;
  staggerShockwaveIntensity: number;
  staggerBurstLifetime: number;
  staggerBurstIntensity: number;
  staggerDashLifetime: number;
  staggerDashIntensity: number;
  staggerCameraShake: number;
  staggerCameraFovKick: number;
  staggerRumble: number;
  staggerRumbleDuration: number;
  staggerHitStopDuration: number;
  staggerHitStopScale: number;
  defeatCoreHeight: number;
  defeatSparkCount: number;
  defeatSparkIntensity: number;
  defeatShockwaveLifetime: number;
  defeatShockwaveIntensity: number;
  defeatBurstLifetime: number;
  defeatBurstIntensity: number;
  defeatDashLifetime: number;
  defeatDashIntensity: number;
  defeatCameraShake: number;
  defeatCameraFovKick: number;
  defeatRumble: number;
  defeatRumbleDuration: number;
  defeatHitStopDuration: number;
  defeatHitStopScale: number;
}

export interface BossStaggerTuning {
  thresholdMultiplier: number;
  durationMultiplier: number;
  interruptDurationBonus: number;
  postStaggerCooldownBonus: number;
  carryChargeRatio: number;
  interruptCarryChargeRatio: number;
  hitReactFloor: number;
  velocityImpulse: number;
}

export interface BossPoseTuning {
  hitReactMultiplier: number;
  staggerPoseMultiplier: number;
  rootHitPush: number;
  rootStaggerPush: number;
  verticalHitLift: number;
  verticalStaggerLift: number;
  pitchStagger: number;
  rollStagger: number;
  scaleHit: number;
  scaleStagger: number;
  torsoDip: number;
  torsoPitch: number;
  torsoRoll: number;
}

export interface BossVisualProfile {
  id: string;
  levelId?: string;
  waveIds?: readonly string[];
  archetypeIds?: readonly EnemyArchetypeId[];
  tiers?: readonly EnemyTierId[];
  modelKeys?: readonly string[];
  copy: BossVitalityCopy;
  feedback: BossFeedbackRecipe;
  stagger: BossStaggerTuning;
  pose?: BossPoseTuning;
}

export const bossVisualProfiles = [
  {
    id: "level03_museum_curator",
    levelId: "level_03_human_museum",
    waveIds: ["wave_level_03_central_archive"],
    archetypeIds: ["custodian_elite"],
    tiers: ["boss"],
    modelKeys: ["hp_enemy_shield_technician_horror"],
    copy: {
      kicker: { zh: "核心目标", en: "Priority target" },
      displayName: { zh: "策展主管", en: "Curator Foreman" },
      armorIntact: { zh: "装甲完整", en: "Armor integrity" },
      armorHit: { zh: "装甲受击", en: "Armor hit" },
      armorBreaking: { zh: "核心将暴露", en: "Core nearly exposed" },
      armorFailing: { zh: "装甲破损", en: "Armor failing" },
      incomingStrike: { zh: "重击预警", en: "Incoming strike" },
      staggerWindow: { zh: "核心暴露", en: "Core exposed" },
      defeated: { zh: "目标离线", en: "Target offline" },
      staggerLabel: { zh: "压制", en: "Stagger" },
      warningLabel: { zh: "预警", en: "Warning" },
      offlineLabel: { zh: "离线", en: "Offline" },
    },
    feedback: {
      armorSparkBaseCount: 4,
      armorSparkPressureCount: 8,
      armorSparkBaseHeight: 1.12,
      armorSparkHeightStep: 0.095,
      armorSparkSideSpacing: 0.24,
      armorSparkLifetime: 0.25,
      armorSparkIntensity: 2.05,
      armorSparkWoundedBonus: 0.38,
      armorSparkPressureBonus: 0.58,
      pressureSparkHeight: 1.56,
      pressureSparkIntensity: 2.78,
      staggerShockwaveLifetime: 0.54,
      staggerShockwaveIntensity: 3.08,
      staggerBurstLifetime: 0.5,
      staggerBurstIntensity: 3.35,
      staggerDashLifetime: 0.38,
      staggerDashIntensity: 2.24,
      staggerCameraShake: 0.58,
      staggerCameraFovKick: 2.65,
      staggerRumble: 0.2,
      staggerRumbleDuration: 0.16,
      staggerHitStopDuration: 0.064,
      staggerHitStopScale: 0.11,
      defeatCoreHeight: 1.36,
      defeatSparkCount: 9,
      defeatSparkIntensity: 2.22,
      defeatShockwaveLifetime: 0.58,
      defeatShockwaveIntensity: 3.02,
      defeatBurstLifetime: 0.48,
      defeatBurstIntensity: 2.62,
      defeatDashLifetime: 0.46,
      defeatDashIntensity: 2.24,
      defeatCameraShake: 0.68,
      defeatCameraFovKick: 3.5,
      defeatRumble: 0.28,
      defeatRumbleDuration: 0.2,
      defeatHitStopDuration: 0.064,
      defeatHitStopScale: 0.1,
    },
    stagger: {
      thresholdMultiplier: 0.86,
      durationMultiplier: 0.78,
      interruptDurationBonus: 0.12,
      postStaggerCooldownBonus: 0.22,
      carryChargeRatio: 0.2,
      interruptCarryChargeRatio: 0.1,
      hitReactFloor: 0.38,
      velocityImpulse: 1.18,
    },
    pose: {
      hitReactMultiplier: 2.08,
      staggerPoseMultiplier: 1.58,
      rootHitPush: 0.28,
      rootStaggerPush: 0.4,
      verticalHitLift: 0.046,
      verticalStaggerLift: 0.13,
      pitchStagger: 0.22,
      rollStagger: 0.36,
      scaleHit: 0.03,
      scaleStagger: 0.04,
      torsoDip: 0.075,
      torsoPitch: 0.26,
      torsoRoll: 0.44,
    },
  },
] as const satisfies readonly BossVisualProfile[];

export function bossVisualProfileForEnemy(levelId: string, enemy: BossVisualEnemyRef) {
  return bossVisualProfiles.find((profile) => bossProfileMatches(profile, levelId, enemy));
}

export function bossCopy(copy: BossLocalizedCopy, language: BossProfileLanguage) {
  return copy[language] || copy.zh;
}

export function bossFeedbackForEnemy(levelId: string, enemy: BossVisualEnemyRef) {
  return bossVisualProfileForEnemy(levelId, enemy)?.feedback ?? defaultBossFeedbackForEnemy(enemy);
}

export function bossStaggerTuningForEnemy(levelId: string, enemy: BossVisualEnemyRef): BossStaggerTuning {
  return bossVisualProfileForEnemy(levelId, enemy)?.stagger ?? defaultBossStaggerTuningForEnemy(enemy);
}

export function bossPoseTuningForEnemy(levelId: string, enemy: BossVisualEnemyRef): BossPoseTuning {
  return bossVisualProfileForEnemy(levelId, enemy)?.pose ?? defaultBossPoseTuningForEnemy(enemy);
}

function bossProfileMatches(profile: BossVisualProfile, levelId: string, enemy: BossVisualEnemyRef) {
  if (profile.levelId && profile.levelId !== levelId) return false;
  if (profile.waveIds && !profile.waveIds.includes(enemy.waveId)) return false;
  if (profile.archetypeIds && !profile.archetypeIds.includes(enemy.archetypeId)) return false;
  if (profile.tiers && !profile.tiers.includes(enemy.tier)) return false;
  if (profile.modelKeys && enemy.modelKey && !profile.modelKeys.includes(enemy.modelKey)) return false;
  return true;
}

function defaultBossFeedbackForEnemy(enemy: BossVisualEnemyRef): BossFeedbackRecipe {
  const isBoss = enemy.tier === "boss";
  return {
    armorSparkBaseCount: isBoss ? 4 : 3,
    armorSparkPressureCount: isBoss ? 5 : 4,
    armorSparkBaseHeight: isBoss ? 1.28 : 1.02,
    armorSparkHeightStep: 0.08,
    armorSparkSideSpacing: 0.22,
    armorSparkLifetime: 0.18,
    armorSparkIntensity: isBoss ? 1.48 : 1.38,
    armorSparkWoundedBonus: 0.3,
    armorSparkPressureBonus: 0.34,
    pressureSparkHeight: isBoss ? 1.55 : 1.22,
    pressureSparkIntensity: isBoss ? 2.05 : 1.68,
    staggerShockwaveLifetime: 0.38,
    staggerShockwaveIntensity: isBoss ? 2.05 : 1.54,
    staggerBurstLifetime: 0.34,
    staggerBurstIntensity: isBoss ? 2.38 : 1.82,
    staggerDashLifetime: 0.28,
    staggerDashIntensity: isBoss ? 1.65 : 1.28,
    staggerCameraShake: isBoss ? 0.36 : 0.24,
    staggerCameraFovKick: isBoss ? 1.65 : 0.92,
    staggerRumble: 0.14,
    staggerRumbleDuration: 0.11,
    staggerHitStopDuration: isBoss ? 0.046 : 0.034,
    staggerHitStopScale: isBoss ? 0.12 : 0.16,
    defeatCoreHeight: isBoss ? 1.42 : 1.18,
    defeatSparkCount: isBoss ? 9 : 6,
    defeatSparkIntensity: isBoss ? 2.25 : 1.72,
    defeatShockwaveLifetime: isBoss ? 0.58 : 0.44,
    defeatShockwaveIntensity: isBoss ? 3.1 : 2.25,
    defeatBurstLifetime: isBoss ? 0.46 : 0.36,
    defeatBurstIntensity: isBoss ? 2.65 : 1.95,
    defeatDashLifetime: isBoss ? 0.48 : 0.38,
    defeatDashIntensity: isBoss ? 2.35 : 1.85,
    defeatCameraShake: isBoss ? 0.72 : 0.5,
    defeatCameraFovKick: isBoss ? 3.6 : 2.2,
    defeatRumble: isBoss ? 0.3 : 0.18,
    defeatRumbleDuration: 0.18,
    defeatHitStopDuration: isBoss ? 0.072 : 0.052,
    defeatHitStopScale: isBoss ? 0.08 : 0.12,
  };
}

function defaultBossPoseTuningForEnemy(enemy: BossVisualEnemyRef): BossPoseTuning {
  const isBoss = enemy.tier === "boss";
  const isLeader = enemy.tier === "leader";
  return {
    hitReactMultiplier: isBoss ? 1.78 : isLeader ? 1.56 : 1,
    staggerPoseMultiplier: isBoss ? 1.22 : isLeader ? 1.1 : 1,
    rootHitPush: 0.24,
    rootStaggerPush: 0.28,
    verticalHitLift: 0.038,
    verticalStaggerLift: 0.08,
    pitchStagger: 0.1,
    rollStagger: 0.16,
    scaleHit: 0.024,
    scaleStagger: 0.018,
    torsoDip: 0.035,
    torsoPitch: 0.12,
    torsoRoll: 0.2,
  };
}

function defaultBossStaggerTuningForEnemy(enemy: BossVisualEnemyRef): BossStaggerTuning {
  const isBoss = enemy.tier === "boss";
  return {
    thresholdMultiplier: 1,
    durationMultiplier: isBoss ? 0.82 : 0.9,
    interruptDurationBonus: isBoss ? 0.11 : 0.1,
    postStaggerCooldownBonus: isBoss ? 0.24 : 0.28,
    carryChargeRatio: 0.24,
    interruptCarryChargeRatio: 0.14,
    hitReactFloor: isBoss ? 0.34 : 0.3,
    velocityImpulse: isBoss ? 0.82 : 0.96,
  };
}
