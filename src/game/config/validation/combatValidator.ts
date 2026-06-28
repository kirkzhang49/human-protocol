import { enemyArchetypes } from "../enemyArchetypes";
import { enemyTierIds } from "../enemyTiers";
import type { EnemySpawnDefinition, LevelDefinition } from "../schema/levelConfig";
import { duplicateIds as duplicates } from "./ids";
import {
  addIssue,
  type ConfigValidationIssue,
  validateColorOptional,
  validatePositiveOptional,
} from "./issues";
import { createLevelReferenceSets } from "./referenceSets";
import { triggerRefExists } from "./runtimeEventValidator";

export function validateCombatLimits(level: LevelDefinition, warnings: ConfigValidationIssue[]) {
  validatePositiveOptional(level.combatLimits.smallEnemyDamageMultiplier, "combatLimits.smallEnemyDamageMultiplier", warnings);
}

export function estimateActiveEnemyBudget(level: LevelDefinition) {
  let max = 0;
  for (const wave of level.waves) {
    const base = wave.enemies.reduce((sum, group) => sum + group.count, 0);
    const reinforcements = wave.reinforcements?.reduce((sum, group) => sum + Math.min(group.count, group.maxAlive ?? group.count), 0) ?? 0;
    max = Math.max(max, base + reinforcements);
  }
  return max;
}

export function validateWaves(level: LevelDefinition, errors: ConfigValidationIssue[], warnings: ConfigValidationIssue[]) {
  const duplicateWaves = duplicates(level.waves.map((wave) => wave.id));
  for (const id of duplicateWaves) addIssue(errors, "wave.duplicate", `waves.${id}`, `Duplicate wave id "${id}".`);

  const refs = createLevelReferenceSets(level);

  level.waves.forEach((wave, index) => {
    if (wave.roomId && !refs.roomIds.has(wave.roomId)) {
      addIssue(errors, "wave.room.missing", `waves[${index}].roomId`, `Wave "${wave.id}" references missing room "${wave.roomId}".`);
    }
    wave.enemies.forEach((spawn, spawnIndex) => {
      validateEnemySpawnDefinition(spawn, `waves[${index}].enemies[${spawnIndex}]`, errors, warnings);
    });
    wave.reinforcements?.forEach((spawn, spawnIndex) => {
      validateEnemySpawnDefinition(spawn, `waves[${index}].reinforcements[${spawnIndex}]`, errors, warnings);
    });
    if (!wave.trigger) return;
    if (!triggerRefExists(wave.trigger, refs)) {
      addIssue(errors, "wave.trigger.ref.missing", `waves[${index}].trigger.id`, `Wave "${wave.id}" trigger references missing ${wave.trigger.type} id "${wave.trigger.id}".`);
    }
  });
}

function validateEnemySpawnDefinition(
  spawn: EnemySpawnDefinition,
  path: string,
  errors: ConfigValidationIssue[],
  warnings: ConfigValidationIssue[],
) {
  if (!Object.prototype.hasOwnProperty.call(enemyArchetypes, spawn.archetype)) {
    addIssue(errors, "spawn.actor.missing", `${path}.archetype`, `Spawn references unknown archetype "${spawn.archetype}".`);
  }
  if (spawn.count <= 0) {
    addIssue(errors, "spawn.count.invalid", `${path}.count`, "Spawn count must be positive.");
  }
  if (spawn.tier && !(enemyTierIds as readonly string[]).includes(spawn.tier)) {
    addIssue(errors, "spawn.tier.invalid", `${path}.tier`, `Enemy tier "${spawn.tier}" is not supported.`);
  }
  validatePositiveOptional(spawn.healthMultiplier, `${path}.healthMultiplier`, warnings);
  validatePositiveOptional(spawn.damageMultiplier, `${path}.damageMultiplier`, warnings);
  validatePositiveOptional(spawn.moveSpeedMultiplier, `${path}.moveSpeedMultiplier`, warnings);
  validatePositiveOptional(spawn.attackCooldownMultiplier, `${path}.attackCooldownMultiplier`, warnings);
  validatePositiveOptional(spawn.attackRangeMultiplier, `${path}.attackRangeMultiplier`, warnings);
  validatePositiveOptional(spawn.threatWeightMultiplier, `${path}.threatWeightMultiplier`, warnings);
  validatePositiveOptional(spawn.radiusMultiplier, `${path}.radiusMultiplier`, warnings);
  validatePositiveOptional(spawn.visual?.scaleMultiplier, `${path}.visual.scaleMultiplier`, warnings);
  validatePositiveOptional(spawn.visual?.lightIntensityMultiplier, `${path}.visual.lightIntensityMultiplier`, warnings);
  validateColorOptional(spawn.visual?.bodyColor, `${path}.visual.bodyColor`, warnings);
  validateColorOptional(spawn.visual?.armorColor, `${path}.visual.armorColor`, warnings);
  validateColorOptional(spawn.visual?.coreColor, `${path}.visual.coreColor`, warnings);
  validateColorOptional(spawn.visual?.warningColor, `${path}.visual.warningColor`, warnings);
}
