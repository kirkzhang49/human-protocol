import type { EnemyModelKey } from "../../assets/enemyModelAssets";
import type { GameWorld } from "../../game/core/GameWorld";
import { isRoomVisibleForEnemy } from "../../game/core/RoomReachability";
import { segmentIntersectsAabb2D, segmentIntersectsObb2D } from "../../game/core/math";
import type { EnemyState } from "../../game/entities/EnemyState";
import type { ObstacleState } from "../../game/entities/EntityTypes";

const THREE_ORACLE_BOSS_MODELS = new Set<EnemyModelKey>([
  "hp_enemy_shield_technician_horror",
  "hp_enemy_custodian_foreman_horror",
  "hp_enemy_reclamation_mother_final_horror",
]);

export function shouldRenderEnemyWithThreeOracle(enemy: EnemyState, modelKey: EnemyModelKey) {
  if (modelKey === "hp_enemy_shield_technician_horror") return true;
  return enemyUsesBossMaterialFinish(enemy) && THREE_ORACLE_BOSS_MODELS.has(modelKey);
}

export function enemyUsesBossMaterialFinish(enemy: EnemyState) {
  return enemy.tier === "boss";
}

export function enemyModelTargetHeight(enemy: EnemyState, modelKey: EnemyModelKey) {
  if (enemy.archetypeId === "repair_drone") return 0.76;
  if (enemy.archetypeId === "clamp_bot") return 1.42;
  if (enemy.archetypeId === "shield_tech") return 1.62;
  if (modelKey === "hp_enemy_reclamation_mother_final_horror") return 3.05;
  if (enemy.archetypeId === "custodian_elite" || enemy.tier === "boss") return 2.65;
  if (enemy.tier === "leader") return 2.15;
  return 1.48;
}

export function enemyModelAltitude(enemy: EnemyState) {
  if (enemy.archetypeId === "repair_drone") return enemy.isAlive ? 0.62 : 0.08;
  return 0;
}

export function isEnemyRoomVisibleForThreeOracle(world: GameWorld, roomId: string | undefined) {
  return isRoomVisibleForEnemy(world, roomId);
}

export function isEnemyOccludedForThreeOracle(world: GameWorld, enemy: EnemyState) {
  const start = world.player.position;
  const end = enemy.position;
  for (const obstacle of world.obstacles) {
    if (pointInsideObstacle2D(start, obstacle) || pointInsideObstacle2D(end, obstacle)) continue;
    const hit = obstacle.yaw
      ? segmentIntersectsObb2D(start, end, obstacle.position, obstacle.halfSize, obstacle.yaw, 0.03)
      : segmentIntersectsAabb2D(start, end, obstacle.position, obstacle.halfSize, 0.03);
    if (hit) return true;
  }
  return false;
}

function pointInsideObstacle2D(point: { x: number; z: number }, obstacle: ObstacleState) {
  const dx = point.x - obstacle.position.x;
  const dz = point.z - obstacle.position.z;
  if (obstacle.yaw) {
    const cos = Math.cos(obstacle.yaw);
    const sin = Math.sin(obstacle.yaw);
    const localX = dx * cos + dz * sin;
    const localZ = -dx * sin + dz * cos;
    return Math.abs(localX) <= obstacle.halfSize.x && Math.abs(localZ) <= obstacle.halfSize.z;
  }
  return Math.abs(dx) <= obstacle.halfSize.x && Math.abs(dz) <= obstacle.halfSize.z;
}
