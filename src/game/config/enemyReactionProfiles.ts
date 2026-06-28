import type { EnemyArchetypeId } from "./enemyArchetypes";
import type { EnemyTierId } from "./enemyTiers";

export interface EnemyReactionProfile {
  hitReactEvery: number;
  woundedHealthRatio: number;
  baseHitReact: number;
  woundedHitReact: number;
  deathReact: number;
}

export const enemyReactionProfiles: Record<EnemyArchetypeId, EnemyReactionProfile> = {
  repair_drone: {
    hitReactEvery: 2,
    woundedHealthRatio: 0.58,
    baseHitReact: 0.82,
    woundedHitReact: 1.08,
    deathReact: 1.18,
  },
  clamp_bot: {
    hitReactEvery: 2,
    woundedHealthRatio: 0.58,
    baseHitReact: 0.86,
    woundedHitReact: 1.1,
    deathReact: 1.2,
  },
  shield_tech: {
    hitReactEvery: 2,
    woundedHealthRatio: 0.52,
    baseHitReact: 0.72,
    woundedHitReact: 0.96,
    deathReact: 1.16,
  },
  signal_turret: {
    hitReactEvery: 2,
    woundedHealthRatio: 0.5,
    baseHitReact: 0.64,
    woundedHitReact: 0.86,
    deathReact: 1,
  },
  custodian_elite: {
    hitReactEvery: 0,
    woundedHealthRatio: 0.44,
    baseHitReact: 0.18,
    woundedHitReact: 0.28,
    deathReact: 1.24,
  },
};

export function enemyReactionProfileFor(archetypeId: EnemyArchetypeId, tier: EnemyTierId) {
  const profile = enemyReactionProfiles[archetypeId] ?? enemyReactionProfiles.repair_drone;
  if (tier === "leader" || tier === "boss") {
    return {
      ...profile,
      hitReactEvery: 0,
      baseHitReact: Math.min(profile.baseHitReact, 0.36),
      woundedHitReact: Math.min(profile.woundedHitReact, 0.5),
      deathReact: Math.max(profile.deathReact, 1.22),
    };
  }
  return profile;
}
