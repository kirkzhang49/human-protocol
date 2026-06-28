import { Vector2, Vector3 } from "three";

export type EntityId = number;
export type EffectType =
  | "muzzleFlash"
  | "dashBurst"
  | "hitSpark"
  | "armorSpark"
  | "coreSpark"
  | "staggerBurst"
  | "dangerTelegraph"
  | "bladeSlash"
  | "shockwave";

export interface EffectState {
  id: EntityId;
  type: EffectType;
  position: Vector3;
  direction: Vector3;
  age: number;
  lifetime: number;
  intensity: number;
}

export interface ObstacleState {
  id: string;
  visualKey: string;
  position: Vector3;
  /** Local half-extents. With `yaw`, these are the un-rotated box half-sizes. */
  halfSize: Vector3;
  /**
   * Optional Y rotation (radians) for an oriented box. Absent/0 = axis-aligned
   * (the common case). Used by angled/curved (N-gon) room walls so collision
   * matches the rendered wall instead of a fattened AABB.
   */
  yaw?: number;
  /** Enemy navigation override. Player movement, bullets, and line-of-sight still treat the obstacle normally. */
  enemyNavigation?: "solid" | "soft" | "ignore";
}

export type PickupType = "coreCell" | "repairKit" | "ironRod" | "pistol" | "breachMissile";

export interface PickupState {
  id: EntityId;
  type: PickupType;
  position: Vector3;
  age: number;
  collected: boolean;
  expires?: boolean;
}

export interface CameraState {
  target: Vector3;
  lookAhead: Vector3;
  shake: number;
  shakeSeed: number;
  fovKick: number;
  rumble: number;
  rumbleRemaining: number;
  combatFocusTarget: Vector3;
  combatFocusRemaining: number;
  combatFocusTotal: number;
  combatFocusStrength: number;
}

export interface WorldInputState {
  move: Vector2;
  aimPoint: Vector3;
  lookDelta: Vector2;
  fire: boolean;
  fireSource: "manual" | "auto" | null;
  dashPressed: boolean;
  sprint: boolean;
  interactPressed: boolean;
  shockPressed: boolean;
  switchWeaponPressed: boolean;
}
