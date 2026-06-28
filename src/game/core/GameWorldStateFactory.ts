import { Vector2, Vector3 } from "three";
import type { CombatAssistState } from "./GameMode";
import type { TouchInputState } from "./GameWorldTypes";
import type { WorldInputState } from "../entities/EntityTypes";

export function createWorldInputState(): WorldInputState {
  return {
    move: new Vector2(),
    aimPoint: new Vector3(0, 0, 1),
    lookDelta: new Vector2(),
    fire: false,
    fireSource: null,
    dashPressed: false,
    sprint: false,
    interactPressed: false,
    shockPressed: false,
    switchWeaponPressed: false,
  };
}

export function createTouchInputState(): TouchInputState {
  return {
    move: new Vector2(),
    lookDelta: new Vector2(),
    fire: false,
    sprint: false,
    dashPressed: false,
    interactPressed: false,
    shockPressed: false,
    switchWeaponPressed: false,
    selectedWeapon: null,
    requestedThreatTurnAngle: null,
  };
}

export function createCombatAssistState(): CombatAssistState {
  return {
    autoFireEnabled: true,
    lockedEnemyId: null,
    lockedStrength: 0,
    targetConeDegrees: 22,
    targetDistance: 26,
    threatSegments: Array.from({ length: 8 }, (_, index) => ({
      index,
      angle: index * (Math.PI / 4),
      intensity: 0,
    })),
    reorientCooldown: 0,
    reorientTargetYaw: null,
  };
}

export function createCameraState() {
  return {
    target: new Vector3(),
    lookAhead: new Vector3(),
    shake: 0,
    shakeSeed: 0,
    fovKick: 0,
    rumble: 0,
    rumbleRemaining: 0,
    combatFocusTarget: new Vector3(),
    combatFocusRemaining: 0,
    combatFocusTotal: 0,
    combatFocusStrength: 0,
  };
}
