import { premiumEnemyVisualPalette } from "./enemyVisualProfiles";

export type EnemyTierId = "normal" | "elite" | "leader" | "boss";

export type EnemyTextureAtlasKey = "repair_drone" | "clamp_bot" | "custodian_boss";

export interface EnemyTierVisualOverrideConfig {
  modelKey?: string;
  bodyColor?: string;
  armorColor?: string;
  coreColor?: string;
  warningColor?: string;
  textureAtlasKey?: EnemyTextureAtlasKey;
  scaleMultiplier?: number;
  lightIntensityMultiplier?: number;
}

export interface EnemyTierOverrideConfig {
  tier?: EnemyTierId;
  tierLabel?: string;
  healthMultiplier?: number;
  damageMultiplier?: number;
  moveSpeedMultiplier?: number;
  attackCooldownMultiplier?: number;
  attackRangeMultiplier?: number;
  threatWeightMultiplier?: number;
  radiusMultiplier?: number;
  visual?: EnemyTierVisualOverrideConfig;
}

export interface ResolvedEnemyTierConfig {
  tier: EnemyTierId;
  tierLabel: string;
  healthMultiplier: number;
  damageMultiplier: number;
  moveSpeedMultiplier: number;
  attackCooldownMultiplier: number;
  attackRangeMultiplier: number;
  threatWeightMultiplier: number;
  radiusMultiplier: number;
  visual: Required<EnemyTierVisualOverrideConfig>;
}

export const enemyTierIds: readonly EnemyTierId[] = ["normal", "elite", "leader", "boss"];

const hpEnemyPalette = premiumEnemyVisualPalette;

const defaultTierVisual: Required<EnemyTierVisualOverrideConfig> = {
  modelKey: "",
  bodyColor: hpEnemyPalette.body,
  armorColor: hpEnemyPalette.armor,
  coreColor: hpEnemyPalette.core,
  warningColor: hpEnemyPalette.warning,
  textureAtlasKey: "repair_drone",
  scaleMultiplier: 1,
  lightIntensityMultiplier: 1.08,
};

export const enemyTierProfiles: Record<EnemyTierId, ResolvedEnemyTierConfig> = {
  normal: {
    tier: "normal",
    tierLabel: "维修单位",
    healthMultiplier: 1,
    damageMultiplier: 1,
    moveSpeedMultiplier: 1,
    attackCooldownMultiplier: 1,
    attackRangeMultiplier: 1,
    threatWeightMultiplier: 1,
    radiusMultiplier: 1,
    visual: defaultTierVisual,
  },
  elite: {
    tier: "elite",
    tierLabel: "精英",
    healthMultiplier: 1.35,
    damageMultiplier: 1.06,
    moveSpeedMultiplier: 1.04,
    attackCooldownMultiplier: 0.96,
    attackRangeMultiplier: 1,
    threatWeightMultiplier: 1.18,
    radiusMultiplier: 1.03,
    visual: {
      bodyColor: hpEnemyPalette.body,
      modelKey: "",
      armorColor: hpEnemyPalette.armor,
      coreColor: hpEnemyPalette.core,
      warningColor: hpEnemyPalette.warning,
      textureAtlasKey: "repair_drone",
      scaleMultiplier: 1.06,
      lightIntensityMultiplier: 1.12,
    },
  },
  leader: {
    tier: "leader",
    tierLabel: "头领",
    healthMultiplier: 1.85,
    damageMultiplier: 1.12,
    moveSpeedMultiplier: 0.98,
    attackCooldownMultiplier: 0.92,
    attackRangeMultiplier: 1.05,
    threatWeightMultiplier: 1.45,
    radiusMultiplier: 1.08,
    visual: {
      bodyColor: hpEnemyPalette.body,
      modelKey: "",
      armorColor: hpEnemyPalette.armor,
      coreColor: hpEnemyPalette.core,
      warningColor: hpEnemyPalette.warning,
      textureAtlasKey: "clamp_bot",
      scaleMultiplier: 1.14,
      lightIntensityMultiplier: 1.18,
    },
  },
  boss: {
    tier: "boss",
    tierLabel: "大型主管",
    healthMultiplier: 2.7,
    damageMultiplier: 1.22,
    moveSpeedMultiplier: 0.92,
    attackCooldownMultiplier: 0.86,
    attackRangeMultiplier: 1.08,
    threatWeightMultiplier: 1.85,
    radiusMultiplier: 1.15,
    visual: {
      bodyColor: hpEnemyPalette.body,
      modelKey: "hp_enemy_reclamation_mother_final_horror",
      armorColor: hpEnemyPalette.armor,
      coreColor: hpEnemyPalette.core,
      warningColor: hpEnemyPalette.warning,
      textureAtlasKey: "custodian_boss",
      scaleMultiplier: 1.28,
      lightIntensityMultiplier: 1.32,
    },
  },
};

export function resolveEnemyTierConfig(config?: EnemyTierOverrideConfig): ResolvedEnemyTierConfig {
  const base = enemyTierProfiles[config?.tier ?? "normal"] ?? enemyTierProfiles.normal;
  const visual = config?.visual ?? {};
  return {
    tier: base.tier,
    tierLabel: config?.tierLabel ?? base.tierLabel,
    healthMultiplier: positiveNumber(config?.healthMultiplier, base.healthMultiplier),
    damageMultiplier: positiveNumber(config?.damageMultiplier, base.damageMultiplier),
    moveSpeedMultiplier: positiveNumber(config?.moveSpeedMultiplier, base.moveSpeedMultiplier),
    attackCooldownMultiplier: positiveNumber(config?.attackCooldownMultiplier, base.attackCooldownMultiplier),
    attackRangeMultiplier: positiveNumber(config?.attackRangeMultiplier, base.attackRangeMultiplier),
    threatWeightMultiplier: positiveNumber(config?.threatWeightMultiplier, base.threatWeightMultiplier),
    radiusMultiplier: positiveNumber(config?.radiusMultiplier, base.radiusMultiplier),
    visual: {
      modelKey: visual.modelKey ?? base.visual.modelKey,
      bodyColor: visual.bodyColor ?? base.visual.bodyColor,
      armorColor: visual.armorColor ?? base.visual.armorColor,
      coreColor: visual.coreColor ?? base.visual.coreColor,
      warningColor: visual.warningColor ?? base.visual.warningColor,
      textureAtlasKey: visual.textureAtlasKey ?? base.visual.textureAtlasKey,
      scaleMultiplier: positiveNumber(visual.scaleMultiplier, base.visual.scaleMultiplier),
      lightIntensityMultiplier: positiveNumber(visual.lightIntensityMultiplier, base.visual.lightIntensityMultiplier),
    },
  };
}

function positiveNumber(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
