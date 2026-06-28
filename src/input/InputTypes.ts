import { Vector2 } from "three";
import type { WeaponId } from "../game/config/weaponConfig";

export interface InputSnapshot {
  move: Vector2;
  pointerNdc: Vector2;
  lookDelta: Vector2;
  fire: boolean;
  dashPressed: boolean;
  sprint: boolean;
  resetPressed: boolean;
  pausePressed: boolean;
  interactPressed: boolean;
  useItemPressed: boolean;
  switchWeapon: WeaponId | null;
  pointerLocked: boolean;
}

export type InputAction = "dash" | "reset" | "pause" | "interact" | "weapon1" | "weapon2" | "weapon3";
