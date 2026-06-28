export type UltimateAbilityId = "coreBomb" | "breachMissile";

export interface UltimateAbilityConfig {
  id: UltimateAbilityId;
  displayName: string;
  shortName: string;
  activationMode: "held_then_detonate" | "throw_then_detonate";
  resource: "coreCell";
  resourceSpendPhase: "hold" | "throw";
  viewmodelModelKey: string;
  deployedWorldModelKey: string;
  viewmodelGrip: "cylindrical" | "pistol";
  deployDistance: number;
  deployFallbackDistance: number;
  deployYOffset: number;
  throwWindupSeconds: number;
  throwSpeed: number;
  throwUpwardVelocity: number;
  throwGravity: number;
  throwFuseSeconds: number;
  throwArmSeconds: number;
  throwCollisionRadius: number;
  landedFuseSeconds: number;
  blastRadius: number;
  damage: number;
  bossDamageMultiplier: number;
  smallEnemyExecuteHealthRatio: number;
  knockback: number;
  deployAudioKey: string;
  throwAudioKey: string;
  detonateAudioKey: string;
  deployReward: {
    label: string;
    detail: string;
    rarity: "common" | "rare" | "epic" | "story";
  };
  throwReward: {
    label: string;
    detail: string;
    rarity: "common" | "rare" | "epic" | "story";
  };
  detonateReward: {
    label: string;
    detail: string;
    rarity: "common" | "rare" | "epic" | "story";
  };
}

export const defaultUltimateAbilityId: UltimateAbilityId = "coreBomb";

export const ultimateAbilityConfig = {
  coreBomb: {
    id: "coreBomb",
    displayName: "核心炸弹",
    shortName: "炸弹",
    activationMode: "throw_then_detonate",
    resource: "coreCell",
    resourceSpendPhase: "throw",
    viewmodelModelKey: "ability_protocol_breach_charge_v1",
    deployedWorldModelKey: "ability_protocol_breach_charge_v1",
    viewmodelGrip: "cylindrical",
    deployDistance: 1.85,
    deployFallbackDistance: 0.9,
    deployYOffset: 0.08,
    throwWindupSeconds: 0.22,
    throwSpeed: 4.85,
    throwUpwardVelocity: 2.15,
    throwGravity: 8.6,
    throwFuseSeconds: 0.68,
    throwArmSeconds: 0.1,
    throwCollisionRadius: 0.34,
    landedFuseSeconds: 0.16,
    blastRadius: 6.35,
    damage: 200,
    bossDamageMultiplier: 1,
    smallEnemyExecuteHealthRatio: 1,
    knockback: 7.2,
    deployAudioKey: "ui_upgrade_select",
    throwAudioKey: "ability_throw",
    detonateAudioKey: "weapon_shock_burst",
    deployReward: {
      label: "核心炸弹已握持",
      detail: "再次按 3 投掷",
      rarity: "epic",
    },
    throwReward: {
      label: "核心炸弹已投掷",
      detail: "短暂飞行后爆炸",
      rarity: "epic",
    },
    detonateReward: {
      label: "核心炸弹引爆",
      detail: "低血量小型机器人会被处决",
      rarity: "epic",
    },
  },
  breachMissile: {
    id: "breachMissile",
    displayName: "突破导弹",
    shortName: "导弹",
    activationMode: "throw_then_detonate",
    resource: "coreCell",
    resourceSpendPhase: "throw",
    viewmodelModelKey: "ability_protocol_breach_missile_v1",
    deployedWorldModelKey: "ability_protocol_breach_missile_v1",
    viewmodelGrip: "cylindrical",
    deployDistance: 1.75,
    deployFallbackDistance: 0.82,
    deployYOffset: 0.12,
    throwWindupSeconds: 0.16,
    throwSpeed: 8.2,
    throwUpwardVelocity: 0.82,
    throwGravity: 3.2,
    throwFuseSeconds: 0.52,
    throwArmSeconds: 0.06,
    throwCollisionRadius: 0.26,
    landedFuseSeconds: 0.08,
    blastRadius: 4.75,
    damage: 400,
    bossDamageMultiplier: 1.2,
    smallEnemyExecuteHealthRatio: 0.7,
    knockback: 5.8,
    deployAudioKey: "ui_upgrade_select",
    throwAudioKey: "ability_throw",
    detonateAudioKey: "weapon_shock_burst",
    deployReward: {
      label: "突破导弹已握持",
      detail: "再次按 3 发射",
      rarity: "epic",
    },
    throwReward: {
      label: "突破导弹已发射",
      detail: "高速直线突破目标",
      rarity: "epic",
    },
    detonateReward: {
      label: "突破导弹命中",
      detail: "爆心伤害更高，范围较小",
      rarity: "epic",
    },
  },
} as const satisfies Record<UltimateAbilityId, UltimateAbilityConfig>;
