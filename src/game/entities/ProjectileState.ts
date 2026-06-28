import { Vector3 } from "three";
import type { WeaponId } from "../config/weaponConfig";
import type { EntityId } from "./EntityTypes";

export interface ProjectileState {
  id: EntityId;
  ownerId: EntityId;
  weaponId: WeaponId;
  position: Vector3;
  previousPosition: Vector3;
  direction: Vector3;
  velocity: Vector3;
  age: number;
  lifetime: number;
  radius: number;
  damage: number;
  pierceRemaining: number;
  hitEnemyIds: number[];
  canHitPuzzleTargets: boolean;
}
