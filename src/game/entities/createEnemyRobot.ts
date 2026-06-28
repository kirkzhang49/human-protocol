import { Vector3 } from "three";
import { enemyArchetypeVisualScaleMultipliers, enemyArchetypes, type EnemyArchetypeId } from "../config/enemyArchetypes";
import {
  resolveEnemyTierConfig,
  type EnemyTextureAtlasKey,
  type EnemyTierOverrideConfig,
} from "../config/enemyTiers";
import type { EnemyState } from "./EnemyState";

const dormantPosition = new Vector3(0, 0, -4);

export interface EnemySpawnRuntimeOptions {
  spawnRoomId?: string;
}

export function createEnemyRobot(
  id: number,
  archetypeId: EnemyArchetypeId,
  waveId: string,
  position: Vector3,
  rotationY: number,
  tierConfig?: EnemyTierOverrideConfig,
  options?: EnemySpawnRuntimeOptions,
): EnemyState {
  const archetype = enemyArchetypes[archetypeId];
  const tier = resolveEnemyTierConfig(tierConfig);
  const maxHealth = Math.max(1, Math.round(archetype.maxHealth * tier.healthMultiplier));
  const visualScaleMultiplier = tier.visual.scaleMultiplier * (enemyArchetypeVisualScaleMultipliers[archetypeId] ?? 1);

  return {
    id,
    archetypeId,
    tier: tier.tier,
    tierLabel: tier.tierLabel,
    waveId,
    spawnRoomId: options?.spawnRoomId,
    skinId: "CrimsonCoreHeavyMech",
    position: position.clone(),
    velocity: new Vector3(),
    health: maxHealth,
    maxHealth,
    radius: archetype.radius * tier.radiusMultiplier,
    rotationY,
    isAlive: true,
    attackCooldownRemaining: 0.6,
    attackWindupRemaining: 0,
    attackWindupTotal: 0,
    staggerRemaining: 0,
    staggerTotal: 0,
    staggerCharge: 0,
    damageMultiplier: tier.damageMultiplier,
    moveSpeedMultiplier: tier.moveSpeedMultiplier,
    attackCooldownMultiplier: tier.attackCooldownMultiplier,
    attackRangeMultiplier: tier.attackRangeMultiplier,
    threatWeightMultiplier: tier.threatWeightMultiplier,
    visualScaleMultiplier,
    lightIntensityMultiplier: tier.visual.lightIntensityMultiplier,
    modelKey: tier.visual.modelKey || undefined,
    textureAtlasKey: resolveTextureAtlasKey(archetypeId, tierConfig, tier.visual.textureAtlasKey),
    bodyColor: tier.visual.bodyColor,
    armorColor: tier.visual.armorColor,
    coreColor: tier.visual.coreColor,
    warningColor: tier.visual.warningColor,
    spawnAge: 0,
    damageFlash: 0,
    hitReact: 0,
    hitReactionCharge: 0,
    deathAge: 99,
    lastHitDirection: new Vector3(0, 0, 1),
  };
}

export function resetEnemyRobot(
  enemy: EnemyState,
  archetypeId: EnemyArchetypeId,
  waveId: string,
  position: Vector3,
  rotationY: number,
  tierConfig?: EnemyTierOverrideConfig,
  options?: EnemySpawnRuntimeOptions,
) {
  const archetype = enemyArchetypes[archetypeId];
  const tier = resolveEnemyTierConfig(tierConfig);
  const maxHealth = Math.max(1, Math.round(archetype.maxHealth * tier.healthMultiplier));
  const visualScaleMultiplier = tier.visual.scaleMultiplier * (enemyArchetypeVisualScaleMultipliers[archetypeId] ?? 1);

  enemy.archetypeId = archetypeId;
  enemy.tier = tier.tier;
  enemy.tierLabel = tier.tierLabel;
  enemy.waveId = waveId;
  enemy.spawnRoomId = options?.spawnRoomId;
  enemy.skinId = "CrimsonCoreHeavyMech";
  enemy.position.copy(position);
  enemy.velocity.set(0, 0, 0);
  enemy.health = maxHealth;
  enemy.maxHealth = maxHealth;
  enemy.radius = archetype.radius * tier.radiusMultiplier;
  enemy.rotationY = rotationY;
  enemy.isAlive = true;
  enemy.attackCooldownRemaining = 0.6;
  enemy.attackWindupRemaining = 0;
  enemy.attackWindupTotal = 0;
  enemy.staggerRemaining = 0;
  enemy.staggerTotal = 0;
  enemy.staggerCharge = 0;
  enemy.damageMultiplier = tier.damageMultiplier;
  enemy.moveSpeedMultiplier = tier.moveSpeedMultiplier;
  enemy.attackCooldownMultiplier = tier.attackCooldownMultiplier;
  enemy.attackRangeMultiplier = tier.attackRangeMultiplier;
  enemy.threatWeightMultiplier = tier.threatWeightMultiplier;
  enemy.visualScaleMultiplier = visualScaleMultiplier;
  enemy.lightIntensityMultiplier = tier.visual.lightIntensityMultiplier;
  enemy.modelKey = tier.visual.modelKey || undefined;
  enemy.textureAtlasKey = resolveTextureAtlasKey(archetypeId, tierConfig, tier.visual.textureAtlasKey);
  enemy.bodyColor = tier.visual.bodyColor;
  enemy.armorColor = tier.visual.armorColor;
  enemy.coreColor = tier.visual.coreColor;
  enemy.warningColor = tier.visual.warningColor;
  enemy.spawnAge = 0;
  enemy.damageFlash = 0;
  enemy.hitReact = 0;
  enemy.hitReactionCharge = 0;
  enemy.deathAge = 0;
  enemy.lastHitDirection.set(0, 0, 1);
  return enemy;
}

export function createEnemyRobots(startId: number): EnemyState[] {
  const enemies: EnemyState[] = [];
  let id = startId;

  addDormantEnemies(enemies, "repair_drone", 2, id, true);
  id += 2;
  addDormantEnemies(enemies, "clamp_bot", 2, id, true);
  id += 2;
  addDormantEnemies(enemies, "custodian_elite", 1, id, true);
  id += 1;
  addDormantEnemies(enemies, "repair_drone", 28, id);
  id += 28;
  addDormantEnemies(enemies, "clamp_bot", 12, id);
  id += 12;
  addDormantEnemies(enemies, "shield_tech", 2, id);
  id += 2;
  addDormantEnemies(enemies, "signal_turret", 2, id);

  return enemies;
}

function addDormantEnemies(
  enemies: EnemyState[],
  archetypeId: EnemyArchetypeId,
  count: number,
  startId: number,
  prewarmSlot = false,
) {
  for (let index = 0; index < count; index += 1) {
    const enemy = createEnemyRobot(startId + index + 1, archetypeId, "__pool", dormantPosition, 0);
    enemy.isAlive = false;
    enemy.deathAge = 99;
    enemy.prewarmSlot = prewarmSlot;
    enemies.push(enemy);
  }
}

function resolveTextureAtlasKey(
  archetypeId: EnemyArchetypeId,
  tierConfig: EnemyTierOverrideConfig | undefined,
  tierTextureAtlasKey: EnemyTextureAtlasKey,
) {
  if (tierConfig?.visual?.textureAtlasKey) return tierConfig.visual.textureAtlasKey;
  if (tierConfig?.tier && tierConfig.tier !== "normal") return tierTextureAtlasKey;
  if (archetypeId === "custodian_elite") return "custodian_boss";
  if (archetypeId === "clamp_bot") return "clamp_bot";
  return "repair_drone";
}
