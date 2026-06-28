import { Vector3 } from "three";
import { weaponConfig, type WeaponId } from "../config/weaponConfig";
import type { EntityId } from "./EntityTypes";
import type { ProjectileState } from "./ProjectileState";

export function createProjectile(
  id: EntityId,
  ownerId: EntityId,
  weaponId: WeaponId,
  position: Vector3,
  direction: Vector3,
  options: { canHitPuzzleTargets?: boolean } = {},
): ProjectileState {
  const config = weaponConfig[weaponId];
  const normalizedDirection = direction.clone().normalize();
  return {
    id,
    ownerId,
    weaponId,
    position: position.clone(),
    previousPosition: position.clone(),
    direction: normalizedDirection,
    velocity: normalizedDirection.clone().multiplyScalar(config.projectileSpeed),
    age: 0,
    lifetime: config.projectileLifetime,
    radius: config.projectileRadius,
    damage: config.projectileDamage,
    pierceRemaining: 0,
    hitEnemyIds: [],
    canHitPuzzleTargets: options.canHitPuzzleTargets ?? true,
  };
}
